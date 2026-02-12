/**
 * Files Controller
 * HTTP request handlers for file upload and management endpoints
 */

const filesService = require('./filesService');
const filesData = require('./filesData');
const { queueFileForProcessing } = require('./fileProcessing');
const supabaseAdmin = require('../supabase/supabaseAdmin');

/**
 * Extract text from uploaded file (inline, without Redis)
 * Supports PDF, TXT, and common text-based files
 */
async function extractTextFromFile(fileId, filename, fileType) {
  try {
    // Get file from database to find storage path
    const { data: file, error } = await require('../supabase/supabaseConnect')
      .from('files')
      .select('storage_path, mime_type')
      .eq('id', fileId)
      .single();

    if (error || !file) return null;

    // Download file content from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('user-uploads')
      .download(file.storage_path);

    if (downloadError || !fileData) {
      console.log('[extractText] Download error:', downloadError?.message);
      return null;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const mimeType = file.mime_type;

    // Extract text based on MIME type
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    }

    // Plain text, code, markdown, JSON, XML, CSV, etc.
    if (mimeType.startsWith('text/') || 
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/x-yaml' ||
        mimeType === 'application/csv') {
      return buffer.toString('utf-8');
    }

    // For images and other binary files, no text extraction
    console.log(`[extractText] No text extraction for MIME type: ${mimeType}`);
    return null;

  } catch (error) {
    console.error('[extractText] Error:', error.message);
    return null;
  }
}

/**
 * POST /api/files/upload-url
 * Get signed upload URL for direct client upload
 */
async function getUploadUrl(req, res) {
  try {
    const { filename, mimeType, size, chatId, messageId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!filename || !mimeType || !size) {
      return res.status(400).json({ 
        error: 'Missing required fields: filename, mimeType, size' 
      });
    }

    // Create upload URL
    const result = await filesService.createUploadUrl(
      userId,
      filename,
      mimeType,
      size,
      chatId,
      messageId
    );

    return res.json(result);

  } catch (error) {
    console.error('Error in getUploadUrl:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create upload URL' 
    });
  }
}

/**
 * POST /api/files/confirm
 * Confirm upload completion and trigger processing
 */
async function confirmUpload(req, res) {
  try {
    const { fileId } = req.body;
    const userId = req.user.id;

    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId' });
    }

    // Confirm upload
    const result = await filesService.confirmUpload(userId, fileId);

    // Queue for background processing
    await queueFileForProcessing(fileId);

    return res.json(result);

  } catch (error) {
    console.error('Error in confirmUpload:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to confirm upload' 
    });
  }
}

/**
 * POST /api/files/upload-simple
 * Simple upload without background processing (for when Redis is not available)
 */
async function uploadSimple(req, res) {
  try {
    const { filename, mimeType, size, chatId, messageId } = req.body;
    const userId = req.user.id;

    if (!filename || !mimeType || !size) {
      return res.status(400).json({ 
        error: 'Missing required fields: filename, mimeType, size' 
      });
    }

    const result = await filesService.createUploadUrl(
      userId,
      filename,
      mimeType,
      size,
      chatId,
      messageId
    );

    return res.json(result);

  } catch (error) {
    console.error('Error in uploadSimple:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create upload URL' 
    });
  }
}

/**
 * POST /api/files/confirm-simple
 * Confirm upload without queuing for processing
 */
async function confirmSimple(req, res) {
  try {
    const { fileId } = req.body;
    const userId = req.user.id;

    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId' });
    }

    const result = await filesService.confirmUpload(userId, fileId);

    // Try to extract text from the file inline (without Redis queue)
    let extractedText = null;
    try {
      extractedText = await extractTextFromFile(fileId, result.originalFilename, result.fileType);
    } catch (extractError) {
      console.log('[confirmSimple] Text extraction failed (non-critical):', extractError.message);
    }

    // Mark as ready immediately with extracted text
    const updates = { status: 'ready' };
    if (extractedText) {
      updates.extracted_text = extractedText;
      console.log(`[confirmSimple] Extracted ${extractedText.length} chars of text from ${result.originalFilename}`);
    }
    await filesService.updateFileMetadata(fileId, updates);

    return res.json({ ...result, status: 'ready' });

  } catch (error) {
    console.error('Error in confirmSimple:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to confirm upload' 
    });
  }
}

