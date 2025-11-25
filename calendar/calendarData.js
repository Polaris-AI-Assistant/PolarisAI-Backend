/**
 * Google Calendar Data Routes
 * 
 * Direct HTTP endpoints for Calendar operations without AI agent
 */

const express = require('express');
const calendarService = require('./calendarService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /calendar/events
 * Create a new calendar event
 */
router.post('/calendar/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventDetails = req.body;

    const result = await calendarService.createEvent(userId, eventDetails);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Create event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
      message: error.message
    });
  }
});

/**
 * GET /calendar/events
 * Get calendar events
 */
router.get('/calendar/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      timeMin: req.query.timeMin,
      timeMax: req.query.timeMax,
      maxResults: req.query.maxResults ? parseInt(req.query.maxResults) : 250,
      calendarId: req.query.calendarId || 'primary',
      orderBy: req.query.orderBy || 'startTime',
      query: req.query.query
    };

    const result = await calendarService.getEvents(userId, filters);
    res.json(result);

  } catch (error) {
    console.error('[CalendarData] Get events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get events',
      message: error.message
    });
  }
});

/**
 * PUT /calendar/events/:eventId
 * Update an existing calendar event
 */
router.put('/calendar/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.eventId;
    const { calendarId = 'primary', sendUpdates = 'none', ...updates } = req.body;

    const result = await calendarService.updateEvent(userId, eventId, updates, calendarId, sendUpdates);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Update event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event',
      message: error.message
    });
  }
});

/**
 * DELETE /calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/calendar/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.eventId;
    const calendarId = req.query.calendarId || 'primary';
    const sendUpdates = req.query.sendUpdates || 'none';

    const result = await calendarService.deleteEvent(userId, eventId, calendarId, sendUpdates);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Delete event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      message: error.message
    });
  }
});

/**
 * GET /calendar/calendars
 * Get list of calendars
 */
router.get('/calendar/calendars', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await calendarService.getCalendars(userId);
    res.json(result);

  } catch (error) {
    console.error('[CalendarData] Get calendars error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendars',
      message: error.message
    });
  }
});

/**
 * GET /calendar/calendars/:calendarId
 * Get specific calendar details
 */
router.get('/calendar/calendars/:calendarId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const calendarId = req.params.calendarId;

    const result = await calendarService.getCalendar(userId, calendarId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Get calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar',
      message: error.message
    });
  }
});

/**
 * POST /calendar/calendars
 * Create a new secondary calendar
 */
router.post('/calendar/calendars', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { summary, description = '', timeZone = 'UTC' } = req.body;

    if (!summary) {
      return res.status(400).json({
        success: false,
        error: 'Calendar name (summary) is required'
      });
    }

    const result = await calendarService.createCalendar(userId, summary, description, timeZone);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Create calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create calendar',
      message: error.message
    });
  }
});

/**
 * PUT /calendar/calendars/:calendarId
 * Update calendar properties
 */
router.put('/calendar/calendars/:calendarId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const calendarId = req.params.calendarId;
    const updates = req.body;

    const result = await calendarService.updateCalendar(userId, calendarId, updates);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Update calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update calendar',
      message: error.message
    });
  }
});

/**
 * DELETE /calendar/calendars/:calendarId
 * Delete a secondary calendar
 */
router.delete('/calendar/calendars/:calendarId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const calendarId = req.params.calendarId;

    const result = await calendarService.deleteCalendar(userId, calendarId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Delete calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete calendar',
      message: error.message
    });
  }
});

/**
 * POST /calendar/events/:eventId/respond
 * Respond to an event invitation
 */
router.post('/calendar/events/:eventId/respond', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.eventId;
    const { responseStatus, calendarId = 'primary' } = req.body;

    if (!responseStatus) {
      return res.status(400).json({
        success: false,
        error: 'Response status is required (accepted, declined, tentative, needsAction)'
      });
    }

    const result = await calendarService.respondToEvent(userId, eventId, responseStatus, calendarId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('[CalendarData] Respond to event error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to event',
      message: error.message
    });
  }
});

module.exports = router;
