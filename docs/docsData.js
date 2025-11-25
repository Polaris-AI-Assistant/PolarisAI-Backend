const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const docsService = require('./docsService');

/**
 * @route   GET /docs/list
 * @desc    List all user's Google Documents
 * @access  Protected
 */
router.get('/docs/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pageSize = parseInt(req.query.pageSize) || 50;

    const result = await docsService.listDocuments(userId, { pageSize });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * @route   GET /docs/:documentId
 * @desc    Get document metadata
 * @access  Protected
 */
router.get('/docs/:documentId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const result = await docsService.getDocumentMetadata(userId, documentId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting document metadata:', error);
    res.status(500).json({ error: 'Failed to get document metadata' });
  }
});

/**
 * @route   GET /docs/:documentId/content
 * @desc    Read document content
 * @access  Protected
 */
router.get('/docs/:documentId/content', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    const result = await docsService.readDocument(userId, documentId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error reading document:', error);
    res.status(500).json({ error: 'Failed to read document' });
  }
});

module.exports = router;
