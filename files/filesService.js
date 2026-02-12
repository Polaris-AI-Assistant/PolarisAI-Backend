/**
 * Files Service
 * Handles business logic for file upload, storage, and processing
 */

const crypto = require('crypto');
const supabase = require('../supabase/supabaseConnect');
const supabaseAdmin = require('../supabase/supabaseAdmin'); // Admin client for storage (bypasses RLS)

/**
 * Allowed MIME types for upload
 */
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  // Video
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  // Code/Text
  'application/json',
  'application/xml',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript'
];

/**
 * File size limits by type (in bytes)
 */
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10 MB
  document: 50 * 1024 * 1024,   // 50 MB
  audio: 25 * 1024 * 1024,      // 25 MB
  video: 100 * 1024 * 1024,     // 100 MB (Note: your bucket is 50MB, adjust as needed)
  other: 5 * 1024 * 1024        // 5 MB
};

/**
 * Determine file type from MIME type
 */
function getFileType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType.includes('pdf') || 
    mimeType.includes('document') || 
    mimeType.includes('spreadsheet') ||
    mimeType.includes('text/')
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Validate file type
 */
function validateFileType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Validate file extension
 */
function validateFileExtension(filename) {
  const allowedExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic',
    'pdf', 'txt', 'md', 'docx', 'xlsx', 'csv',
    'mp3', 'wav', 'ogg', 'm4a',
    'mp4', 'mov', 'avi', 'webm',
    'json', 'xml', 'html', 'css', 'js', 'py'
  ];

  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Sanitize filename to prevent security issues
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace special chars with underscore
    .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
    .replace(/^[._]+/, '')             // Remove leading dots/underscores
    .toLowerCase()
    .substring(0, 255);                // Limit length
}

/**
 * Generate unique filename with user folder structure
 */
function generateUniqueFilename(userId, originalFilename) {
  const fileExt = originalFilename.split('.').pop();
  const sanitized = sanitizeFilename(originalFilename.replace(`.${fileExt}`, ''));
  const timestamp = Date.now();
  const uniqueId = crypto.randomUUID();
  
  // Format: userId/timestamp-uniqueId-sanitizedName.ext
  return `${userId}/${timestamp}-${uniqueId}-${sanitized}.${fileExt}`;
}

/**
 * Create signed upload URL for direct client upload
 */
async function createUploadUrl(userId, filename, mimeType, size, chatId = null, messageId = null) {
  try {
    // Validate file type
    if (!validateFileType(mimeType)) {
      throw new Error('File type not allowed');
    }

    // Validate file extension
    if (!validateFileExtension(filename)) {
      throw new Error('File extension not allowed');
    }

    // Determine file type
    const fileType = getFileType(mimeType);

    // Check file size limit
    const sizeLimit = FILE_SIZE_LIMITS[fileType];
    if (size > sizeLimit) {
      throw new Error(`File size exceeds limit for ${fileType} files (max ${(sizeLimit / (1024 * 1024)).toFixed(0)}MB)`);
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(userId, filename);

    // Create signed upload URL from Supabase Storage (using admin client to bypass RLS)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('user-uploads')
      .createSignedUploadUrl(uniqueFilename);

    if (uploadError) {
      console.error('Supabase upload URL error:', uploadError);
      throw new Error('Failed to create upload URL');
    }

    // Create file record in database
    const { data: file, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: userId,
        chat_id: chatId,
        message_id: messageId,
        filename: uniqueFilename,
        original_filename: filename,
        mime_type: mimeType,
        size: size,
        storage_path: uniqueFilename,
        storage_bucket: 'user-uploads',
        status: 'uploading',
        file_type: fileType
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error creating file record:', dbError);
      throw new Error('Failed to create file record');
    }

    return {
      fileId: file.id,
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      fileName: uniqueFilename
    };

  } catch (error) {
    console.error('Error in createUploadUrl:', error);
    throw error;
  }
}

/**
 * Confirm upload completion
 */
async function confirmUpload(userId, fileId) {
  try {
    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !file) {
      throw new Error('File not found');
    }

    // Get public URL for the file
    const { data: urlData } = supabaseAdmin.storage
      .from('user-uploads')
      .getPublicUrl(file.storage_path);

    // Update file status to processing
    const { error: updateError } = await supabase
      .from('files')
      .update({
        status: 'processing',
        public_url: urlData.publicUrl
      })
      .eq('id', fileId);

    if (updateError) {
      console.error('Database error updating file:', updateError);
      throw new Error('Failed to update file status');
    }

    return {
      fileId: file.id,
      url: urlData.publicUrl,
      status: 'processing',
      fileType: file.file_type,
      originalFilename: file.original_filename
    };

  } catch (error) {
    console.error('Error in confirmUpload:', error);
    throw error;
  }
}

/**
 * List files for a user
 */
