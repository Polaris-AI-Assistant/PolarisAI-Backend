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
 * - Multi-action chains for sequential confirmations
 */

const crypto = require('crypto');

// In-memory store: Map<requestId, PendingAction>
const pendingActions = new Map();

// Store for action chains: Map<chainId, { actions: [], currentIndex: number, completedResults: [] }>
const actionChains = new Map();

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
 *   chainId: string,          // Optional: ID of the action chain this belongs to
 *   chainIndex: number,       // Optional: Index in the action chain
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
 * @param {array} timelineEvents - Timeline events from initial query (optional)
 * @returns {string} - Request ID for this pending action
 */
function storePendingAction(userId, toolName, agentName, params, previewContent, query, conversationHistory = [], conversationId = null, ttlMs = DEFAULT_TTL_MS, timelineEvents = []) {
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
    timelineEvents,  // Store timeline events from initial query
    createdAt: now,
    expiresAt: now + ttlMs
  };
  
  pendingActions.set(requestId, pendingAction);
  
  console.log(`[ConfirmationStore] Stored pending action: ${requestId} for tool: ${toolName} (conversation: ${conversationId || 'none'}, timeline events: ${timelineEvents.length})`);
  
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
 * Get the most recent pending action for a user
 * 
 * @param {string} userId - User ID
 * @returns {object|null} - Most recent pending action or null if none
 */
function getUserMostRecentPendingAction(userId) {
  const userActions = [];
  
  for (const [requestId, action] of pendingActions.entries()) {
    if (action.userId === userId && Date.now() <= action.expiresAt) {
      userActions.push(action);
    }
  }
  
  // Sort by creation time, most recent first
  userActions.sort((a, b) => b.createdAt - a.createdAt);
  
  return userActions.length > 0 ? userActions[0] : null;
}

/**
 * Update a pending action with new parameters and regenerate preview
 * 
 * @param {string} requestId - Request ID to update
 * @param {string} userId - User ID for security validation
 * @param {object} newParams - New parameters for the action
 * @param {string} newPreviewContent - New preview content
 * @param {string} newQuery - New/modified query
 * @returns {object|null} - Updated action or null if not found/unauthorized
 */
function updatePendingAction(requestId, userId, newParams, newPreviewContent, newQuery) {
  const action = getPendingAction(requestId, userId);
  
  if (!action) {
    console.log(`[ConfirmationStore] Cannot update action: ${requestId} - not found or unauthorized`);
    return null;
  }
  
  // Update the action
  action.params = newParams;
  action.previewContent = newPreviewContent;
  action.query = newQuery;
  action.modifiedAt = Date.now();
  
  // Store back
  pendingActions.set(requestId, action);
  
  console.log(`[ConfirmationStore] Updated pending action: ${requestId}`);
  console.log(`[ConfirmationStore] New params:`, newParams);
  
  return action;
}

/**
 * Get the most recent pending action for a user
 * 
 * @param {string} userId - User ID
 * @returns {object|null} - Most recent pending action or null if none
 */
function getUserMostRecentPendingAction(userId) {
  const userActions = [];
  
  for (const [requestId, action] of pendingActions.entries()) {
    if (action.userId === userId && Date.now() <= action.expiresAt) {
      userActions.push(action);
    }
  }
  
  // Sort by creation time, most recent first
  userActions.sort((a, b) => b.createdAt - a.createdAt);
  
  return userActions.length > 0 ? userActions[0] : null;
}

/**
 * Update a pending action with new parameters and regenerate preview
 * 
 * @param {string} requestId - Request ID to update
 * @param {string} userId - User ID for security validation
 * @param {object} newParams - New parameters for the action
 * @param {string} newPreviewContent - New preview content
 * @param {string} newQuery - New/modified query
 * @returns {object|null} - Updated action or null if not found/unauthorized
 */
function updatePendingAction(requestId, userId, newParams, newPreviewContent, newQuery) {
  const action = getPendingAction(requestId, userId);
  
  if (!action) {
    console.log(`[ConfirmationStore] Cannot update action: ${requestId} - not found or unauthorized`);
    return null;
  }
  
  // Update the action
  action.params = newParams;
  action.previewContent = newPreviewContent;
  action.query = newQuery;
  action.modifiedAt = Date.now();
  
  // Store back
  pendingActions.set(requestId, action);
  
  console.log(`[ConfirmationStore] Updated pending action: ${requestId}`);
  console.log(`[ConfirmationStore] New params:`, newParams);
  
  return action;
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
    totalChains: actionChains.size,
    ttlMs: DEFAULT_TTL_MS,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS
  };
}

/**
 * Store a chain of actions that need sequential confirmation
 * 
 * @param {string} userId - User ID
 * @param {Array} actions - Array of action objects { toolName, agentName, params, previewContent }
 * @param {string} query - Original user query
 * @param {array} conversationHistory - Conversation context
 * @param {string} conversationId - Conversation ID for artifact memory
 * @param {number} ttlMs - Time to live in milliseconds
 * @param {array} timelineEvents - Timeline events from initial query
 * @returns {object} - { chainId, firstAction } containing chain ID and first action to confirm
 */
