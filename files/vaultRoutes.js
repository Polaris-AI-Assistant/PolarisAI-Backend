/**
 * Vault Routes - Simple File Management API
 * Clean, minimal - no complex folders or tags
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../supabase/supabaseAdmin');
const authMiddleware = require('../middleware/auth');

// Auth: support both x-user-id header and JWT Bearer token
const verifyAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.user = { id: userId };
    return next();
  }
  return authMiddleware.authenticateToken(req, res, next);
};

router.use(verifyAuth);

// ============================================
// GET /api/vault/files - List files with simple filters
// ============================================
router.get('/files', async (req, res) => {
  try {
    const {
      timeFilter = 'all', // all, today, week, month
      type,               // image, document, audio, video
      search
    } = req.query;

    const userId = req.user.id;

    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Time filter
    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (timeFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (timeFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('created_at', monthAgo.toISOString());
    }

    // Type filter
    if (type && type !== 'all') {
      query = query.eq('file_type', type);
    }

    // Search
    if (search) {
      query = query.ilike('original_filename', `%${search}%`);
    }

    const { data: files, error } = await query;

    if (error) {
      console.error('Error fetching vault files:', error);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }

    return res.json({ files: files || [] });
  } catch (error) {
    console.error('Vault files error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/vault/stats - Storage stats
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: files, error } = await supabaseAdmin
      .from('files')
      .select('size, file_type')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching vault stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const fileList = files || [];
    const totalStorage = fileList.reduce((sum, f) => sum + (f.size || 0), 0);
    const storageLimit = 1024 * 1024 * 1024; // 1 GB

    // Count by type
    const byType = fileList.reduce((acc, f) => {
      acc[f.file_type] = (acc[f.file_type] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      totalStorage,
      storageLimit,
      totalFiles: fileList.length,
      byType
    });
  } catch (error) {
    console.error('Vault stats error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// DELETE /api/vault/files/:id - Delete a file
// ============================================
router.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get file to find storage path
    const { data: file, error: fetchError } = await supabaseAdmin
      .from('files')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from storage bucket
    await supabaseAdmin.storage
      .from('user-uploads')
      .remove([file.storage_path]);

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('files')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting vault file:', deleteError);
      return res.status(500).json({ error: 'Failed to delete file' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Vault delete error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
