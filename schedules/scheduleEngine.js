const supabase = require('../supabase/supabaseConnect');
const { createClient } = require('@supabase/supabase-js');
const { getNextExecution, isWithinOneMonth } = require('./scheduleUtils');
const { sendScheduleReminder, sendActionCompleted } = require('./emailService');
const { executeAction } = require('./actionService');

// ─── Configuration ───────────────────────────────────────────────────
const POLL_INTERVAL = 15_000;          // Poll every 15 seconds
const MAX_BATCH_SIZE = 50;             // Max schedules per tick
const MAX_RETRIES = 3;                 // Retry failed tasks up to 3 times
const RETRY_DELAY_BASE = 30_000;       // 30s, 60s, 90s exponential backoff
const LOCK_TIMEOUT_MS = 5 * 60_000;    // Consider a lock stale after 5 min

// Use service-role client so RLS doesn't block the engine
function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

let pollTimer = null;
let isProcessing = false;
let stats = { executed: 0, failed: 0, retried: 0, started: null };

// ─── Engine lifecycle ────────────────────────────────────────────────

/**
 * Start the scheduler engine
 */
function start() {
  if (pollTimer) {
    console.log('[Scheduler] Already running');
    return;
  }

  stats.started = new Date();
  console.log(`[Scheduler] ✅ Engine started — polling every ${POLL_INTERVAL / 1000}s`);

  // Run immediately on start, then at interval
  tick();
  pollTimer = setInterval(tick, POLL_INTERVAL);
}

/**
 * Stop the scheduler engine
 */
function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[Scheduler] 🛑 Engine stopped');
  }
}

/**
 * Get engine stats
 */
function getStats() {
  return {
    running: !!pollTimer,
    ...stats,
    uptime: stats.started ? Math.floor((Date.now() - stats.started) / 1000) : 0,
  };
}

// ─── Core polling loop ───────────────────────────────────────────────

async function tick() {
  if (isProcessing) {
    return; // Skip if previous tick is still running
  }

  isProcessing = true;

  try {
    const admin = getAdminClient();

    // Fetch all active schedules whose next_execution is in the past
    const { data: dueSchedules, error } = await admin
      .from('schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_execution', new Date().toISOString())
      .order('next_execution', { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (error) {
      console.error('[Scheduler] Error fetching due schedules:', error.message);
      return;
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      return; // Nothing to do
    }

    console.log(`[Scheduler] Found ${dueSchedules.length} due schedule(s)`);

    // Process each schedule
    for (const schedule of dueSchedules) {
      await processSchedule(admin, schedule);
    }

    // Also check for retryable failed schedules
    await processRetries(admin);

  } catch (err) {
    console.error('[Scheduler] Tick error:', err.message);
  } finally {
    isProcessing = false;
  }
}

// ─── Process a single schedule ───────────────────────────────────────

async function processSchedule(admin, schedule) {
  const { id, user_id, type, content, recurring, cron_expression, timezone } = schedule;

  console.log(`[Scheduler] Executing ${type} "${content}" (${id}) for user ${user_id}`);

  try {
    // Execute based on type
    if (type === 'reminder') {
      await sendScheduleReminder(user_id, content, id);
      console.log(`[Scheduler] 📧 Reminder email sent for schedule ${id}`);
    } else if (type === 'action') {
      await executeAction({ userId: user_id, content, scheduleId: id });
      console.log(`[Scheduler] ⚡ Action executed for schedule ${id}`);
    }

    // Build update
    const updates = {
      last_execution: new Date().toISOString(),
      execution_count: (schedule.execution_count || 0) + 1,
    };

    if (recurring) {
      // Calculate next execution
      try {
        const nextExecution = getNextExecution(cron_expression, timezone || 'UTC');

        if (isWithinOneMonth(nextExecution)) {
          updates.next_execution = nextExecution.toISOString();
          updates.status = 'active';
        } else {
          updates.status = 'paused';
          updates.metadata = {
            ...(schedule.metadata || {}),
            pauseReason: 'Next execution beyond 1 year',
            pausedAt: new Date().toISOString(),
          };
        }
      } catch (cronErr) {
        console.error(`[Scheduler] Cron parse error for ${id}:`, cronErr.message);
        updates.status = 'failed';
        updates.metadata = {
          ...(schedule.metadata || {}),
          lastError: cronErr.message,
          lastErrorAt: new Date().toISOString(),
        };
      }
    } else {
      // One-time → completed
      updates.status = 'completed';
    }

    await admin
      .from('schedules')
      .update(updates)
      .eq('id', id);

    stats.executed++;

  } catch (err) {
    console.error(`[Scheduler] ❌ Failed to execute schedule ${id}:`, err.message);
    stats.failed++;

    // Mark as failed with retry info
    const retryCount = (schedule.metadata?.retryCount || 0) + 1;

    const failUpdate = {
      last_execution: new Date().toISOString(),
      status: retryCount < MAX_RETRIES ? 'active' : 'failed',
      metadata: {
        ...(schedule.metadata || {}),
        lastError: err.message,
        lastErrorAt: new Date().toISOString(),
        retryCount,
      },
    };

    // If retryable, push next_execution forward for backoff
    if (retryCount < MAX_RETRIES) {
      const retryAt = new Date(Date.now() + RETRY_DELAY_BASE * retryCount);
      failUpdate.next_execution = retryAt.toISOString();
      console.log(`[Scheduler] 🔄 Will retry schedule ${id} at ${retryAt.toISOString()} (attempt ${retryCount}/${MAX_RETRIES})`);
      stats.retried++;
    } else {
      // Dead letter — mark as permanently failed
      failUpdate.status = 'failed';
      console.log(`[Scheduler] 💀 Schedule ${id} moved to dead letter (${MAX_RETRIES} retries exhausted)`);
    }

    await admin
      .from('schedules')
      .update(failUpdate)
      .eq('id', id);
  }
}

// ─── Retry handler (failed schedules that still have retries left) ───

async function processRetries(admin) {
  // Find schedules that failed but still have retries and their retry time has come
  const { data: retryable, error } = await admin
    .from('schedules')
    .select('*')
    .eq('status', 'active')
    .not('metadata->retryCount', 'is', null)
    .lte('next_execution', new Date().toISOString())
    .limit(10);

  if (error || !retryable || retryable.length === 0) return;

  for (const schedule of retryable) {
    if ((schedule.metadata?.retryCount || 0) < MAX_RETRIES) {
      console.log(`[Scheduler] 🔄 Retrying schedule ${schedule.id} (attempt ${schedule.metadata.retryCount})`);
      await processSchedule(admin, schedule);
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────
module.exports = {
  start,
  stop,
  getStats,
};
