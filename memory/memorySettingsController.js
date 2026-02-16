/**
 * Memory Settings Controller
 * 
 * HTTP endpoints for managing user memory preferences.
 * Handles settings for memory categories, auto-delete, and weekly digests.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../supabase/supabaseConnect');

/**
 * Default memory settings
 */
const DEFAULT_SETTINGS = {
    enabled: true,
    categories: {
        forms: true,
        docs: true,
        sheets: true,
        calendar: true,
        gmail: true,
        flights: true,
        otherArtifacts: true
    },
    autoDeleteDays: 0, // 0 = never
    weeklyDigestEnabled: false,
    weeklyDigestDay: 'sunday',
    weeklyDigestTime: '08:00'
};

/**
 * GET /api/settings/memory
 * Get user's memory settings
 */
router.get('/memory', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[MemorySettingsController] GET /memory for user ${userId}`);

        // Try to get existing settings
        const { data, error } = await supabase
            .from('user_settings')
            .select('notifications')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('[MemorySettingsController] Error fetching settings:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch memory settings',
                message: error.message
            });
        }

        // If no settings exist, return defaults
        if (!data) {
            return res.json({
                success: true,
                settings: DEFAULT_SETTINGS
            });
        }

        res.json({
            success: true,
            settings: data.settings
        });
    } catch (error) {
        console.error('[MemorySettingsController] Error in GET /memory:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * PUT /api/settings/memory
 * Update user's memory settings
 */
router.put('/memory', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { settings } = req.body;

        console.log(`[MemorySettingsController] PUT /memory for user ${userId}`);

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'settings object is required'
            });
        }

        // Validate settings structure
        const validatedSettings = {
            enabled: typeof settings.enabled === 'boolean' ? settings.enabled : DEFAULT_SETTINGS.enabled,
            categories: {
                forms: typeof settings.categories?.forms === 'boolean' ? settings.categories.forms : DEFAULT_SETTINGS.categories.forms,
                docs: typeof settings.categories?.docs === 'boolean' ? settings.categories.docs : DEFAULT_SETTINGS.categories.docs,
                sheets: typeof settings.categories?.sheets === 'boolean' ? settings.categories.sheets : DEFAULT_SETTINGS.categories.sheets,
                calendar: typeof settings.categories?.calendar === 'boolean' ? settings.categories.calendar : DEFAULT_SETTINGS.categories.calendar,
                gmail: typeof settings.categories?.gmail === 'boolean' ? settings.categories.gmail : DEFAULT_SETTINGS.categories.gmail,
                flights: typeof settings.categories?.flights === 'boolean' ? settings.categories.flights : DEFAULT_SETTINGS.categories.flights,
                otherArtifacts: typeof settings.categories?.otherArtifacts === 'boolean' ? settings.categories.otherArtifacts : DEFAULT_SETTINGS.categories.otherArtifacts
            },
            autoDeleteDays: [0, 1, 7, 30, 90].includes(settings.autoDeleteDays) ? settings.autoDeleteDays : DEFAULT_SETTINGS.autoDeleteDays,
            weeklyDigestEnabled: typeof settings.weeklyDigestEnabled === 'boolean' ? settings.weeklyDigestEnabled : DEFAULT_SETTINGS.weeklyDigestEnabled,
            weeklyDigestDay: ['sunday', 'monday', 'friday'].includes(settings.weeklyDigestDay) ? settings.weeklyDigestDay : DEFAULT_SETTINGS.weeklyDigestDay,
            weeklyDigestTime: typeof settings.weeklyDigestTime === 'string' ? settings.weeklyDigestTime : DEFAULT_SETTINGS.weeklyDigestTime
        };

        // Upsert settings
        const { data, error } = await supabase
            .from('memory_settings')
            .upsert({
                user_id: userId,
                settings: validatedSettings,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) {
            console.error('[MemorySettingsController] Error updating settings:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update memory settings',
                message: error.message
            });
        }

        res.json({
            success: true,
            settings: data.settings,
            message: 'Memory settings updated successfully'
        });
    } catch (error) {
        console.error('[MemorySettingsController] Error in PUT /memory:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * DELETE /api/settings/memory/all
 * Delete all memories for the user
 */
router.delete('/memory/all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[MemorySettingsController] DELETE /memory/all for user ${userId}`);

        // Delete all memories for this user
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('[MemorySettingsController] Error deleting memories:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete memories',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'All memories deleted successfully'
        });
    } catch (error) {
        console.error('[MemorySettingsController] Error in DELETE /memory/all:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * DELETE /api/settings/memory/last-30-days
 * Delete memories from the last 30 days for the user
 */
router.delete('/memory/last-30-days', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[MemorySettingsController] DELETE /memory/last-30-days for user ${userId}`);

        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Delete memories from last 30 days
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('user_id', userId)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (error) {
            console.error('[MemorySettingsController] Error deleting memories:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete memories',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'Memories from last 30 days deleted successfully'
        });
    } catch (error) {
        console.error('[MemorySettingsController] Error in DELETE /memory/last-30-days:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;
