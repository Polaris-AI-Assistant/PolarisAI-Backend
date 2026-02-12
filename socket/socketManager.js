/**
 * Socket.io Manager
 * 
 * Handles all WebSocket (Socket.io) communication for Polaris AI:
 * 
 * - Presence/Typing Indicators: user online/offline, "AI is thinking..."
 * - Notifications: push notifications, system alerts
 * - Live Updates: agent additions/removals, chat title updates
 * - Connection Management: heartbeat (30s), auto-reconnect, state tracking
 * 
 * SSE is used separately for AI response streaming (unidirectional).
 * Socket.io is used for everything else (bidirectional).
 */

const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

// In-memory stores
const connectedUsers = new Map();   // userId -> Set<socketId>
const userSockets = new Map();      // socketId -> { userId, joinedChats: Set }
const typingUsers = new Map();      // chatId -> Map<userId, { userName, timeout }>

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000; // 10s grace after missed heartbeat
const TYPING_TIMEOUT = 5000; // Auto-clear typing after 5s of no typing_start

let io = null;

/**
 * Initialize Socket.io server
 * 
 * @param {import('http').Server} httpServer - Node.js HTTP server
 * @param {object} options - Configuration options
 * @returns {import('socket.io').Server} - Socket.io server instance
 */
function initializeSocket(httpServer, options = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: HEARTBEAT_INTERVAL,   // Socket.io built-in ping every 30s
    pingTimeout: HEARTBEAT_TIMEOUT,     // 10s grace period
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware - validate JWT before allowing connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Validate token with Supabase
      const supabase = createClient(
        process.env.SUPABASE_URL || 'https://onztclcwwbquobbbrnkl.supabase.co',
        process.env.SUPABASE_API_KEY
      );
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return next(new Error('Invalid or expired token'));
      }

      // Attach user data to socket
      socket.userId = user.id;
      socket.userEmail = user.email;
      socket.userName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
      
      next();
    } catch (err) {
      console.error('[Socket] Auth error:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  // Handle new connections
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userName = socket.userName;

    console.log(`[Socket] ✅ User connected: ${userName} (${userId}) [${socket.id}]`);

    // Track connected user (supports multiple devices/tabs)
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    
    userSockets.set(socket.id, { 
      userId, 
      userName,
      joinedChats: new Set(),
      connectedAt: Date.now(),
    });

    // Broadcast user online status
    socket.broadcast.emit('user_online', {
      userId,
      userName,
      timestamp: new Date().toISOString(),
    });

    // Send current online users to newly connected user
    const onlineUsers = [];
    for (const [uid, sockets] of connectedUsers.entries()) {
      if (sockets.size > 0) {
        const firstSocket = userSockets.get([...sockets][0]);
        onlineUsers.push({
          userId: uid,
          userName: firstSocket?.userName || 'User',
          deviceCount: sockets.size,
        });
      }
    }
    socket.emit('online_users', { users: onlineUsers });

    // ==================== Chat Room Events ====================

    /**
     * Join a chat room to receive real-time updates for that chat
     */
    socket.on('join_chat', ({ chatId }) => {
      if (!chatId) return;
      
      socket.join(`chat:${chatId}`);
      userSockets.get(socket.id)?.joinedChats.add(chatId);
      
      console.log(`[Socket] User ${userName} joined chat: ${chatId}`);

      // Notify others in the chat
      socket.to(`chat:${chatId}`).emit('user_joined_chat', {
        userId,
        userName,
        chatId,
        timestamp: new Date().toISOString(),
      });

      // Send current typing users in this chat
      const chatTyping = typingUsers.get(chatId);
      if (chatTyping && chatTyping.size > 0) {
        const typingList = [];
        for (const [uid, data] of chatTyping.entries()) {
          typingList.push({ userId: uid, userName: data.userName });
        }
        socket.emit('typing_users', { chatId, users: typingList });
      }
    });

    /**
     * Leave a chat room
     */
    socket.on('leave_chat', ({ chatId }) => {
      if (!chatId) return;
      
      socket.leave(`chat:${chatId}`);
      userSockets.get(socket.id)?.joinedChats.delete(chatId);
      
      console.log(`[Socket] User ${userName} left chat: ${chatId}`);
      
      // Clear typing status when leaving
      clearTyping(chatId, userId);
      
      // Notify others
      socket.to(`chat:${chatId}`).emit('user_left_chat', {
        userId,
        userName,
        chatId,
        timestamp: new Date().toISOString(),
      });
    });

    // ==================== Typing Indicators ====================

    /**
     * User started typing in a chat
     */
    socket.on('typing_start', ({ chatId }) => {
      if (!chatId) return;

      if (!typingUsers.has(chatId)) {
        typingUsers.set(chatId, new Map());
      }

      const chatTyping = typingUsers.get(chatId);
      
      // Clear existing timeout if any
      const existing = chatTyping.get(userId);
      if (existing?.timeout) {
        clearTimeout(existing.timeout);
      }

      // Set auto-clear timeout (5s)
      const timeout = setTimeout(() => {
        clearTyping(chatId, userId);
        io.to(`chat:${chatId}`).emit('user_typing', {
          userId,
          userName,
          chatId,
          isTyping: false,
          timestamp: new Date().toISOString(),
        });
      }, TYPING_TIMEOUT);

      chatTyping.set(userId, { userName, timeout });

      // Broadcast to everyone else in the chat room
      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId,
        userName,
        chatId,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * User stopped typing in a chat
     */
    socket.on('typing_stop', ({ chatId }) => {
      if (!chatId) return;

      clearTyping(chatId, userId);

      socket.to(`chat:${chatId}`).emit('user_typing', {
        userId,
        userName,
        chatId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    });

    // ==================== Disconnection ====================

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ❌ User disconnected: ${userName} (${userId}) [${socket.id}] - Reason: ${reason}`);

      // Clean up typing indicators for all chats
      const userData = userSockets.get(socket.id);
      if (userData) {
        for (const chatId of userData.joinedChats) {
          clearTyping(chatId, userId);
        }
      }

      // Remove socket from user's set
      const sockets = connectedUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        
        // If user has no more connections, broadcast offline
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
          socket.broadcast.emit('user_offline', {
            userId,
            userName,
            timestamp: new Date().toISOString(),
          });
        }
      }

      userSockets.delete(socket.id);
    });

    // ==================== Error Handling ====================

    socket.on('error', (error) => {
      console.error(`[Socket] Error for user ${userName}:`, error.message);
    });
  });

  console.log('[Socket] ✅ Socket.io server initialized');
  return io;
}

// ==================== Helper Functions ====================

/**
 * Clear typing status for a user in a chat
 */
function clearTyping(chatId, userId) {
  const chatTyping = typingUsers.get(chatId);
  if (chatTyping) {
    const data = chatTyping.get(userId);
    if (data?.timeout) {
      clearTimeout(data.timeout);
    }
    chatTyping.delete(userId);
    if (chatTyping.size === 0) {
      typingUsers.delete(chatId);
    }
  }
}

// ==================== Server-Side Emission Functions ====================
// These are called from other backend modules to push events to clients

/**
 * Emit "AI is thinking..." indicator to a chat
 */
function emitAIThinking(chatId, isThinking, agentName = null) {
  if (!io) return;

  io.to(`chat:${chatId}`).emit('ai_thinking', {
    chatId,
    isThinking,
    agentName,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit agent added/removed events to a chat
 */
function emitAgentUpdate(chatId, action, agentData) {
  if (!io) return;

  io.to(`chat:${chatId}`).emit(action === 'added' ? 'agent_added' : 'agent_removed', {
    chatId,
    agentId: agentData.agentId || agentData.agentName,
    agentName: agentData.agentName,
    agentIcon: agentData.agentIcon,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit agent processing status updates to a chat (e.g., "Connecting to gmail agent...")
 */
function emitAgentStatus(chatId, statusMessage) {
  if (!io) return;

  io.to(`chat:${chatId}`).emit('agent_status', {
    chatId,
    message: statusMessage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit chat title update
 */
function emitChatTitleUpdate(chatId, title, userId) {
  if (!io) return;

  io.to(`chat:${chatId}`).emit('chat_title_updated', {
    chatId,
    title,
    updatedBy: userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a notification to a specific user (all their devices)
 */
function sendNotification(userId, notification) {
  if (!io) return;

  const sockets = connectedUsers.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit('notification', {
        type: notification.type || 'info',
        title: notification.title,
        message: notification.message,
        data: notification.data,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Broadcast a system alert to all connected users
 */
function broadcastSystemAlert(message, type = 'info') {
  if (!io) return;

  io.emit('system_alert', {
    type,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if a user is online
 */
function isUserOnline(userId) {
  const sockets = connectedUsers.get(userId);
  return sockets && sockets.size > 0;
}

/**
 * Get count of connected users
 */
function getConnectedUserCount() {
  return connectedUsers.size;
}

/**
 * Get the Socket.io server instance
 */
function getIO() {
  return io;
}

module.exports = {
  initializeSocket,
  getIO,
  // Server-side emitters
  emitAIThinking,
  emitAgentUpdate,
  emitAgentStatus,
  emitChatTitleUpdate,
  sendNotification,
  broadcastSystemAlert,
  // Utility
  isUserOnline,
  getConnectedUserCount,
};
