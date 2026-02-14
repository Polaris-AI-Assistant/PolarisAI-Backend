const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const scheduleData = require('./scheduleData');
const {
  isValidCron,
  getNextExecution,
  convertToUserTimezone,
  isWithinOneMonth,
  validateCronExpression
} = require('./scheduleUtils');

/**
 * POST /api/schedules
 * Create a new schedule
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, cronExpression, type, recurring, timezone } = req.body;
    const userId = req.user.id;
    const userTimezone = timezone || 'UTC';

    // Validate required fields
    if (!content || !cronExpression || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: content, cronExpression, type'
      });
    }

    // Validate type
    if (!['reminder', 'action'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "reminder" or "action"'
      });
    }

    // Validate cron expression format
    if (!isValidCron(cronExpression)) {
      return res.status(400).json({ success: false, error: 'Invalid cron expression' });
    }

    // Validate cron constraints
    try {
      validateCronExpression(cronExpression);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    // Calculate next execution
    const nextExecution = getNextExecution(cronExpression, userTimezone);

    // Validate it's within 1 year
    if (!isWithinOneMonth(nextExecution)) {
      return res.status(400).json({
        success: false,
        error: 'Schedule must execute within 1 year'
      });
    }

    // Create schedule in database
    const schedule = await scheduleData.createSchedule({
      user_id: userId,
      type,
      content,
      cron_expression: cronExpression,
      recurring: recurring || false,
      next_execution: nextExecution.toISOString(),
      timezone: userTimezone,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      schedule: {
        ...schedule,
        next_execution_local: convertToUserTimezone(schedule.next_execution, userTimezone)
      }
    });

  } catch (error) {
    console.error('[Schedules] Error creating schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/schedules
 * List user's schedules
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status = 'all', limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const { schedules, total } = await scheduleData.getSchedules(userId, {
      status, limit, offset
    });

    // Add local time to each schedule
    const schedulesWithLocalTime = schedules.map(s => ({
      ...s,
      next_execution_local: convertToUserTimezone(s.next_execution, s.timezone),
      last_execution_local: s.last_execution
        ? convertToUserTimezone(s.last_execution, s.timezone)
        : null
    }));

    return res.json({
      success: true,
      schedules: schedulesWithLocalTime,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[Schedules] Error listing schedules:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/schedules/:id
 * Get a specific schedule
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const schedule = await scheduleData.getScheduleById(id, userId);

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    return res.json({
      success: true,
      schedule: {
        ...schedule,
        next_execution_local: convertToUserTimezone(schedule.next_execution, schedule.timezone),
        last_execution_local: schedule.last_execution
          ? convertToUserTimezone(schedule.last_execution, schedule.timezone)
          : null
      }
    });

  } catch (error) {
    console.error('[Schedules] Error getting schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/schedules/:id
 * Update a schedule
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, cronExpression, recurring } = req.body;
    const userId = req.user.id;

    // Get existing schedule
    const existingSchedule = await scheduleData.getScheduleById(id, userId);
    if (!existingSchedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const updates = {};

    if (content !== undefined) {
      updates.content = content;
    }

    if (recurring !== undefined) {
      updates.recurring = recurring;
    }

    if (cronExpression) {
      if (!isValidCron(cronExpression)) {
        return res.status(400).json({ success: false, error: 'Invalid cron expression' });
      }

      try {
        validateCronExpression(cronExpression);
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      const nextExecution = getNextExecution(cronExpression, existingSchedule.timezone);

      if (!isWithinOneMonth(nextExecution)) {
        return res.status(400).json({
          success: false,
          error: 'Schedule must execute within 1 month'
        });
      }

      updates.cron_expression = cronExpression;
      updates.next_execution = nextExecution.toISOString();
    }

    const schedule = await scheduleData.updateSchedule(id, userId, updates);

    return res.json({
      success: true,
      schedule: {
        ...schedule,
        next_execution_local: convertToUserTimezone(schedule.next_execution, schedule.timezone),
        last_execution_local: schedule.last_execution
          ? convertToUserTimezone(schedule.last_execution, schedule.timezone)
          : null
      }
    });

  } catch (error) {
    console.error('[Schedules] Error updating schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await scheduleData.deleteSchedule(id, userId);

    return res.json({ success: true, message: 'Schedule deleted' });

  } catch (error) {
    console.error('[Schedules] Error deleting schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/schedules/:id/pause
 * Pause a schedule
 */
router.post('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const schedule = await scheduleData.updateSchedule(id, userId, { status: 'paused' });

    return res.json({ success: true, schedule });

  } catch (error) {
    console.error('[Schedules] Error pausing schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/schedules/:id/resume
 * Resume a paused schedule
 */
router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get existing schedule
    const existingSchedule = await scheduleData.getScheduleById(id, userId);
    if (!existingSchedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Calculate new next execution
    const nextExecution = getNextExecution(
      existingSchedule.cron_expression,
      existingSchedule.timezone
    );

    if (!isWithinOneMonth(nextExecution)) {
      return res.status(400).json({
        success: false,
        error: 'Next execution is more than 1 month away. Please update the schedule.'
      });
    }

    const schedule = await scheduleData.updateSchedule(id, userId, {
      status: 'active',
      next_execution: nextExecution.toISOString()
    });

    return res.json({
      success: true,
      schedule: {
        ...schedule,
        next_execution_local: convertToUserTimezone(schedule.next_execution, schedule.timezone)
      }
    });

  } catch (error) {
    console.error('[Schedules] Error resuming schedule:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /engine-status - Get scheduler engine stats
router.get('/engine-status', authenticateToken, async (req, res) => {
  try {
    const scheduleEngine = require('./scheduleEngine');
    const stats = scheduleEngine.getStats();
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('[Schedules] Error getting engine status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