function storeActionChain(userId, actions, query, conversationHistory = [], conversationId = null, ttlMs = DEFAULT_TTL_MS, timelineEvents = []) {
  if (!actions || actions.length === 0) {
    return null;
  }

  const chainId = generateRequestId();
  const now = Date.now();

  // Store the chain metadata
  actionChains.set(chainId, {
    userId,
    actions,
    query,
    conversationHistory,
    conversationId,
    timelineEvents,  // Store timeline events from initial query
    currentIndex: 0,
    completedResults: [],
    createdAt: now,
    expiresAt: now + ttlMs
  });

  // Store the first action as a pending action
  const firstAction = actions[0];
  const requestId = generateRequestId();
  
  const pendingAction = {
    requestId,
    userId,
    toolName: firstAction.toolName,
    agentName: firstAction.agentName,
    params: firstAction.params,
    previewContent: firstAction.previewContent,
    query,
    conversationHistory,
    conversationId,
    timelineEvents,  // Store timeline events in pending action too
    chainId,
    chainIndex: 0,
    totalInChain: actions.length,
    createdAt: now,
    expiresAt: now + ttlMs
  };

  pendingActions.set(requestId, pendingAction);

  console.log(`[ConfirmationStore] Stored action chain: ${chainId} with ${actions.length} actions (timeline events: ${timelineEvents.length})`);
  console.log(`[ConfirmationStore] First action: ${firstAction.toolName} (requestId: ${requestId})`);

  return {
    chainId,
    firstRequestId: requestId,
    firstAction: pendingAction,
    totalActions: actions.length
  };
}

/**
 * Get the next action in a chain after current action is completed
 * 
 * @param {string} chainId - The chain ID
 * @param {string} userId - User ID for validation
 * @param {object} completedResult - Result from the just-completed action
 * @param {array} completedTimelineEvents - Timeline events from the just-completed step
 * @returns {object|null} - Next pending action or null if chain is complete
 */
function getNextChainAction(chainId, userId, completedResult = null, completedTimelineEvents = []) {
  const chain = actionChains.get(chainId);
  
  if (!chain) {
    console.log(`[ConfirmationStore] Chain not found: ${chainId}`);
    return null;
  }

  if (chain.userId !== userId) {
    console.log(`[ConfirmationStore] User mismatch for chain: ${chainId}`);
    return null;
  }

  if (Date.now() > chain.expiresAt) {
    console.log(`[ConfirmationStore] Chain expired: ${chainId}`);
    actionChains.delete(chainId);
    return null;
  }

  // Store the completed result
  if (completedResult) {
    chain.completedResults.push(completedResult);
  }
  
  // Accumulate timeline events from the completed step
  if (completedTimelineEvents && completedTimelineEvents.length > 0) {
    chain.timelineEvents = [...(chain.timelineEvents || []), ...completedTimelineEvents];
    console.log(`[ConfirmationStore] Accumulated ${completedTimelineEvents.length} timeline events, total now: ${chain.timelineEvents.length}`);
  }

  // Move to next action
  chain.currentIndex++;
  
  if (chain.currentIndex >= chain.actions.length) {
    console.log(`[ConfirmationStore] Chain complete: ${chainId}, accumulated ${(chain.timelineEvents || []).length} timeline events`);
    return { 
      chainComplete: true, 
      completedResults: chain.completedResults,
      accumulatedTimelineEvents: chain.timelineEvents || [],  // Return all accumulated timeline events
      chainId
    };
  }

  // Create pending action for next in chain
  const nextAction = chain.actions[chain.currentIndex];
  const requestId = generateRequestId();
  const now = Date.now();

  // Enhance next action params with results from previous actions
  // This allows the email to reference the form that was just created
  let enhancedParams = { ...nextAction.params };
  if (chain.completedResults.length > 0) {
    enhancedParams._previousResults = chain.completedResults;
  }

  const pendingAction = {
    requestId,
    userId: chain.userId,
    toolName: nextAction.toolName,
    agentName: nextAction.agentName,
    params: enhancedParams,
    previewContent: nextAction.previewContent,
    query: chain.query,
    conversationHistory: chain.conversationHistory,
    conversationId: chain.conversationId,
    timelineEvents: chain.timelineEvents || [],  // Preserve accumulated timeline events
    chainId,
    chainIndex: chain.currentIndex,
    totalInChain: chain.actions.length,
    createdAt: now,
    expiresAt: chain.expiresAt
  };

  pendingActions.set(requestId, pendingAction);

  console.log(`[ConfirmationStore] Created next action in chain: ${nextAction.toolName} (${chain.currentIndex + 1}/${chain.actions.length})`);
  console.log(`[ConfirmationStore] 📊 Next action has ${pendingAction.timelineEvents.length} accumulated timeline events`);

  return {
    chainComplete: false,
    nextAction: pendingAction,
    currentIndex: chain.currentIndex,
    totalActions: chain.actions.length,
    completedResults: chain.completedResults
  };
}

/**
 * Get chain info for a pending action
 * 
 * @param {string} requestId - Request ID of a pending action
 * @returns {object|null} - Chain info or null
 */
function getChainInfo(requestId) {
  const action = pendingActions.get(requestId);
  if (!action || !action.chainId) {
    return null;
  }
  
  return {
    chainId: action.chainId,
    chainIndex: action.chainIndex,
    totalInChain: action.totalInChain
  };
}

/**
 * Remove a chain and all its pending actions
 * 
 * @param {string} chainId - Chain ID to remove
 */
function removeActionChain(chainId) {
  // Remove the chain
  actionChains.delete(chainId);
  
  // Remove all pending actions belonging to this chain
  for (const [requestId, action] of pendingActions) {
    if (action.chainId === chainId) {
      pendingActions.delete(requestId);
    }
  }
  
  console.log(`[ConfirmationStore] Removed action chain: ${chainId}`);
}

module.exports = {
  storePendingAction,
  getPendingAction,
  removePendingAction,
  getUserPendingActions,
  getUserMostRecentPendingAction,
  updatePendingAction,
  clearUserPendingActions,
  getStoreStats,
  generateRequestId,
  // Chain functions
  storeActionChain,
  getNextChainAction,
  getChainInfo,
  removeActionChain
};