async function listUserFiles(userId, options = {}) {
  try {
    const { 
      chatId = null, 
      fileType = null,
      status = null,
      limit = 20, 
      offset = 0 
    } = options;

    let query = supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (chatId) {
      query = query.eq('chat_id', chatId);
    }

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: files, count, error } = await query;

    if (error) {
      console.error('Error listing files:', error);
      throw new Error('Failed to fetch files');
    }

    return {
      files,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

  } catch (error) {
    console.error('Error in listUserFiles:', error);
    throw error;
  }
}

/**
 * Get file details by ID
 */
async function getFileById(userId, fileId) {
  try {
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .single();

    if (error || !file) {
      throw new Error('File not found');
    }

    return file;

  } catch (error) {
    console.error('Error in getFileById:', error);
    throw error;
  }
}

/**
 * Delete file
 */
async function deleteFile(userId, fileId) {
  try {
    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !file) {
      throw new Error('File not found');
    }

    // Delete from storage (using admin client)
    const { error: storageError } = await supabaseAdmin.storage
      .from('user-uploads')
      .remove([file.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete thumbnail if exists
    if (file.metadata?.thumbnailUrl) {
      const thumbnailPath = file.storage_path.replace(/\.[^.]+$/, '_thumb.webp');
      await supabaseAdmin.storage
        .from('user-uploads')
        .remove([thumbnailPath]);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      throw new Error('Failed to delete file record');
    }

    return { success: true };

  } catch (error) {
    console.error('Error in deleteFile:', error);
    throw error;
  }
}

/**
 * Update file metadata after processing
 */
async function updateFileMetadata(fileId, updates) {
  try {
    const { error } = await supabase
      .from('files')
      .update(updates)
      .eq('id', fileId);

    if (error) {
      console.error('Error updating file metadata:', error);
      throw new Error('Failed to update file metadata');
    }

    return { success: true };

  } catch (error) {
    console.error('Error in updateFileMetadata:', error);
    throw error;
  }
}

/**
 * Mark file processing as complete
 */
async function markFileAsReady(fileId, extractedText = null, metadata = {}) {
  try {
    const updates = {
      status: 'ready',
      updated_at: new Date().toISOString()
    };

    if (extractedText) {
      updates.extracted_text = extractedText;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      updates.metadata = metadata;
    }

    await updateFileMetadata(fileId, updates);

    return { success: true };

  } catch (error) {
    console.error('Error in markFileAsReady:', error);
    throw error;
  }
}

/**
 * Mark file processing as failed
 */
async function markFileAsFailed(fileId, errorMessage) {
  try {
    await updateFileMetadata(fileId, {
      status: 'failed',
      processing_error: errorMessage,
      updated_at: new Date().toISOString()
    });

    return { success: true };

  } catch (error) {
    console.error('Error in markFileAsFailed:', error);
    throw error;
  }
}

/**
 * Get user's storage usage statistics
 */
async function getUserStorageUsage(userId) {
  try {
    const { data, error } = await supabase
      .rpc('get_user_storage_usage', { p_user_id: userId });

    if (error) {
      console.error('Error getting storage usage:', error);
      throw new Error('Failed to get storage usage');
    }

    return data[0] || { total_files: 0, total_size: 0, total_size_mb: 0 };

  } catch (error) {
    console.error('Error in getUserStorageUsage:', error);
    throw error;
  }
}

/**
 * Download file from storage
 */
async function downloadFile(userId, fileId) {
  try {
    // Get file record
    const file = await getFileById(userId, fileId);

    // Download from Supabase Storage (using admin client)
    const { data, error } = await supabaseAdmin.storage
      .from('user-uploads')
      .download(file.storage_path);

    if (error) {
      console.error('Storage download error:', error);
      throw new Error('Failed to download file');
    }

    return {
      data,
      filename: file.original_filename,
      mimeType: file.mime_type
    };

  } catch (error) {
    console.error('Error in downloadFile:', error);
    throw error;
  }
}

/**
 * Search files by text content
 */
async function searchFiles(userId, searchQuery, options = {}) {
  try {
    const { limit = 20, offset = 0 } = options;

    const { data: files, count, error } = await supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .or(`original_filename.ilike.%${searchQuery}%,extracted_text.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error searching files:', error);
      throw new Error('Failed to search files');
    }

    return {
      files,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

  } catch (error) {
    console.error('Error in searchFiles:', error);
    throw error;
  }
}

module.exports = {
  createUploadUrl,
  confirmUpload,
  listUserFiles,
  getFileById,
  deleteFile,
  updateFileMetadata,
  markFileAsReady,
  markFileAsFailed,
  getUserStorageUsage,
  downloadFile,
  searchFiles,
  // Helper functions
  validateFileType,
  validateFileExtension,
  sanitizeFilename,
  getFileType
};