/**
 * GET /api/files
 * List user's files with filtering and pagination
 */
async function listFiles(req, res) {
  try {
    const { chatId, fileType, status, limit, offset } = req.query;
    const userId = req.user.id;

    const options = {
      chatId: chatId || null,
      fileType: fileType || null,
      status: status || null,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    };

    const result = await filesService.listUserFiles(userId, options);

    return res.json(result);

  } catch (error) {
    console.error('Error in listFiles:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch files' 
    });
  }
}

/**
 * GET /api/files/:id
 * Get file details by ID
 */
async function getFile(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const file = await filesService.getFileById(userId, id);

    return res.json(file);

  } catch (error) {
    console.error('Error in getFile:', error);
    return res.status(404).json({ 
      error: error.message || 'File not found' 
    });
  }
}

/**
 * DELETE /api/files/:id
 * Delete file from storage and database
 */
async function deleteFile(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await filesService.deleteFile(userId, id);

    return res.json({ success: true, message: 'File deleted successfully' });

  } catch (error) {
    console.error('Error in deleteFile:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to delete file' 
    });
  }
}

/**
 * GET /api/files/:id/download
 * Download file
 */
async function downloadFile(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data, filename, mimeType } = await filesService.downloadFile(userId, id);

    // Convert blob to buffer
    const buffer = Buffer.from(await data.arrayBuffer());

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error in downloadFile:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to download file' 
    });
  }
}

/**
 * GET /api/files/search
 * Search files by text content
 */
async function searchFiles(req, res) {
  try {
    const { q, limit, offset } = req.query;
    const userId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const options = {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    };

    const result = await filesService.searchFiles(userId, q, options);

    return res.json(result);

  } catch (error) {
    console.error('Error in searchFiles:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to search files' 
    });
  }
}

/**
 * GET /api/files/stats
 * Get user's file statistics and storage usage
 */
async function getFileStats(req, res) {
  try {
    const userId = req.user.id;

    const stats = await filesData.getUserFileStats(userId);

    return res.json(stats);

  } catch (error) {
    console.error('Error in getFileStats:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get file statistics' 
    });
  }
}

/**
 * GET /api/files/storage-usage
 * Get user's storage usage
 */
async function getStorageUsage(req, res) {
  try {
    const userId = req.user.id;

    const usage = await filesService.getUserStorageUsage(userId);

    return res.json(usage);

  } catch (error) {
    console.error('Error in getStorageUsage:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get storage usage' 
    });
  }
}

/**
 * GET /api/files/chat/:chatId
 * Get all files for a specific chat
 */
async function getChatFiles(req, res) {
  try {
    const { chatId } = req.params;
    const { limit } = req.query;

    const files = await filesData.getFilesByChatId(chatId, parseInt(limit) || 50);

    return res.json({ files });

  } catch (error) {
    console.error('Error in getChatFiles:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get chat files' 
    });
  }
}

/**
 * GET /api/files/recent
 * Get recent files for user
 */
async function getRecentFiles(req, res) {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const files = await filesData.getRecentFiles(userId, parseInt(limit) || 10);

    return res.json({ files });

  } catch (error) {
    console.error('Error in getRecentFiles:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get recent files' 
    });
  }
}

/**
 * POST /api/files/:id/process
 * Manually trigger file processing (in case of failure)
 */
async function reprocessFile(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify file ownership
    const file = await filesService.getFileById(userId, id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update status to processing
    await filesData.updateFile(id, { status: 'processing' });

    // Queue for processing
    await queueFileForProcessing(id);

    return res.json({ 
      success: true, 
      message: 'File queued for processing' 
    });

  } catch (error) {
    console.error('Error in reprocessFile:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to reprocess file' 
    });
  }
}

module.exports = {
  getUploadUrl,
  confirmUpload,
  uploadSimple,
  confirmSimple,
  listFiles,
  getFile,
  deleteFile,
  downloadFile,
  searchFiles,
  getFileStats,
  getStorageUsage,
  getChatFiles,
  getRecentFiles,
  reprocessFile
};
