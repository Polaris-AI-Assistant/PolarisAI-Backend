/**
 * Web Search Agent Controller (Enhanced with Error Handling)
 * 
 * HTTP endpoint for interacting with the Web Search AI Agent.
 * Handles natural language queries for web searches with comprehensive error handling.
 * 
 * ENHANCEMENTS:
 * - Centralized error handling
 * - Input validation
 * - Rate limiting
 * - Retry logic for failed searches
 * - Better error messages
 */

const express = require('express');
const WebSearchAgent = require('./webSearchAgent');
const { authenticateToken, rateLimit } = require('../middleware/enhancedAuth');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { validateLength, validateRequired } = require('../utils/errors/validationUtils');
const { WebSearchErrorHandler } = require('../utils/errors/serviceErrorHandlers');
const { ErrorHandler } = require('../utils/errors/ErrorHandler');
const { PLATFORM_ERRORS } = require('../utils/errors/errorTypes');

const router = express.Router();

// Initialize the Web Search AI Agent
const webSearchAgent = new WebSearchAgent();

/**
 * POST /websearch/agent/query
 * Process natural language queries for web searches
 * 
 * Request body:
 * {
 *   "query": "search for latest AI news",
 *   "conversationHistory": [] // optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "response": "Here are the latest AI news...",
 *   "query": "search for latest AI news",
 *   "tools_used": [...],
 *   "timestamp": "2025-01-01T00:00:00.000Z"
 * }
 */
router.post('/agent/query', 
  authenticateToken,
  rateLimit(100, 60000), // 100 requests per minute
  asyncHandler(async (req, res) => {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    // Validate input
    validateRequired(req.body, ['query']);
    validateLength(query, 'query', 1, 1000);

    console.log(`[WebSearchAgentController] User ${userId} query: "${query}"`);

    // Process the query through the agent with error handling
    const result = await WebSearchErrorHandler.wrapAsync(async () => {
      return await webSearchAgent.processQuery(query, userId, { conversationHistory });
    });

    // Return the result
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * GET /websearch/agent/examples
 * Get example queries that users can try
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        category: "General Web Search",
        queries: [
          "Search for information about artificial intelligence",
          "Find the best restaurants in New York",
          "What is quantum computing?",
          "Search for Python programming tutorials",
          "Find information about climate change"
        ]
      },
      {
        category: "News Search",
        queries: [
          "Find latest news about technology",
          "Search for recent news about SpaceX",
          "What's the latest news on AI developments?",
          "Find news about the stock market today",
          "Search for breaking news"
        ]
      },
      {
        category: "Image Search",
        queries: [
          "Find images of the Eiffel Tower",
          "Search for pictures of golden retrievers",
          "Show me images of modern architecture",
          "Find photos of the northern lights",
          "Search for images of healthy food"
        ]
      },
      {
        category: "Research & Learning",
        queries: [
          "Search for information about machine learning algorithms",
          "Find resources to learn React",
          "What are the benefits of meditation?",
          "Search for information about renewable energy",
          "Find tutorials on data science"
        ]
      },
      {
        category: "Current Events",
        queries: [
          "What's happening in the world today?",
          "Find news about recent scientific discoveries",
          "Search for updates on global events",
          "What are the trending topics right now?",
          "Find information about recent tech announcements"
        ]
      }
    ],
    tips: [
      "Be specific in your search queries for better results",
      "Use keywords that describe what you're looking for",
      "For news, mention 'latest' or 'recent' to get current information",
      "For images, describe what you want to see",
      "You can ask follow-up questions to refine your search"
    ],
    supported_features: [
      "General web search",
      "News article search",
      "Image search",
      "Localized search results",
      "Multi-language support"
    ]
  });
});

/**
 * GET /websearch/agent/capabilities
 * Get detailed information about the agent's capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    capabilities: {
      web_search: {
        description: "Search the web for information, websites, and articles",
        parameters: [
          "query (required): Search query string",
          "num (optional): Number of results (1-100, default: 10)",
          "location (optional): Location for localized results",
          "gl (optional): Country code (e.g., 'us', 'in')",
          "hl (optional): Language code (e.g., 'en', 'hi')"
        ],
        examples: [
          "Search for Python tutorials",
          "Find information about machine learning",
          "What is blockchain technology?"
        ]
      },
      news_search: {
        description: "Search for recent news articles and current events",
        parameters: [
          "query (required): News search query",
          "num (optional): Number of results (default: 10)",
          "location (optional): Location for localized news"
        ],
        examples: [
          "Latest AI news",
          "Recent developments in space exploration",
          "Breaking news today"
        ]
      },
      image_search: {
        description: "Search for images and visual content",
        parameters: [
          "query (required): Image search query",
          "num (optional): Number of results (default: 10)"
        ],
        examples: [
          "Images of sunset",
          "Pictures of modern architecture",
          "Photos of wildlife"
        ]
      }
    },
    features: [
      "Natural language understanding",
      "Multi-language support",
      "Localized search results",
      "Answer boxes and knowledge graphs",
      "Related searches suggestions",
      "People Also Ask questions",
      "Automatic retry on failures",
      "Rate limiting protection",
      "Input validation"
    ],
    limitations: [
      "Requires active internet connection",
      "Subject to Serper API rate limits",
      "Search results depend on Google's index",
      "Maximum 100 requests per minute per user"
    ]
  });
});

/**
 * GET /websearch/agent/status
 * Check if the web search agent is operational
 */
router.get('/agent/status', asyncHandler(async (req, res) => {
  const hasApiKey = !!process.env.SERPER_API_KEY;
  
  if (!hasApiKey) {
    throw ErrorHandler.create({
      code: 'CONFIG_ERROR',
      message: 'SERPER_API_KEY not configured',
      userMessage: 'Web search is not configured. Please contact support.',
      httpStatus: 503,
      retryable: false
    });
  }
  
  res.json({
    success: true,
    status: 'operational',
    message: 'Web search agent is ready to search',
    features: {
      webSearch: true,
      newsSearch: true,
      imageSearch: true,
      rateLimiting: true,
      errorHandling: true
    },
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;
