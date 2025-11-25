// GitHub status and utility routes
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { 
  getGithubStatus, 
  getGithubProfile, 
  getGithubRepos 
} = require('./githubFunctions');

const router = express.Router();

// Check GitHub connection status
router.post('/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const actualUserId = userId || req.user.id;

    const status = await getGithubStatus(actualUserId);
    
    res.json(status);
  } catch (error) {
    console.error('GitHub status check error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

// Get GitHub profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const actualUserId = userId || req.user.id;

    const profile = await getGithubProfile(actualUserId);
    
    res.json({
      success: true,
      profile: profile
    });
  } catch (error) {
    console.error('GitHub profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get GitHub repositories
router.post('/repos', authenticateToken, async (req, res) => {
  try {
    const { userId, options = {} } = req.body;
    const actualUserId = userId || req.user.id;

    const repos = await getGithubRepos(actualUserId, options);
    
    res.json({
      success: true,
      repos: repos
    });
  } catch (error) {
    console.error('GitHub repos fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;