/**
 * Deep Research Agent Controller
 * 
 * HTTP endpoints for the Deep Research Agent with WebSocket support
 * for real-time progress updates.
 */

const express = require('express');
const ResearchAgent = require('./researchAgent');
const { authenticateToken } = require('../middleware/auth');
const { getIO } = require('../socket/socketManager');

const router = express.Router();

// Initialize Research Agent
const researchAgent = new ResearchAgent();

/**
 * POST /research/agent/query
 * Conduct deep research with streaming progress updates
 * 
 * Request body:
 * {
 *   "query": "What are the best AI models for startups in 2026?",
 *   "socketId": "optional-socket-id-for-progress-updates"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "answer": "markdown formatted answer",
 *   "sources": [{ id, title, url }],
 *   "steps": ["step1", "step2", ...],
 *   "followUpQuestions": ["q1", "q2", "q3"],
 *   "metadata": { ... }
 * }
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, socketId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a non-empty string',
        example: {
          query: 'What are the best AI models for startups in 2026?'
        }
      });
    }

    console.log(`[ResearchController] User ${userId} query: "${query}"`);

    // Setup progress callback
    const io = getIO();
    const onProgress = (update) => {
      if (socketId && io) {
        io.to(socketId).emit('research:progress', {
          userId,
          query,
          ...update,
          timestamp: new Date().toISOString()
        });
        
        // Emit plan separately when ready
        if (update.step === 'plan_ready' && update.plan) {
          io.to(socketId).emit('research:plan', {
            userId,
            query,
            plan: update.plan,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    // Process research query
    const result = await researchAgent.processQuery(query, onProgress);

    // Return result
    res.json(result);

  } catch (error) {
    console.error('[ResearchController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process research query',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /research/agent/capabilities
 * Get agent capabilities and information
 */
router.get('/agent/capabilities', (req, res) => {
  res.json({
    success: true,
    ...researchAgent.getCapabilities()
  });
});

/**
 * GET /research/agent/examples
 * Get example queries
 */
router.get('/agent/examples', (req, res) => {
  res.json({
    success: true,
    examples: researchAgent.getExamples(),
    tips: [
      'Be specific in your research questions',
      'Ask about current topics for latest information',
      'Use comparative queries to understand differences',
      'Request analysis for deeper insights',
      'Follow-up questions help refine research'
    ]
  });
});

/**
 * GET /research/agent/status
 * Check if research agent is operational
 */
router.get('/agent/status', (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_AI_API_KEY;
  const hasSerperKey = !!process.env.SERPER_API_KEY;
  
  const isOperational = hasGeminiKey && hasSerperKey;
  
  res.json({
    success: true,
    status: isOperational ? 'operational' : 'configuration_required',
    checks: {
      gemini_api: hasGeminiKey ? 'configured' : 'missing',
      serper_api: hasSerperKey ? 'configured' : 'missing'
    },
    message: isOperational 
      ? 'Deep Research Agent is ready' 
      : 'Missing required API keys',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /research/agent/clear-cache
 * Clear research content cache
 */
router.post('/agent/clear-cache', authenticateToken, (req, res) => {
  try {
    researchAgent.clearCache();
    res.json({
      success: true,
      message: 'Research cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
