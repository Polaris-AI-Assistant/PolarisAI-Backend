const express = require('express');
const { listSpreadsheets, getSpreadsheet, getValues } = require('./sheetsService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user's spreadsheets list
router.get('/sheets/list', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageNumber = parseInt(req.query.pageNumber) || 1;
    
    const result = await listSpreadsheets(user_id, pageSize, pageNumber);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in sheets list endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spreadsheets',
      details: error.message
    });
  }
});

// Get a specific spreadsheet
router.get('/sheets/:spreadsheetId', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { spreadsheetId } = req.params;
    
    const result = await getSpreadsheet(user_id, spreadsheetId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      spreadsheet: result.spreadsheet
    });

  } catch (error) {
    console.error('Error in get spreadsheet endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spreadsheet',
      details: error.message
    });
  }
});

// Get values from a spreadsheet range
router.get('/sheets/:spreadsheetId/values', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { spreadsheetId } = req.params;
    const range = req.query.range;
    
    if (!range) {
      return res.status(400).json({
        success: false,
        error: 'Range parameter is required (e.g., ?range=Sheet1!A1:B10)'
      });
    }
    
    const result = await getValues(user_id, spreadsheetId, range);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in get spreadsheet values endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spreadsheet values',
      details: error.message
    });
  }
});

module.exports = router;
