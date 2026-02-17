/**
 * File Generation Service
 * Handles PDF and TXT file generation from AI-generated or user-provided content
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const supabaseAdmin = require('../supabase/supabaseAdmin');
const { v4: uuidv4 } = require('uuid');

const TEMP_DIR = os.tmpdir();
const STORAGE_BUCKET = 'user-uploads';
const SIGNED_URL_EXPIRY = 600; // 10 minutes in seconds

/**
 * Generate PDF from HTML content using Puppeteer
 * @param {string} htmlContent - HTML content to convert to PDF
 * @param {string} filename - Filename for the PDF
 * @returns {Promise<Buffer>} - PDF as buffer
 */
async function generatePDF(htmlContent, filename = 'document.pdf') {
  let browser;
  const tempFilePath = path.join(TEMP_DIR, `${uuidv4()}.pdf`);

  try {
    console.log(`[generatePDF] Starting PDF generation - filename: ${filename}, contentLength: ${htmlContent?.length || 0}`);
    
    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Disable /dev/shm usage to reduce memory
      ],
    });

    console.log('[generatePDF] Browser launched successfully');

    const page = await browser.newPage();

    // Create lightweight HTML template with inline CSS
    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 40px;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #222;
      margin-top: 24px;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    h1 { font-size: 28px; }
    h2 { font-size: 24px; }
    h3 { font-size: 20px; }
    h4 { font-size: 16px; }
    p {
      margin-bottom: 12px;
      line-height: 1.8;
    }
    ul, ol {
      margin-left: 24px;
      margin-bottom: 12px;
    }
    li {
      margin-bottom: 8px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.95em;
    }
    pre {
      background: #f4f4f4;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 12px;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ccc;
      padding-left: 16px;
      margin: 12px 0;
      color: #666;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f9f9f9;
      font-weight: bold;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Set content and generate PDF
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    console.log('[generatePDF] HTML content set successfully');
    
    await page.pdf({
      path: tempFilePath,
      format: 'A4',
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      printBackground: true,
    });
    console.log('[generatePDF] PDF file written to disk successfully');

    // Read PDF as buffer
    const pdfBuffer = fs.readFileSync(tempFilePath);
    console.log(`[generatePDF] PDF buffer created - size: ${pdfBuffer.length} bytes`);

    return pdfBuffer;
  } catch (error) {
    console.error('[generatePDF] Error during PDF generation:', {
      message: error.message,
      stack: error.stack,
      filename: filename,
      contentLength: htmlContent?.length || 0,
      tempFilePath: tempFilePath,
    });
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    // Cleanup
    if (browser) {
      try {
        await browser.close();
        console.log('[generatePDF] Browser closed successfully');
      } catch (closeError) {
        console.error('[generatePDF] Error closing browser:', closeError.message);
      }
    }
    // Delete temp file if it exists
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('[generatePDF] Temp file deleted');
      } catch (deleteError) {
        console.error('[generatePDF] Error deleting temp file:', deleteError.message);
      }
    }
  }
}

/**
 * Generate TXT file from text content
 * @param {string} textContent - Text content for the file
 * @param {string} filename - Filename for the text file
 * @returns {Promise<Buffer>} - Text file as buffer
 */
async function generateTextFile(textContent, filename = 'document.txt') {
  try {
    // Ensure content is string and properly encoded
    const content = typeof textContent === 'string' ? textContent : String(textContent);
    
    // Convert to buffer
    const buffer = Buffer.from(content, 'utf-8');

    return buffer;
  } catch (error) {
    console.error('[generateTextFile] Error:', error);
    throw new Error(`Failed to generate text file: ${error.message}`);
  }
}

/**
 * Upload generated file to Supabase Storage
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Filename to store as
 * @param {string} userId - User ID for storage path
 * @param {string} fileType - File type ('pdf' or 'txt')
 * @returns {Promise<{success: boolean, fileUrl: string, filePath: string}>}
 */
