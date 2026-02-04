/**
 * Microsoft Agent Controller
 * 
 * Express routes for the Microsoft 365 AI Agent
 * Handles requests to interact with Microsoft apps via natural language
 */

const express = require('express');
const MicrosoftAgent = require('./microsoftAgent');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Initialize the Microsoft Agent
const microsoftAgent = new MicrosoftAgent();

/**
 * POST /api/microsoft/agent
 * Process a natural language query for Microsoft 365
 */
router.post('/agent', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;
    const userId = req.user.id;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log(`[MicrosoftAgent] Processing query for user ${userId}:`, query);

    const result = await microsoftAgent.processQuery(query, userId, {
      conversationHistory: conversationHistory || []
    });

    res.json(result);

  } catch (error) {
    console.error('[MicrosoftAgent] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to process Microsoft query'
    });
  }
});

/**
 * POST /api/microsoft/execute
 * Execute a specific Microsoft function directly
 */
router.post('/execute', authenticateToken, async (req, res) => {
  try {
    const { functionName, params } = req.body;
    const userId = req.user.id;

    if (!functionName) {
      return res.status(400).json({
        success: false,
        error: 'Function name is required'
      });
    }

    console.log(`[MicrosoftAgent] Executing function ${functionName} for user ${userId}`);

    const result = await microsoftAgent.executeFunction(functionName, params || {}, userId);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('[MicrosoftAgent] Execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
