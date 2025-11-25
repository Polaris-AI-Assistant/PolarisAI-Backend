/**
 * GitHub AI Agent Controller
 * 
 * This controller provides a single HTTP endpoint to interact with the GitHub AI Agent.
 * It handles authentication, query processing, and returns formatted responses.
 * 
 * Endpoint: POST /api/github/agent
 * 
 * Features:
 * - Single endpoint for all GitHub AI queries
 * - User authentication validation
 * - Natural language query processing
 * - Comprehensive error handling
 * - JSON response formatting
 */

const express = require('express');
const GitHubAgent = require('./githubAgent');
const supabase = require('../supabase/supabaseConnect');

const router = express.Router();

// Initialize the GitHub AI Agent
const githubAgent = new GitHubAgent();

/**
 * Middleware to validate user authentication
 * Extracts user ID from request and validates GitHub connection
 */
async function validateUser(req, res, next) {
  try {
    const { userId, userEmail } = req.body;
    
    // Check if we have either userId or userEmail
    if (!userId && !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Either userId or userEmail is required for authentication',
        code: 'MISSING_USER_ID'
      });
    }

    let actualUserId = userId;

    // If userEmail is provided, find the corresponding userId
    if (!actualUserId && userEmail) {
      try {
        const { data: authData, error: authError } = await supabase
          .from('users') // Assuming you have a users table
          .select('id')
          .eq('email', userEmail)
          .single();

        if (authError || !authData) {
          return res.status(404).json({
            success: false,
            error: 'User not found with the provided email',
            code: 'USER_NOT_FOUND'
          });
        }

        actualUserId = authData.id;
      } catch (error) {
        // If users table doesn't exist, try to use email as userId
        actualUserId = userEmail;
      }
    }

    // Validate that user has GitHub connection
    try {
      const { data: githubData, error: githubError } = await supabase
        .from('github_tokens')
        .select('user_id, github_username')
        .eq('user_id', actualUserId)
        .single();

      if (githubError || !githubData) {
        return res.status(401).json({
          success: false,
          error: 'GitHub account not connected. Please connect your GitHub account first.',
          code: 'GITHUB_NOT_CONNECTED'
        });
      }

      // Add validated user ID to request
      req.validatedUserId = actualUserId;
      req.githubUsername = githubData.github_username;
      
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to validate GitHub connection',
        code: 'VALIDATION_ERROR'
      });
    }

  } catch (error) {
    console.error('User validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during user validation',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Main GitHub AI Agent Endpoint
 * 
 * POST /api/github/agent
 * 
 * Body:
 * {
 *   "query": "Your natural language question about GitHub",
 *   "userId": "user-id" OR "userEmail": "user@example.com"
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "response": "Natural language response",
 *   "data": [...], // Raw GitHub data (optional)
 *   "tools_used": [...], // List of tools executed
 *   "query": "Original query",
 *   "user": { userId, githubUsername },
 *   "timestamp": "ISO timestamp",
 *   "processing_time": number
 * }
 */
router.post('/agent', validateUser, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { query, repoCount } = req.body;
    const userId = req.validatedUserId;
    const githubUsername = req.githubUsername;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        code: 'INVALID_QUERY'
      });
    }

    // Limit query length to prevent abuse
    if (query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Query is too long. Maximum length is 1000 characters.',
        code: 'QUERY_TOO_LONG'
      });
    }

    // Validate repoCount if provided
    let validRepoCount = 10; // Default
    if (repoCount !== undefined) {
      const count = parseInt(repoCount);
      if (!isNaN(count) && count > 0 && count <= 50) {
        validRepoCount = count;
      }
    }

    console.log(`[GitHub Agent] Processing query from ${githubUsername} (${userId}): "${query}" (repoCount: ${validRepoCount})`);

    // Process the query with the AI agent
    const result = await githubAgent.processQuery(query, userId, { 
      repoCount: validRepoCount,
      githubUsername: githubUsername 
    });
    
    const processingTime = Date.now() - startTime;

    // Add additional metadata to the response
    const enhancedResult = {
      ...result,
      user: {
        userId: userId,
        githubUsername: githubUsername
      },
      processing_time: processingTime,
      api_version: '1.0.0'
    };

    // Log successful queries
    console.log(`[GitHub Agent] Query processed successfully in ${processingTime}ms. Tools used: ${result.tools_used?.map(t => t.name).join(', ') || 'None'}`);

    // Return the result
    res.json(enhancedResult);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('[GitHub Agent] Error processing query:', error);

    // Handle specific error types
    let statusCode = 500;
    let errorCode = 'PROCESSING_ERROR';
    let userMessage = 'An error occurred while processing your GitHub query';

    if (error.message.includes('GitHub token')) {
      statusCode = 401;
      errorCode = 'TOKEN_ERROR';
      userMessage = 'Your GitHub token is invalid or expired. Please reconnect your GitHub account.';
    } else if (error.message.includes('OpenAI')) {
      statusCode = 503;
      errorCode = 'AI_SERVICE_ERROR';
      userMessage = 'The AI service is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_ERROR';
      userMessage = 'Rate limit exceeded. Please try again later.';
    }

    res.status(statusCode).json({
      success: false,
      error: userMessage,
      code: errorCode,
      technical_error: error.message,
      processing_time: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health Check Endpoint for GitHub AI Agent
 * GET /api/github/agent/health
 */
router.get('/agent/health', async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    
    // Check agent initialization
    const agentStatus = githubAgent ? 'initialized' : 'not_initialized';
    
    res.json({
      success: true,
      status: 'healthy',
      agent_status: agentStatus,
      openai_configured: openaiConfigured,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get Agent Capabilities Endpoint
 * GET /api/github/agent/capabilities
 */
router.get('/agent/capabilities', (req, res) => {
  try {
    const capabilities = {
      available_tools: [
        {
          name: 'getGithubStatus',
          description: 'Check GitHub connection status',
          parameters: []
        },
        {
          name: 'getGithubProfile',
          description: 'Get GitHub profile information',
          parameters: []
        },
        {
          name: 'getGithubRepos',
          description: 'List user repositories',
          parameters: ['page', 'per_page', 'sort', 'type']
        },
        {
          name: 'getGithubCommits',
          description: 'Get commit history for a repository',
          parameters: ['repo (required)', 'page', 'per_page', 'author', 'since', 'until']
        },
        {
          name: 'getGithubIssues',
          description: 'Get user issues',
          parameters: ['page', 'per_page', 'state', 'filter', 'sort', 'direction']
        },
        {
          name: 'getGithubPullRequests',
          description: 'Get user pull requests',
          parameters: ['page', 'per_page', 'state', 'sort', 'direction', 'repo']
        },
        {
          name: 'getGithubNotifications',
          description: 'Get GitHub notifications',
          parameters: ['page', 'per_page', 'all', 'participating']
        },
        {
          name: 'getGithubRepository',
          description: 'Get detailed repository information',
          parameters: ['owner (required)', 'repo (required)']
        }
      ],
      example_queries: [
        "What's my GitHub connection status?",
        "Show me my GitHub profile",
        "List my recent repositories",
        "Show me commits from my main project",
        "What issues are assigned to me?",
        "Show my open pull requests",
        "Check my GitHub notifications",
        "Tell me about the microsoft/vscode repository"
      ],
      features: [
        "Natural language query processing",
        "Dynamic tool selection",
        "Real-time GitHub data fetching",
        "Multi-tool query support",
        "Error handling with user-friendly messages",
        "Response caching and optimization"
      ]
    };

    res.json({
      success: true,
      capabilities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent capabilities',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test Endpoint with Sample User
 * POST /api/github/agent/test
 * 
 * This endpoint allows testing the agent with the provided user credentials
 */
router.post('/agent/test', async (req, res) => {
  try {
    const testUserId = "263c2f1d-a063-4e68-b7ff-b72447c1c0d0"; // Your provided user ID
    const testQuery = req.body.query || "What's my GitHub connection status?";

    console.log(`[GitHub Agent Test] Testing with query: "${testQuery}"`);

    const result = await githubAgent.processQuery(testQuery, testUserId);

    res.json({
      success: true,
      test_mode: true,
      test_user_id: testUserId,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[GitHub Agent Test] Error:', error);
    res.status(500).json({
      success: false,
      test_mode: true,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;