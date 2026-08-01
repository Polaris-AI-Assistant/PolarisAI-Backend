/**
 * Files Routes
 * API endpoints for file upload and management
 */

const express = require('express');
const router = express.Router();
const filesController = require('./filesController');
const fileGenerationController = require('./fileGenerationController');
const authMiddleware = require('../middleware/auth');

// Middleware to verify user authentication (compatible with both methods)
const verifyAuth = (req, res, next) => {
  // Try x-user-id header first (used by chat)
  const userId = req.headers['x-user-id'];
  
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  
  // Fall back to JWT token authentication
  return authMiddleware.authenticateToken(req, res, next);
};

/**
 * File Upload Routes
 */

// Get signed upload URL
router.post('/files/upload-url', verifyAuth, filesController.getUploadUrl);

// Confirm upload completion
router.post('/files/confirm', verifyAuth, filesController.confirmUpload);

// Simple upload endpoints (no background processing required)
router.post('/files/upload-simple', verifyAuth, filesController.uploadSimple);
router.post('/files/confirm-simple', verifyAuth, filesController.confirmSimple);

/**
 * File Management Routes
 */

// List user's files with filtering
router.get('/files', verifyAuth, filesController.listFiles);

// Search files
router.get('/files/search', verifyAuth, filesController.searchFiles);

// Get file statistics
router.get('/files/stats', verifyAuth, filesController.getFileStats);

// Get storage usage
router.get('/files/storage-usage', verifyAuth, filesController.getStorageUsage);

// Get recent files
router.get('/files/recent', verifyAuth, filesController.getRecentFiles);

// Get files for a specific chat
router.get('/files/chat/:chatId', verifyAuth, filesController.getChatFiles);

// Get file details
router.get('/files/:id', verifyAuth, filesController.getFile);

// Download file
router.get('/files/:id/download', verifyAuth, filesController.downloadFile);

// Delete file
router.delete('/files/:id', verifyAuth, filesController.deleteFile);

// Manually trigger file processing
router.post('/files/:id/process', verifyAuth, filesController.reprocessFile);

/**
 * File Generation Routes
 */

// Generate PDF or TXT file from content
router.post('/files/generate', verifyAuth, fileGenerationController.generateFile);

// Generate PDF specifically
router.post('/files/generate-pdf', verifyAuth, fileGenerationController.generatePDFFile);

// Generate TXT file specifically
router.post('/files/generate-txt', verifyAuth, fileGenerationController.generateTextFile);

module.exports = router;
