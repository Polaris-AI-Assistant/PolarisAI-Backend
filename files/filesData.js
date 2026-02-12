/**
 * Files Data Layer
 * Direct database operations for file records
 */

const supabase = require('../supabase/supabaseConnect');

/**
 * Create a new file record
 */
async function createFileRecord(fileData) {
  try {
    const { data, error } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (error) {
      console.error('Error creating file record:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createFileRecord:', error);
    throw error;
  }
}

/**
 * Get file by ID
 */
async function getFileById(fileId) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) {
      console.error('Error getting file by ID:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getFileById:', error);
    return null;
  }
}

/**
 * Get files by user ID
 */
async function getFilesByUserId(userId, limit = 50, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error getting files by user ID:', error);
      throw error;
    }

    return { files: data, total: count };
  } catch (error) {
    console.error('Error in getFilesByUserId:', error);
    throw error;
  }
}

/**
 * Get files by chat ID
 */
async function getFilesByChatId(chatId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting files by chat ID:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getFilesByChatId:', error);
    throw error;
  }
}

/**
 * Get files by message ID
 */
async function getFilesByMessageId(messageId) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting files by message ID:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getFilesByMessageId:', error);
    throw error;
  }
}

/**
 * Update file record
 */
async function updateFile(fileId, updates) {
  try {
    const { data, error } = await supabase
      .from('files')
      .update(updates)
      .eq('id', fileId)
      .select()
      .single();

    if (error) {
      console.error('Error updating file:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateFile:', error);
    throw error;
  }
}

/**
 * Delete file record
 */
async function deleteFile(fileId) {
  try {
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteFile:', error);
    throw error;
  }
}

/**
 * Get files by status
 */
async function getFilesByStatus(status, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting files by status:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getFilesByStatus:', error);
    throw error;
  }
}

/**
 * Get files pending processing
 */
async function getPendingFiles(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .in('status', ['uploading', 'processing'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting pending files:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getPendingFiles:', error);
    throw error;
  }
}

/**
 * Search files by filename or extracted text
 */
async function searchFiles(userId, searchQuery, options = {}) {
  try {
    const { fileType, limit = 20, offset = 0 } = options;

    let query = supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .or(`original_filename.ilike.%${searchQuery}%,extracted_text.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching files:', error);
      throw error;
    }

    return { files: data, total: count };
  } catch (error) {
    console.error('Error in searchFiles:', error);
    throw error;
  }
}

/**
 * Get files by type
 */
async function getFilesByType(userId, fileType, limit = 50, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('files')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('file_type', fileType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error getting files by type:', error);
      throw error;
    }

    return { files: data, total: count };
  } catch (error) {
    console.error('Error in getFilesByType:', error);
    throw error;
  }
}

/**
 * Get recent files for user
 */
async function getRecentFiles(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting recent files:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getRecentFiles:', error);
    throw error;
  }
}

/**
 * Get expired files that need cleanup
 */
async function getExpiredFiles(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString())
      .limit(limit);

    if (error) {
      console.error('Error getting expired files:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getExpiredFiles:', error);
    throw error;
  }
}

/**
 * Bulk delete files by IDs
 */
async function bulkDeleteFiles(fileIds) {
  try {
    const { error } = await supabase
      .from('files')
      .delete()
      .in('id', fileIds);

    if (error) {
      console.error('Error bulk deleting files:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in bulkDeleteFiles:', error);
    throw error;
  }
}

/**
 * Get file statistics for user
 */
async function getUserFileStats(userId) {
  try {
    // Get total count by file type
    const { data: fileTypeStats, error: typeError } = await supabase
      .from('files')
      .select('file_type')
      .eq('user_id', userId);

    if (typeError) {
      console.error('Error getting file type stats:', error);
      throw typeError;
    }

    // Count by type
    const stats = {
      total: fileTypeStats.length,
      byType: {
        image: 0,
        document: 0,
        audio: 0,
        video: 0,
        other: 0
      }
    };

    fileTypeStats.forEach(file => {
      stats.byType[file.file_type]++;
    });

    // Get storage usage
    const { data: storageData, error: storageError } = await supabase
      .rpc('get_user_storage_usage', { p_user_id: userId });

    if (!storageError && storageData && storageData[0]) {
      stats.storage = storageData[0];
    }

    return stats;
  } catch (error) {
    console.error('Error in getUserFileStats:', error);
    throw error;
  }
}

module.exports = {
  createFileRecord,
  getFileById,
  getFilesByUserId,
  getFilesByChatId,
  getFilesByMessageId,
  updateFile,
  deleteFile,
  getFilesByStatus,
  getPendingFiles,
  searchFiles,
  getFilesByType,
  getRecentFiles,
  getExpiredFiles,
  bulkDeleteFiles,
  getUserFileStats
};
