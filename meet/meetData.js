const express = require('express');
const { 
  createMeetingSpace, 
  getMeetingSpace, 
  listConferences,
  getConference,
  listRecordings,
  getRecording 
} = require('./meetService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create a new meeting space
router.post('/meet/create', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    
    const result = await createMeetingSpace(user_id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in create meeting endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create meeting',
      details: error.message
    });
  }
});

// Get a specific meeting space
router.get('/meet/space/:spaceName(*)', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { spaceName } = req.params;
    
    // spaceName should be in format: spaces/{space_id}
    const fullSpaceName = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
    
    const result = await getMeetingSpace(user_id, fullSpaceName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in get meeting space endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meeting space',
      details: error.message
    });
  }
});

// List conferences in a space
router.get('/meet/space/:spaceName(*)/conferences', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { spaceName } = req.params;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageToken = req.query.pageToken || null;
    
    // spaceName should be in format: spaces/{space_id}
    const fullSpaceName = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
    
    const result = await listConferences(user_id, fullSpaceName, pageSize, pageToken);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in list conferences endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list conferences',
      details: error.message
    });
  }
});

// Get a specific conference
router.get('/meet/conference/:conferenceName(*)', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { conferenceName } = req.params;
    
    // conferenceName should be in format: conferenceRecords/{conference_id}
    const fullConferenceName = conferenceName.startsWith('conferenceRecords/') 
      ? conferenceName 
      : `conferenceRecords/${conferenceName}`;
    
    const result = await getConference(user_id, fullConferenceName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in get conference endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conference',
      details: error.message
    });
  }
});

// List recordings for a conference
router.get('/meet/conference/:conferenceName(*)/recordings', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { conferenceName } = req.params;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const pageToken = req.query.pageToken || null;
    
    // conferenceName should be in format: conferenceRecords/{conference_id}
    const fullConferenceName = conferenceName.startsWith('conferenceRecords/') 
      ? conferenceName 
      : `conferenceRecords/${conferenceName}`;
    
    const result = await listRecordings(user_id, fullConferenceName, pageSize, pageToken);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in list recordings endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list recordings',
      details: error.message
    });
  }
});

// Get a specific recording
router.get('/meet/recording/:recordingName(*)', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { recordingName } = req.params;
    
    const result = await getRecording(user_id, recordingName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in get recording endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recording',
      details: error.message
    });
  }
});

module.exports = router;