async function uploadToSupabase(fileBuffer, filename, userId, fileType = 'pdf') {
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer is empty');
    }

    console.log(`[uploadToSupabase] Starting upload - fileType: ${fileType}, filename: ${filename}, bufferSize: ${fileBuffer.length}, userId: ${userId}`);

    // Create unique storage path
    const timestamp = Date.now();
    const randomSuffix = uuidv4().slice(0, 8);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `generated-files/${userId}/${fileType}/${timestamp}_${randomSuffix}_${sanitizedFilename}`;

    console.log(`[uploadToSupabase] Storage path: ${storagePath}`);

    // Upload to Supabase Storage (using Admin client to bypass RLS)
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: fileType === 'pdf' ? 'application/pdf' : 'text/plain',
        upsert: false,
      });

    if (error) {
      console.error('[uploadToSupabase] Upload error:', error);
      throw error;
    }

    if (!data || !data.path) {
      throw new Error('Upload response missing path');
    }

    console.log(`[uploadToSupabase] Uploaded successfully: ${data.path}`);

    // Generate signed URL with expiry (10 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    if (signedUrlError) {
      console.error('[uploadToSupabase] Signed URL error:', signedUrlError);
      throw signedUrlError;
    }

    if (!signedUrlData || !signedUrlData.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    const signedUrl = signedUrlData.signedUrl;
    console.log(`[uploadToSupabase] Signed URL generated successfully`);
    console.log(`[uploadToSupabase] Signed URL scheme: ${new URL(signedUrl).protocol}`);
    console.log(`[uploadToSupabase] Signed URL hostname: ${new URL(signedUrl).hostname}`);
    console.log(`[uploadToSupabase] Signed URL expires in: ${SIGNED_URL_EXPIRY} seconds`);

    return {
      success: true,
      fileUrl: signedUrl,
      filePath: storagePath,
      expiresIn: SIGNED_URL_EXPIRY,
    };
  } catch (error) {
    console.error('[uploadToSupabase] Error:', error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }
}

/**
 * Generate and upload file in one operation
 * @param {Object} options - Generation options
 * @param {string} options.type - File type ('pdf' or 'txt')
 * @param {string} options.content - Content to generate
 * @param {string} options.title - File title/filename
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} - Upload result with signed URL
 */
async function generateAndUploadFile({
  type = 'pdf',
  content,
  title = 'generated-file',
  userId,
}) {
  try {
    if (!type || !['pdf', 'txt'].includes(type)) {
      throw new Error('Invalid file type. Must be "pdf" or "txt"');
    }

    if (!content) {
      throw new Error('Content is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[generateAndUploadFile] Starting file generation - type: ${type}, userId: ${userId}, contentLength: ${content.length}, title: ${title}`);

    // Generate file
    let fileBuffer;
    let filename;

    if (type === 'pdf') {
      filename = `${title}.pdf`;
      console.log('[generateAndUploadFile] Calling generatePDF...');
      fileBuffer = await generatePDF(content, filename);
      console.log(`[generateAndUploadFile] PDF generated successfully - buffer size: ${fileBuffer.length} bytes`);
    } else if (type === 'txt') {
      filename = `${title}.txt`;
      console.log('[generateAndUploadFile] Calling generateTextFile...');
      fileBuffer = await generateTextFile(content, filename);
      console.log(`[generateAndUploadFile] Text file generated successfully - buffer size: ${fileBuffer.length} bytes`);
    }

    console.log(`[generateAndUploadFile] Uploading to Supabase - filename: ${filename}`);
    // Upload to Supabase
    const uploadResult = await uploadToSupabase(fileBuffer, filename, userId, type);
    console.log(`[generateAndUploadFile] Upload completed successfully - fileUrl: ${uploadResult.fileUrl}`);

    return {
      success: true,
      type,
      filename,
      fileSize: fileBuffer.length,
      fileUrl: uploadResult.fileUrl,
      filePath: uploadResult.filePath,
      expiresIn: uploadResult.expiresIn,
      message: `${type.toUpperCase()} file generated and ready for download`,
    };
  } catch (error) {
    console.error('[generateAndUploadFile] Error during file generation:', {
      message: error.message,
      stack: error.stack,
      type: type,
      title: title,
      userId: userId,
      contentLength: content?.length || 0,
    });
    return {
      success: false,
      error: error.message,
      message: `Failed to generate ${type.toUpperCase()} file: ${error.message}`,
    };
  }
}

module.exports = {
  generatePDF,
  generateTextFile,
  uploadToSupabase,
  generateAndUploadFile,
};
