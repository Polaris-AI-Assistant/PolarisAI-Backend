const express = require('express');
const supabase = require('../supabase/supabaseConnect');
const supabaseAdmin = require('../supabase/supabaseAdmin');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Get user settings (notifications, appearance)
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default settings if none exist
    const settings = data || {
      user_id: userId,
      notifications: {
        push_enabled: true,
        email_notifications: true,
        daily_summary: true,
        important_updates: true,
        schedule_reminders: true,
      },
      appearance: {
        theme: 'dark',
        language: 'en',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    res.json({ settings });
  } catch (err) {
    console.error('Get user settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Update user settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notifications, appearance } = req.body;

    const updates = {};
    if (notifications) updates.notifications = notifications;
    if (appearance) updates.appearance = appearance;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          ...updates,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Settings updated successfully', settings: data });
  } catch (err) {
    console.error('Update user settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Update user profile (display name, profile picture)
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { displayName, profilePicture } = req.body;

    const updates = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (profilePicture !== undefined) updates.profile_picture = profilePicture;

    // Update auth user metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: updates
      }
    );

    if (authError) throw authError;

    res.json({
      message: 'Profile updated successfully',
      user: authData.user,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Delete user account
 */
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmEmail } = req.body;

    // Get user to verify email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError) throw userError;

    // Verify email matches
    if (userData.user.email !== confirmEmail) {
      return res.status(400).json({ error: 'Email does not match' });
    }

    // Delete user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
