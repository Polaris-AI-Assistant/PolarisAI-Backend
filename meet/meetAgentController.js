/**
 * Google Meet Agent Controller
 * 
 * HTTP endpoint for interacting with the Google Meet AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const MeetAgent = require('./meetAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Meet AI Agent
const meetAgent = new MeetAgent();

/**
 * POST /meet/agent/query
 * Process natural language queries about Google Meet
 * 
 * Request body:
 * {
 *   "query": "create a new meeting for tomorrow"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I've created a new meeting...",
 *   "query": "create a new meeting...",
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
          query: "create a new meeting"
        }
      });
    }

    console.log(`[MeetAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await meetAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[MeetAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /meet/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Creating Meetings",
        queries: [
          "Create a new meeting",
          "Start a new Google Meet",
          "Generate a meeting link",
          "Set up a video call"
        ]
      },
      {
        category: "Meeting History",
        queries: [
          "Show me past meetings in space [SPACE_ID]",
          "List conference history",
          "What meetings happened in this space?",
          "Show meeting records"
        ]
      },
      {
        category: "Meeting Details",
        queries: [
          "Get details for meeting [SPACE_ID]",
          "Show me information about conference [CONFERENCE_ID]",
          "What are the details of this meeting?",
          "Tell me about this meeting space"
        ]
      },
      {
        category: "Recordings",
        queries: [
          "List recordings for conference [CONFERENCE_ID]",
          "Show me meeting recordings",
          "Do I have any recorded meetings?",
          "Get recording details for [RECORDING_ID]"
        ]
      },
      {
        category: "Participants",
        queries: [
          "Who attended conference [CONFERENCE_ID]?",
          "List participants from the last meeting",
          "Show me who joined the meeting",
          "Get participant information"
        ]
      }
    ],
    tips: [
      "You can create instant meeting links without any additional setup",
      "Meeting spaces persist and can be reused for future meetings",
      "Recordings are automatically saved to your Google Drive",
      "Conference records contain historical data about past meetings",
      "Participant information includes join/leave timestamps"
    ]
  });
});

/**
 * GET /meet/agent/capabilities
 * Get information about agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: [
      {
        name: "Create Meeting Space",
        description: "Create a new Google Meet space with a unique meeting link",
        example: "Create a new meeting for our team standup"
      },
      {
        name: "Get Meeting Details",
        description: "Retrieve details about an existing meeting space",
        example: "Get details for meeting space abc-defg-hij"
      },
      {
        name: "Conference History",
        description: "List past conferences that occurred in a meeting space",
        example: "Show me all past meetings in this space"
      },
      {
        name: "Recording Management",
        description: "List and access meeting recordings",
        example: "Show me recordings from yesterday's meeting"
      },
      {
        name: "Participant Tracking",
        description: "View who attended meetings and when they joined/left",
        example: "Who attended the conference last week?"
      }
    ],
    scopes: [
      "https://www.googleapis.com/auth/meetings.space.created",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });
});

module.exports = router;
