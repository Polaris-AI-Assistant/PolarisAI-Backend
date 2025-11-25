const express = require('express');
const { listForms, getForm, getResponses } = require('./formsService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's forms list
router.get('/forms/list', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageNumber = parseInt(req.query.pageNumber) || 1;
    
    const result = await listForms(user_id, pageSize, pageNumber);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in forms list endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch forms',
      details: error.message
    });
  }
});

// Get a specific form
router.get('/forms/:formId', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { formId } = req.params;
    
    const result = await getForm(user_id, formId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      form: result.form
    });

  } catch (error) {
    console.error('Error in get form endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch form',
      details: error.message
    });
  }
});

// Get form responses
router.get('/forms/:formId/responses', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { formId } = req.params;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageNumber = parseInt(req.query.pageNumber) || 1;
    
    const result = await getResponses(user_id, formId, pageSize, pageNumber);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in get form responses endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch form responses',
      details: error.message
    });
  }
});

module.exports = router;
