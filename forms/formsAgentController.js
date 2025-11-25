/**
 * Google Forms Agent Controller
 * 
 * HTTP endpoint for interacting with the Google Forms AI Agent.
 * Handles natural language queries and returns AI-processed responses.
 */

const express = require('express');
const FormsAgent = require('./formsAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Forms AI Agent
const formsAgent = new FormsAgent();

/**
 * POST /forms/agent/query
 * Process natural language queries about Google Forms
 * 
 * Request body:
 * {
 *   "query": "create a feedback form with rating questions"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "I've created a feedback form...",
 *   "query": "create a feedback form...",
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
          query: "show me my forms"
        }
      });
    }

    console.log(`[FormsAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with conversation history
    const result = await formsAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[FormsAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /forms/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "Listing Forms",
        queries: [
          "Show me all my forms",
          "List my Google Forms",
          "What forms do I have?",
          "Show me my recent forms"
        ]
      },
      {
        category: "Creating Forms",
        queries: [
          "Create a feedback form",
          "Make a customer satisfaction survey",
          "Create a form for event registration",
          "New form called 'Contact Us'"
        ]
      },
      {
        category: "Getting Responses",
        queries: [
          "Show me responses for form [FORM_ID]",
          "How many responses does my form have?",
          "Get submissions for [FORM_NAME]"
        ]
      },
      {
        category: "Form Details",
        queries: [
          "Show me details of form [FORM_ID]",
          "What questions are in form [FORM_ID]?",
          "Get info about [FORM_NAME]"
        ]
      },
      {
        category: "Updating Forms",
        queries: [
          "Add questions to form [FORM_ID]",
          "Update the title of form [FORM_ID]",
          "Change description of [FORM_NAME]"
        ]
      },
      {
        category: "Publishing",
        queries: [
          "Publish form [FORM_ID]",
          "Close form [FORM_ID] to responses",
          "Stop accepting responses for [FORM_NAME]"
        ]
      }
    ],
    tips: [
      "Be specific about form names or IDs",
      "You can ask follow-up questions in the same conversation",
      "The agent can perform multiple operations at once",
      "If you need a form ID, first ask to list your forms"
    ]
  });
});

/**
 * GET /forms/agent/capabilities
 * Get information about agent capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      tools: [
        {
          name: "listForms",
          description: "List all Google Forms accessible to the user",
          parameters: ["pageSize", "pageNumber"]
        },
        {
          name: "createForm",
          description: "Create a new Google Form",
          parameters: ["title (required)", "description", "questions"]
        },
        {
          name: "getResponses",
          description: "Get responses for a Google Form",
          parameters: ["formId (required)", "pageSize", "pageNumber"]
        },
        {
          name: "getForm",
          description: "Get a specific Google Form by ID",
          parameters: ["formId (required)"]
        },
        {
          name: "updateForm",
          description: "Update an existing Google Form",
          parameters: ["formId (required)", "title", "description", "questions"]
        },
        {
          name: "publishForm",
          description: "Publish or unpublish a Google Form",
          parameters: ["formId (required)", "isPublished", "isAcceptingResponses"]
        }
      ],
      questionTypes: [
        "text - Short text answers",
        "paragraph - Long text answers",
        "multiple_choice - Choose one option",
        "checkbox - Choose multiple options",
        "dropdown - Select from dropdown"
      ],
      features: [
        "Natural language processing",
        "Multi-tool query support",
        "Intelligent question type selection",
        "Automatic form structure suggestions",
        "Pagination support for large datasets",
        "Error handling with helpful messages"
      ]
    }
  });
});

module.exports = router;
