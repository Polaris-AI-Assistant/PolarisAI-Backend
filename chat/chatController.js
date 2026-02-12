// Chat History Controller - API endpoints
const express = require('express');
const router = express.Router();
const chatData = require('./chatData');
const { emitChatTitleUpdate } = require('../socket/socketManager');

// Middleware to verify user authentication
const verifyAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. User ID not found.',
    });
  }
  
  req.userId = userId;
  next();
};

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the current user
 */
router.get('/sessions', verifyAuth, async (req, res) => {
  try {
    const sessions = await chatData.getAllChatSessions(req.userId);
    
    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Error in GET /sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat sessions',
      error: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions/:chatId
 * Get a specific chat session by ID
 */
router.get('/sessions/:chatId', verifyAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const session = await chatData.getChatSession(chatId, req.userId);
    
    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error in GET /sessions/:chatId:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: 'Failed to fetch chat session',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', verifyAuth, async (req, res) => {
  try {
    const newSession = await chatData.createChatSession(req.userId);
    
    res.json({
      success: true,
      session: newSession,
    });
  } catch (error) {
    console.error('Error in POST /sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat session',
      error: error.message,
    });
  }
});

/**
 * PUT /api/chat/sessions/:chatId/messages
 * Add messages to a chat session
 */
router.put('/sessions/:chatId/messages', verifyAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Messages array is required',
      });
    }
    
    // Filter out messages with empty content before processing
    const validMessages = messages.filter(msg => msg.content && msg.content.trim() !== '');
    
    if (validMessages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid messages to save',
      });
    }
    
    const updatedSession = await chatData.addMessagesToSession(
      chatId,
      req.userId,
      validMessages
    );
    
    res.json({
      success: true,
      session: updatedSession,
    });
  } catch (error) {
    console.error('Error in PUT /sessions/:chatId/messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chat session',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/chat/sessions/:chatId
 * Delete a chat session
 */
router.delete('/sessions/:chatId', verifyAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    await chatData.deleteChatSession(chatId, req.userId);
    
    res.json({
      success: true,
      message: 'Chat session deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /sessions/:chatId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chat session',
      error: error.message,
    });
  }
});

/**
 * PUT /api/chat/sessions/:chatId/rename
 * Rename a chat session
 */
router.put('/sessions/:chatId/rename', verifyAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }
    
    await chatData.renameChatSession(chatId, req.userId, title);

    // Emit chat title update via Socket.io for real-time sidebar sync
    emitChatTitleUpdate(chatId, title);
    
    res.json({
      success: true,
      message: 'Chat session renamed successfully',
    });
  } catch (error) {
    console.error('Error in PUT /sessions/:chatId/rename:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rename chat session',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/chat/sessions
 * Clear all chat sessions for the user
 */
router.delete('/sessions', verifyAuth, async (req, res) => {
  try {
    await chatData.clearAllChatSessions(req.userId);
    
    res.json({
      success: true,
      message: 'All chat sessions cleared successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat sessions',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions/:chatId/messages/:messageId/timeline
 * Save timeline events for a message
 */
router.post('/sessions/:chatId/messages/:messageId/timeline', verifyAuth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'Events array is required',
      });
    }
    
    await chatData.saveTimelineEvents(messageId, chatId, req.userId, events);
    
    res.json({
      success: true,
      message: 'Timeline events saved successfully',
    });
  } catch (error) {
    console.error('Error in POST /sessions/:chatId/messages/:messageId/timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save timeline events',
      error: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions/:chatId/messages/:messageId/timeline
 * Get timeline events for a message
 */
router.get('/sessions/:chatId/messages/:messageId/timeline', verifyAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const events = await chatData.getTimelineEventsForMessage(messageId);
    
    res.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Error in GET /sessions/:chatId/messages/:messageId/timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timeline events',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/timeline/batch
 * Get timeline events for multiple messages at once
 */
router.post('/timeline/batch', verifyAuth, async (req, res) => {
  try {
    const { messageIds } = req.body;
    
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: 'Message IDs array is required',
      });
    }
    
    const eventsByMessage = await chatData.getTimelineEventsForMessages(messageIds);
    
    res.json({
      success: true,
      eventsByMessage,
    });
  } catch (error) {
    console.error('Error in POST /timeline/batch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timeline events',
      error: error.message,
    });
  }
});

module.exports = router;
