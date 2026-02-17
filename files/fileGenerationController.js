/**
 * File Generation Controller
 * HTTP request handlers for file generation and download endpoints
 */

const fileGenerationService = require('./fileGenerationService');

/**
 * Generate a file (PDF or TXT) from content
 * POST /api/files/generate
 * Body: {
 *   type: 'pdf' | 'txt',
 *   content: string HTML (for PDF) or plain text (for TXT),
 *   title?: string (optional, default: 'generated-file')
 * }
 */
async function generateFile(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User ID is required',
      });
    }

    const { type, content, title } = req.body;

    // Validate input
    if (!type || !['pdf', 'txt'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: 'File type must be "pdf" or "txt"',
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid content',
        message: 'Content must be a non-empty string',
      });
    }

    if (content.length > 10 * 1024 * 1024) {
      // 10 MB limit for content
      return res.status(400).json({
        success: false,
        error: 'Content too large',
        message: 'Content cannot exceed 10MB',
      });
    }

    // Generate and upload file
    const result = await fileGenerationService.generateAndUploadFile({
      type,
      content,
      title: title || `${type}-${Date.now()}`,
      userId,
    });

    if (!result.success) {
      console.error('[generateFile] Generation failed:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Generation failed',
        message: result.message || 'Failed to generate file',
      });
    }

    console.log(`[generateFile] Successfully generated ${type} for user ${userId}`);

    return res.status(200).json({
      success: true,
      type: result.type,
      filename: result.filename,
      fileSize: result.fileSize,
      fileUrl: result.fileUrl,
      expiresIn: result.expiresIn,
      message: result.message,
    });
  } catch (error) {
    console.error('[generateFile] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  }
}

/**
 * Generate PDF from HTML content
 * POST /api/files/generate-pdf
 * Body: {
 *   htmlContent: string,
 *   title?: string
 * }
 */
async function generatePDFFile(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User ID is required',
      });
    }

    const { htmlContent, title } = req.body;

    if (!htmlContent || typeof htmlContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid content',
        message: 'HTML content must be a non-empty string',
      });
    }

    // Generate and upload PDF
    const result = await fileGenerationService.generateAndUploadFile({
      type: 'pdf',
      content: htmlContent,
      title: title || `pdf-${Date.now()}`,
      userId,
    });

    if (!result.success) {
      console.error('[generatePDFFile] Generation failed:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Generation failed',
        message: result.message || 'Failed to generate PDF',
      });
    }

    console.log(`[generatePDFFile] Successfully generated PDF for user ${userId}`);
    console.log(`[generatePDFFile] Returning fileUrl: ${result.fileUrl}`);

    return res.status(200).json({
      success: true,
      type: 'pdf',
      filename: result.filename,
      fileSize: result.fileSize,
      fileUrl: result.fileUrl,
      expiresIn: result.expiresIn,
      message: 'PDF generated successfully',
    });
  } catch (error) {
    console.error('[generatePDFFile] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to generate PDF',
    });
  }
}

/**
 * Generate TXT file from text content
 * POST /api/files/generate-txt
 * Body: {
 *   textContent: string,
 *   title?: string
 * }
 */
async function generateTextFile(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User ID is required',
      });
    }

    const { textContent, title } = req.body;

    if (!textContent || typeof textContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid content',
        message: 'Text content must be a non-empty string',
      });
    }

    // Generate and upload TXT file
    const result = await fileGenerationService.generateAndUploadFile({
      type: 'txt',
      content: textContent,
      title: title || `txt-${Date.now()}`,
      userId,
    });

    if (!result.success) {
      console.error('[generateTextFile] Generation failed:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Generation failed',
        message: result.message || 'Failed to generate text file',
      });
    }

    console.log(`[generateTextFile] Successfully generated TXT for user ${userId}`);
    console.log(`[generateTextFile] Returning fileUrl: ${result.fileUrl}`);

    return res.status(200).json({
      success: true,
      type: 'txt',
      filename: result.filename,
      fileSize: result.fileSize,
      fileUrl: result.fileUrl,
      expiresIn: result.expiresIn,
      message: 'Text file generated successfully',
    });
  } catch (error) {
    console.error('[generateTextFile] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to generate text file',
    });
  }
}

module.exports = {
  generateFile,
  generatePDFFile,
  generateTextFile,
};
