const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const docsAgent = require('./docsAgent');

/**
 * @route   POST /agent/query
 * @desc    Process natural language query with Docs AI agent
 * @access  Protected
 */
router.post('/agent/query', authenticateToken, async (req, res) => {
  try {
    const { query, conversationHistory, model, temperature } = req.body;
    const userId = req.user.id;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required and must be a non-empty string' });
    }

    const options = {};
    if (conversationHistory) options.conversationHistory = conversationHistory;
    if (model) options.model = model;
    if (temperature !== undefined) options.temperature = temperature;

    const result = await docsAgent.processQuery(query, userId, options);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      response: result.response,
      toolCalls: result.toolCalls,
      conversationHistory: result.conversationHistory
    });
  } catch (error) {
    console.error('Error in agent query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

/**
 * @route   GET /agent/examples
 * @desc    Get example queries for the Docs agent
 * @access  Protected
 */
router.get('/agent/examples', authenticateToken, (req, res) => {
  try {
    const examples = docsAgent.getExamples();
    res.json({ success: true, examples });
  } catch (error) {
    console.error('Error getting examples:', error);
    res.status(500).json({ error: 'Failed to get examples' });
  }
});

/**
 * @route   GET /agent/capabilities
 * @desc    Get list of agent capabilities and tools
 * @access  Protected
 */
router.get('/agent/capabilities', authenticateToken, (req, res) => {
  try {
    const capabilities = docsAgent.getCapabilities();
    res.json({ success: true, capabilities });
  } catch (error) {
    console.error('Error getting capabilities:', error);
    res.status(500).json({ error: 'Failed to get capabilities' });
  }
});

module.exports = router;
