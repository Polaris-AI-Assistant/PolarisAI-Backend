/**
 * Main Agent Controller
 * 
 * HTTP endpoint for interacting with the Main Coordinator Agent.
 * This is the primary entry point for users to send queries that may
 * involve one or multiple specialized agents.
 */

const express = require('express');
const MainAgent = require('./mainAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Main Coordinator Agent
const mainAgent = new MainAgent();

/**
 * POST /agent/query/stream
 * Process natural language queries with streaming response
 * 
 * Request body:
 * {
 *   "query": "schedule a meeting tomorrow and create a document for it",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response: Server-Sent Events (SSE) stream
 */
router.post('/query/stream', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
      });
    }

    console.log(`[MainAgentController] User ${userId} streaming query: "${query}"`);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Send thinking indicator
    res.write(`data: ${JSON.stringify({ type: 'thinking', status: 'start' })}\n\n`);

    try {
      // Process the query through the main agent with streaming
      await mainAgent.processQueryWithStreaming(query, userId, { conversationHistory }, (chunk) => {
        // Send each chunk to the client
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error) {
      console.error('[MainAgentController] Streaming error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: error.message || 'Failed to process query' 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('[MainAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/query
 * Process natural language queries that may involve multiple services
 * (Non-streaming version for backward compatibility)
 * 
 * Request body:
 * {
 *   "query": "schedule a meeting tomorrow and create a document for it",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "query": "schedule a meeting...",
 *   "response": "I've scheduled a meeting...",
 *   "agentsUsed": ["calendar", "docs"],
 *   "toolsUsed": [...],
 *   "analysis": {
 *     "reasoning": "...",
 *     "sequential": true
 *   },
 *   "processingTime": "1234ms",
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        examples: [
          "Schedule a meeting tomorrow at 2pm",
          "Create a document and share it with my team",
          "Show me my GitHub repositories and recent calendar events",
          "Create a feedback form and a spreadsheet to track responses"
        ]
      });
    }

    console.log(`[MainAgentController] User ${userId} query: "${query}"`);

    // Process the query through the main agent
    const result = await mainAgent.processQuery(query, userId, { conversationHistory });

    // Return the result
    res.json(result);

  } catch (error) {
    console.error('[MainAgentController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/info
 * Get information about the main agent and all available specialized agents
 */
router.get('/info', (req, res) => {
  try {
    const agentInfo = mainAgent.getAgentInfo();
    
    res.json({
      success: true,
      ...agentInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Error getting agent info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /agent/examples
 * Get example queries demonstrating single and multi-agent capabilities
 */
router.get('/examples', (req, res) => {
  res.json({
    success: true,
    examples: {
      singleAgent: {
        calendar: [
          "Schedule a team meeting tomorrow at 2pm",
          "Show me my events for this week",
          "Cancel my 3pm meeting today"
        ],
        docs: [
          "Create a new document called 'Project Plan'",
          "Add a heading 'Introduction' to my document",
          "Share my document with john@example.com"
        ],
        forms: [
          "Create a customer feedback form",
          "Add a multiple choice question to my form",
          "Show me the responses to my survey"
        ],
        github: [
          "Show me my GitHub profile",
          "List my repositories",
          "Show recent commits in my main project"
        ],
        meet: [
          "Create a new meeting space",
          "Show me my recent meetings",
          "Get details about my last meeting"
        ],
        sheets: [
          "Create a new spreadsheet called 'Budget 2025'",
          "Add data to cells A1 to C3",
          "Format the header row as bold"
        ]
      },
      multiAgent: [
        {
          query: "Schedule a meeting tomorrow and create a document for the agenda",
          agents: ["calendar", "docs"],
          description: "Creates both a calendar event and a document"
        },
        {
          query: "Create a feedback form and a spreadsheet to track responses",
          agents: ["forms", "sheets"],
          description: "Sets up a form and a tracking spreadsheet"
        },
        {
          query: "Show me my GitHub activity and upcoming calendar events",
          agents: ["github", "calendar"],
          description: "Retrieves information from multiple sources"
        },
        {
          query: "Create a meeting, document the agenda, and share both",
          agents: ["meet", "docs"],
          description: "Multi-step workflow across services"
        },
        {
          query: "Set up a project: create a GitHub repo, schedule kickoff meeting, and make a project doc",
          agents: ["github", "calendar", "docs"],
          description: "Complex multi-agent project setup"
        }
      ],
      tips: [
        "You can ask for multiple things in one query",
        "The agent will automatically determine which services to use",
        "Be specific about dates, times, and other details",
        "You can reference previous items in your query",
        "The agent handles both simple and complex multi-step requests"
      ]
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /agent/health
 * Health check for the main agent system
 */
router.get('/health', (req, res) => {
  try {
    const agentInfo = mainAgent.getAgentInfo();
    const agentCount = Object.keys(agentInfo.specializedAgents).length;

    res.json({
      success: true,
      status: 'healthy',
      mainAgent: 'operational',
      specializedAgents: {
        count: agentCount,
        available: Object.keys(agentInfo.specializedAgents)
      },
      capabilities: [
        'Single agent queries',
        'Multi agent coordination',
        'Parallel execution',
        'Sequential execution',
        'Response aggregation'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[MainAgentController] Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /agent/test
 * Test endpoint for development - allows testing without authentication
 * This should be disabled in production
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', async (req, res) => {
    try {
      const { query, userId, conversationHistory } = req.body;

      if (!query || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Query and userId are required for testing',
          example: {
            query: "show me my calendar events",
            userId: "test-user-id"
          }
        });
      }

      console.log(`[MainAgentController TEST] User ${userId} query: "${query}"`);

      const result = await mainAgent.processQuery(query, userId, { conversationHistory });

      res.json({
        ...result,
        testMode: true,
        warning: 'This endpoint is only available in development mode'
      });

    } catch (error) {
      console.error('[MainAgentController TEST] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Test query failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

module.exports = router;
