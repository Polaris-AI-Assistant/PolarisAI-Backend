/**
 * In-memory store for pending confirmation actions
 * 
 * This module provides a simple but robust storage mechanism for tool actions
 * that require user confirmation before execution. Actions are stored with a TTL
 * and automatically cleaned up when expired.
 * 
 * Features:
 * - UUID-based request IDs for secure identification
 * - Automatic TTL-based expiration (default: 10 minutes)
 * - User-scoped action storage for security
 * - Preview content generation for UI display
 */

const crypto = require('crypto');

// In-memory store: Map<requestId, PendingAction>
const pendingActions = new Map();

// Default TTL: 10 minutes in milliseconds
const DEFAULT_TTL_MS = 10 * 60 * 1000;

// Cleanup interval: Run every 2 minutes
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

/**
 * PendingAction structure:
 * {
 *   requestId: string,
 *   userId: string,
 *   toolName: string,
 *   agentName: string,
 *   params: object,
 *   previewContent: string,
 *   query: string,
 *   conversationHistory: array,
 *   conversationId: string,   // For artifact memory
 *   createdAt: number,
 *   expiresAt: number
 * }
 */

/**
 * Generate a secure unique request ID
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Store a pending action awaiting confirmation
 * 
 * @param {string} userId - User ID for security validation
 * @param {string} toolName - Name of the tool to be executed
 * @param {string} agentName - Name of the specialized agent
 * @param {object} params - Parameters for the tool call
 * @param {string} previewContent - Human-readable preview of the action
 * @param {string} query - Original user query
 * @param {array} conversationHistory - Conversation context
 * @param {string} conversationId - Conversation ID for artifact memory
 * @param {number} ttlMs - Time to live in milliseconds (optional)
 * @returns {string} - Request ID for this pending action
 */
function storePendingAction(userId, toolName, agentName, params, previewContent, query, conversationHistory = [], conversationId = null, ttlMs = DEFAULT_TTL_MS) {
  const requestId = generateRequestId();
  const now = Date.now();
  
  const pendingAction = {
    requestId,
    userId,
    toolName,
    agentName,
    params,
    previewContent,
    query,
    conversationHistory,
    conversationId,  // Store conversationId for artifact memory
    createdAt: now,
    expiresAt: now + ttlMs
  };
  
  pendingActions.set(requestId, pendingAction);
  
  console.log(`[ConfirmationStore] Stored pending action: ${requestId} for tool: ${toolName} (conversation: ${conversationId || 'none'})`);
  
  return requestId;
}

/**
 * Retrieve and validate a pending action
 * 
 * @param {string} requestId - Request ID to look up
 * @param {string} userId - User ID for security validation
 * @returns {object|null} - Pending action object or null if not found/expired/unauthorized
 */
function getPendingAction(requestId, userId) {
  const action = pendingActions.get(requestId);
  
  if (!action) {
    console.log(`[ConfirmationStore] Action not found: ${requestId}`);
    return null;
  }
  
  // Security check: ensure action belongs to requesting user
  if (action.userId !== userId) {
    console.log(`[ConfirmationStore] User mismatch for action: ${requestId}`);
    return null;
  }
  
  // Check expiration
  if (Date.now() > action.expiresAt) {
    console.log(`[ConfirmationStore] Action expired: ${requestId}`);
    pendingActions.delete(requestId);
    return null;
  }
  
  return action;
}

/**
 * Remove a pending action after confirmation/cancellation
 * 
 * @param {string} requestId - Request ID to remove
 * @returns {boolean} - True if removed, false if not found
 */
function removePendingAction(requestId) {
  const existed = pendingActions.has(requestId);
  pendingActions.delete(requestId);
  
  if (existed) {
    console.log(`[ConfirmationStore] Removed pending action: ${requestId}`);
  }
  
  return existed;
}

/**
 * Get all pending actions for a user
 * 
 * @param {string} userId - User ID
 * @returns {array} - Array of pending actions for the user
 */
function getUserPendingActions(userId) {
  const userActions = [];
  const now = Date.now();
  
  for (const [requestId, action] of pendingActions) {
    if (action.userId === userId && now < action.expiresAt) {
      userActions.push(action);
    }
  }
  
  return userActions;
}

/**
 * Clear all pending actions for a user
 * 
 * @param {string} userId - User ID
 * @returns {number} - Number of actions cleared
 */
function clearUserPendingActions(userId) {
  let cleared = 0;
  
  for (const [requestId, action] of pendingActions) {
    if (action.userId === userId) {
      pendingActions.delete(requestId);
      cleared++;
    }
  }
  
  console.log(`[ConfirmationStore] Cleared ${cleared} actions for user: ${userId}`);
  return cleared;
}

/**
 * Clean up expired actions (called periodically)
 */
function cleanupExpiredActions() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [requestId, action] of pendingActions) {
    if (now > action.expiresAt) {
      pendingActions.delete(requestId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[ConfirmationStore] Cleaned up ${cleaned} expired actions`);
  }
}

// Start periodic cleanup
setInterval(cleanupExpiredActions, CLEANUP_INTERVAL_MS);

/**
 * Get store statistics (for debugging/monitoring)
 */
function getStoreStats() {
  return {
    totalPending: pendingActions.size,
    ttlMs: DEFAULT_TTL_MS,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS
  };
}

module.exports = {
  storePendingAction,
  getPendingAction,
  removePendingAction,
  getUserPendingActions,
  clearUserPendingActions,
  getStoreStats,
  generateRequestId
};
