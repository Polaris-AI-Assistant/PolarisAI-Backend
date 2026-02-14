const express = require('express');
const router = express.Router();
const scheduleData = require('./scheduleData');
const { getNextExecution, isWithinOneMonth } = require('./scheduleUtils');
const { sendScheduleReminder, sendActionCompleted } = require('./emailService');
const { executeAction } = require('./actionService');

// Webhook secret from environment
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * POST /api/webhooks/execute-schedule
 * Called by Supabase cron to execute a due schedule
 */
router.post('/execute-schedule', async (req, res) => {
  try {
    // Verify webhook secret
    const secret = req.headers['x-webhook-secret'];

    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      console.error('[Webhook] Invalid webhook secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { scheduleId, userId, type, content, recurring, cronExpression, timezone } = req.body;

    if (!scheduleId || !userId) {
      return res.status(400).json({ error: 'Missing scheduleId or userId' });
    }

    console.log(`[Webhook] Executing schedule ${scheduleId} for user ${userId} (type: ${type})`);

    // Execute based on type
    if (type === 'reminder') {
      await sendScheduleReminder(userId, content, scheduleId);
    } else if (type === 'action') {
      await executeAction({ userId, content, scheduleId });
    }

    // Build update object
    const updates = {
      last_execution: new Date().toISOString(),
      execution_count: undefined  // will need raw increment
    };

    // For recurring schedules, calculate next execution
    if (recurring) {
      try {
        const nextExecution = getNextExecution(cronExpression, timezone || 'UTC');

        if (isWithinOneMonth(nextExecution)) {
          updates.next_execution = nextExecution.toISOString();
          updates.status = 'active';
        } else {
          updates.status = 'paused';
          updates.metadata = {
            pauseReason: 'Next execution beyond 1 month',
            pausedAt: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('[Webhook] Error calculating next execution:', error);
        updates.status = 'failed';
        updates.metadata = {
          lastError: error.message,
          lastErrorAt: new Date().toISOString()
        };
      }
    } else {
      // One-time schedule - mark as completed
      updates.status = 'completed';
    }

    // Update schedule in database (increment execution_count via raw SQL)
    const supabase = require('../supabase/supabaseConnect');
    
    // First increment execution_count via RPC or direct update
    try {
      const { error: rpcError } = await supabase.rpc('increment_schedule_execution_count', { schedule_id: scheduleId });
      if (rpcError) {
        console.log('[Webhook] RPC not available, incrementing count manually');
        await supabase
          .from('schedules')
          .update({ execution_count: (updates.execution_count || 0) + 1 })
          .eq('id', scheduleId);
      }
    } catch (rpcErr) {
      console.log('[Webhook] RPC call failed, skipping count increment:', rpcErr.message);
    }

    // Then update the rest
    delete updates.execution_count;
    await scheduleData.updateScheduleAfterExecution(scheduleId, updates);

    console.log(`[Webhook] Schedule ${scheduleId} executed successfully (status: ${updates.status})`);

    return res.json({ success: true });

  } catch (error) {
    console.error('[Webhook] Error executing schedule:', error);

    // Try to mark schedule as failed
    if (req.body && req.body.scheduleId) {
      try {
        await scheduleData.updateScheduleAfterExecution(req.body.scheduleId, {
          status: 'failed',
          metadata: {
            lastError: error.message,
            lastErrorAt: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error('[Webhook] Failed to mark schedule as failed:', updateError);
      }
    }

    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
