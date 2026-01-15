/**
 * Memory Controller
 * 
 * HTTP endpoints for the long-term memory system.
 * Provides APIs for adding, retrieving, and managing user memories.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    addMemory,
    getRelevantMemories,
    getMemoryStats,
    deleteMemory,
    listMemories,
    cleanupOldMemories,
    formatMemoriesForPrompt,
    MEMORY_TYPES,
    SOURCE_APPS
} = require('./memoryService');
const { 
    getMemoryTypeDisplay, 
    getMemoryTypeIcon,
    isValidMemoryType,
    isValidSourceApp 
} = require('./memoryConfig');

/**
 * POST /memory/add
 * Add a new memory from a user-assistant exchange
 * 
 * Request body:
 * {
 *   "userMessage": "string - the user's query",
 *   "assistantMessage": "string - the assistant's response",
 *   "sourceApp": "chat" | "gmail" | "github" | ... (optional, defaults to "chat"),
 *   "metadata": { ... } (optional additional metadata)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "memoryId": "uuid",
 *   "memoryType": "task_state",
 *   "reason": "Classification reason"
 * }
 */
router.post('/add', authenticateToken, async (req, res) => {
    console.log('\n========================================');
    console.log('[MemoryController] 🎯 POST /add endpoint hit!');
    console.log('[MemoryController] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[MemoryController] Body:', JSON.stringify(req.body, null, 2));
    console.log('========================================\n');
    
    try {
        const { userMessage, assistantMessage, sourceApp, metadata } = req.body;
        const userId = req.user.id;

        console.log(`[MemoryController] POST /add from user ${userId}`);
        console.log(`[MemoryController] Request body:`, { 
            userMessage: userMessage?.substring(0, 50), 
            assistantMessage: assistantMessage?.substring(0, 50),
            sourceApp,
            hasMetadata: !!metadata
        });

        // Validate required fields
        if (!userMessage || typeof userMessage !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'userMessage is required and must be a string'
            });
        }

        if (!assistantMessage || typeof assistantMessage !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'assistantMessage is required and must be a string'
            });
        }

        // Add the memory
        const result = await addMemory({
            userId,
            userMessage,
            assistantMessage,
            sourceApp: sourceApp || SOURCE_APPS.CHAT,
            metadata: metadata || {}
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            memoryId: result.memoryId,
            memoryType: result.memoryType,
            memoryTypeDisplay: getMemoryTypeDisplay(result.memoryType),
            memoryTypeIcon: getMemoryTypeIcon(result.memoryType),
            reason: result.reason,
            message: 'Memory added successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in POST /add:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add memory',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /memory/search
 * Search for relevant memories based on a query
 * 
 * Request body:
 * {
 *   "query": "string - the search query",
 *   "limit": 5 (optional),
 *   "threshold": 0.5 (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "memories": [...],
 *   "count": 5
 * }
 */
router.post('/search', authenticateToken, async (req, res) => {
    try {
        const { query, limit, threshold } = req.body;
        const userId = req.user.id;

        console.log(`[MemoryController] POST /search from user ${userId}`);

        // Validate query
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'query is required and must be a string'
            });
        }

        // Search for relevant memories
        const memories = await getRelevantMemories({
            userId,
            query,
            limit: limit || undefined,
            threshold: threshold || undefined
        });

        res.json({
            success: true,
            memories: memories.map(m => ({
                ...m,
                summary: m.summary,
                memoryTypeDisplay: getMemoryTypeDisplay(m.memoryType),
                memoryTypeIcon: getMemoryTypeIcon(m.memoryType)
            })),
            count: memories.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in POST /search:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search memories',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /memory/list
 * List all memories for the current user (with pagination)
 * 
 * Query params:
 * - limit: number (default 20)
 * - offset: number (default 0)
 * - type: memory type filter (optional)
 * 
 * Response:
 * {
 *   "success": true,
 *   "memories": [...],
 *   "total": 100,
 *   "limit": 20,
 *   "offset": 0
 * }
 */
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;
        const memoryType = req.query.type;

        console.log(`[MemoryController] GET /list from user ${userId}`);

        const result = await listMemories(userId, {
            limit: Math.min(limit, 100), // Cap at 100
            offset,
            memoryType
        });

        res.json({
            success: true,
            memories: result.memories.map(m => ({
                id: m.id,
                content: m.content,
                summary: m.summary,
                memory_type: m.memory_type,
                memoryType: m.memory_type,
                memoryTypeDisplay: getMemoryTypeDisplay(m.memory_type),
                memoryTypeIcon: getMemoryTypeIcon(m.memory_type),
                source_app: m.source_app,
                sourceApp: m.source_app,
                metadata: m.metadata,
                created_at: m.created_at,
                createdAt: m.created_at,
                updated_at: m.created_at
            })),
            total: result.total,
            limit,
            offset,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in GET /list:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list memories',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /memory/stats
 * Get memory statistics for the current user
 * 
 * Response:
 * {
 *   "success": true,
 *   "total": 100,
 *   "byType": {
 *     "task_state": 50,
 *     "user_profile": 30,
 *     ...
 *   }
 * }
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        console.log(`[MemoryController] GET /stats from user ${userId}`);

        const stats = await getMemoryStats(userId);

        // Add display names to stats
        const byTypeWithDisplay = {};
        for (const [type, count] of Object.entries(stats.byType)) {
            byTypeWithDisplay[type] = {
                count,
                display: getMemoryTypeDisplay(type),
                icon: getMemoryTypeIcon(type)
            };
        }

        res.json({
            success: true,
            total: stats.total,
            byType: byTypeWithDisplay,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in GET /stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get memory stats',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * DELETE /memory/:memoryId
 * Delete a specific memory
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Memory deleted successfully"
 * }
 */
router.delete('/:memoryId', authenticateToken, async (req, res) => {
    try {
        const { memoryId } = req.params;
        const userId = req.user.id;

        console.log(`[MemoryController] DELETE /${memoryId} from user ${userId}`);

        // Validate memoryId format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(memoryId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid memory ID format'
            });
        }

        const result = await deleteMemory(memoryId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Memory deleted successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in DELETE /:memoryId:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete memory',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /memory/cleanup
 * Clean up old memories (admin/maintenance endpoint)
 * 
 * Request body:
 * {
 *   "daysOld": 90 (optional, defaults to configured value)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "deletedCount": 10
 * }
 */
router.post('/cleanup', authenticateToken, async (req, res) => {
    try {
        const { daysOld } = req.body;
        const userId = req.user.id;

        console.log(`[MemoryController] POST /cleanup from user ${userId}`);

        const result = await cleanupOldMemories(userId, daysOld);

        res.json({
            success: true,
            deletedCount: result.deletedCount,
            message: `Cleaned up ${result.deletedCount} old memories`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[MemoryController] Error in POST /cleanup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup memories',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /memory/types
 * Get available memory types with display info
 * 
 * Response:
 * {
 *   "success": true,
 *   "types": [...]
 * }
 */
router.get('/types', (req, res) => {
    const types = Object.values(MEMORY_TYPES).map(type => ({
        value: type,
        display: getMemoryTypeDisplay(type),
        icon: getMemoryTypeIcon(type)
    }));

    res.json({
        success: true,
        types,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /memory/sources
 * Get available source applications
 * 
 * Response:
 * {
 *   "success": true,
 *   "sources": [...]
 * }
 */
router.get('/sources', (req, res) => {
    const sources = Object.values(SOURCE_APPS);

    res.json({
        success: true,
        sources,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
