/**
 * Google Calendar Agent Controller
 * 
 * HTTP endpoint for interacting with the Google Calendar AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const CalendarAgent = require('./calendarAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Calendar AI Agent
const calendarAgent = new CalendarAgent();

/**
 * POST /calendar/agent/query
 * Process natural language queries about Google Calendar
 * 
 * Request body:
 * {
 *   "query": "schedule a team meeting tomorrow at 2pm",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I've scheduled a team meeting...",
 *   "query": "schedule a team meeting...",
 *   "tools_used": [...],
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        example: {
          query: "show me my events for today"
        }
      });
    }

    console.log(`[CalendarAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await calendarAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[CalendarAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /calendar/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Creating Events",
        queries: [
          "Schedule a team meeting tomorrow at 2pm for 1 hour",
          "Create an event called 'Project Review' on Friday at 3pm",
          "Add a doctor appointment next Monday at 10am",
          "Set up a weekly standup every Monday at 9am for 30 minutes"
        ]
      },
      {
        category: "Viewing Events",
        queries: [
          "Show me my events for today",
          "What's on my calendar this week?",
          "List all meetings tomorrow",
          "Find events with 'project' in the title",
          "Show me my schedule for next Monday"
        ]
      },
      {
        category: "Updating Events",
        queries: [
          "Reschedule the team meeting to 3pm",
          "Change the location of my appointment to Building A",
          "Add john@example.com to the project review meeting",
          "Update the description of the client meeting"
        ]
      },
      {
        category: "Deleting Events",
        queries: [
          "Cancel the team meeting tomorrow",
          "Delete the doctor appointment",
          "Remove the event with ID [EVENT_ID]"
        ]
      },
      {
        category: "Managing Calendars",
        queries: [
          "Show me all my calendars",
          "Create a new calendar called 'Personal'",
          "Get details about my work calendar",
          "Delete the calendar called 'Old Projects'"
        ]
      },
      {
        category: "Responding to Events",
        queries: [
          "Accept the meeting invitation",
          "Decline the event with ID [EVENT_ID]",
          "Mark my response as tentative for tomorrow's meeting"
        ]
      }
    ],
    tips: [
      "Be specific with dates and times",
      "Include duration when creating events",
      "Mention event IDs for updates/deletes if you have them",
      "Use natural language - the AI understands context",
      "You can combine multiple actions in one query"
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /calendar/agent/capabilities
 * Get detailed information about agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      events: {
        create: {
          description: "Create new calendar events",
          features: [
            "Set title, description, and location",
            "Specify date, time, and timezone",
            "Add attendees",
            "Create recurring events",
            "Add Google Meet links",
            "Set reminders"
          ]
        },
        read: {
          description: "Retrieve and search calendar events",
          features: [
            "Get events by date range",
            "Search events by keyword",
            "Filter by calendar",
            "Order by start time or last updated",
            "Limit number of results"
          ]
        },
        update: {
          description: "Modify existing events",
          features: [
            "Change time and date",
            "Update location and description",
            "Add/remove attendees",
            "Modify recurrence rules",
            "Add/update Google Meet links"
          ]
        },
        delete: {
          description: "Remove calendar events",
          features: [
            "Delete single events",
            "Notify attendees about cancellation",
            "Delete from specific calendars"
          ]
        },
        respond: {
          description: "Respond to event invitations",
          features: [
            "Accept invitations",
            "Decline invitations",
            "Mark as tentative",
            "Mark as needs action"
          ]
        }
      },
      calendars: {
        list: {
          description: "View all accessible calendars",
          features: [
            "List all calendars",
            "Show calendar details",
            "View access roles"
          ]
        },
        create: {
          description: "Create new secondary calendars",
          features: [
            "Set calendar name and description",
            "Configure timezone",
            "Customize appearance"
          ]
        },
        update: {
          description: "Modify calendar settings",
          features: [
            "Change name and description",
            "Update timezone",
            "Modify calendar properties"
          ]
        },
        delete: {
          description: "Remove secondary calendars",
          features: [
            "Delete non-primary calendars",
            "Permanent removal"
          ]
        }
      }
    },
    supported_formats: {
      datetime: "ISO 8601 (e.g., '2024-04-15T14:00:00' or '2024-04-15T14:00:00-07:00')",
      timezone: "Standard timezone names (e.g., 'UTC', 'America/Los_Angeles', 'Europe/London')",
      recurrence: "RRULE format (e.g., 'RRULE:FREQ=WEEKLY;COUNT=10')"
    },
    natural_language: {
      date_understanding: [
        "Absolute dates: 'April 15, 2024', '2024-04-15'",
        "Relative dates: 'tomorrow', 'next week', 'in 3 days'",
        "Day names: 'Monday', 'next Friday'"
      ],
      time_understanding: [
        "12-hour format: '2pm', '10:30am'",
        "24-hour format: '14:00', '22:30'",
        "Relative times: 'in 2 hours', 'at noon'"
      ]
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /calendar/agent/status
 * Check if the agent is operational and Calendar is connected
 */
router.get('/agent/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user has connected Calendar (you can reuse the status check from calendarAuth)
    const supabase = require('../supabase/supabaseConnect');
    const { data: tokenRow, error } = await supabase
      .from("calendar_tokens")
      .select("email")
      .eq("user_id", userId)
      .single();

    const isConnected = !error && tokenRow;

    res.json({
      success: true,
      agent_operational: true,
      calendar_connected: isConnected,
      user_email: isConnected ? tokenRow.email : null,
      message: isConnected 
        ? "Calendar agent is ready to use" 
        : "Please connect your Google Calendar first",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[CalendarAgentController] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check agent status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
