/**
 * Credit Service - Central Credit Management System
 * 
 * This service handles all credit-related operations including:
 * - Checking user credit balances
 * - Getting cost estimates for agents/tools
 * - Deducting credits after successful operations
 * - Refunding credits on failures
 * - Managing transaction history
 * - Analytics and reporting
 * 
 * Design Philosophy:
 * - Credits are ONLY deducted after successful execution
 * - Failed operations are NEVER charged
 * - All operations are atomic and logged
 * - Cost estimation happens BEFORE execution
 * - Full audit trail for compliance
 * 
 * @module creditService
 */

const supabase = require('../supabase/supabaseConnect');

/**
 * Credit Service Configuration
 */
const CREDIT_CONFIG = {
  // Initial credits for new users (handled by DB trigger)
  INITIAL_CREDITS: 1000,
  
  // Minimum balance warning threshold
  LOW_BALANCE_THRESHOLD: 50,
  
  // Default cost if agent/tool not found in config
  DEFAULT_COST: 2.0,
  
  // Cost categories
  CATEGORIES: {
    BASIC: 'basic',           // 1-2 credits
    STANDARD: 'standard',     // 2-4 credits
    SEARCH: 'search',         // 4-6 credits
    PREMIUM: 'premium',       // 8-15 credits
    FILE: 'file'              // 1-3 credits
  }
};

/**
 * Auto-initialize credits for a user if they don't exist
 * This is a fallback in case the trigger didn't run or user existed before credit system
 * 
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object>} - { success, message }
 */
async function autoInitializeCredits(userId) {
  try {
    console.log(`[CreditService] 🔧 Auto-initializing credits for user: ${userId}`);
    
    // Insert initial credits
    const { data: creditData, error: creditError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        balance: CREDIT_CONFIG.INITIAL_CREDITS,
        total_earned: CREDIT_CONFIG.INITIAL_CREDITS,
        total_spent: 0
      })
      .select()
      .single();
    
    if (creditError) {
      // Log detailed error info
      console.error(`[CreditService] ❌ Database error inserting credits:`, {
        code: creditError.code,
        message: creditError.message,
        details: creditError.details,
        hint: creditError.hint
      });
      
      // If it's a duplicate key error, that's okay - means it was just created
      if (creditError.code === '23505') {
        console.log(`[CreditService] ℹ️ Credits already exist for user ${userId}`);
        return { success: true, message: 'Credits already initialized' };
      }
      
      // Return detailed error for other issues
      return {
        success: false,
        error: `Database error: ${creditError.message}`,
        code: creditError.code,
        details: creditError.details
      };
    }
    
    console.log(`[CreditService] ✅ Credits row created, now adding transaction...`);
    
    // Create initial transaction record
    const { error: transError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        transaction_type: 'initial',
        amount: CREDIT_CONFIG.INITIAL_CREDITS,
        balance_before: 0,
        balance_after: CREDIT_CONFIG.INITIAL_CREDITS,
        description: 'Auto-initialized credits for existing user',
        status: 'completed'
      });
    
    if (transError) {
      console.warn(`[CreditService] ⚠️ Failed to create transaction record:`, transError);
      // Don't fail the whole operation if just the transaction record failed
    }
    
    console.log(`[CreditService] ✅ Credits auto-initialized successfully for user ${userId}`);
    return { 
      success: true, 
      message: 'Credits initialized successfully',
      balance: CREDIT_CONFIG.INITIAL_CREDITS
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error auto-initializing credits:', {
      message: error.message,
      stack: error.stack,
      error: error
    });
    return {
      success: false,
      error: error.message || 'Failed to initialize credits',
      details: error.toString()
    };
  }
}

/**
 * Get user's current credit balance
 * 
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Object>} - { success, balance, totalEarned, totalSpent, isLow }
 */
async function getUserCredits(userId) {
  try {
    console.log(`[CreditService] 💰 Fetching credits for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance, total_earned, total_spent, created_at, updated_at')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      // If user credits not found, auto-initialize them
      if (error.code === 'PGRST116') {
        console.warn(`[CreditService] ⚠️ Credits not found for user ${userId}. Auto-initializing...`);
        
        const initResult = await autoInitializeCredits(userId);
        
        if (initResult.success) {
          // Fetch the newly created credits
          return getUserCredits(userId); // Recursive call
        } else {
          return {
            success: false,
            error: 'Failed to initialize user credits',
            code: 'INIT_FAILED'
          };
        }
      }
      throw error;
    }
    
    const isLow = data.balance < CREDIT_CONFIG.LOW_BALANCE_THRESHOLD;
    
    console.log(`[CreditService] ✅ User balance: ${data.balance} credits ${isLow ? '⚠️ LOW' : ''}`);
    
    return {
      success: true,
      balance: parseFloat(data.balance),
      totalEarned: parseFloat(data.total_earned),
      totalSpent: parseFloat(data.total_spent),
      isLow,
      lowBalanceThreshold: CREDIT_CONFIG.LOW_BALANCE_THRESHOLD,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error fetching user credits:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch credits',
      code: 'FETCH_ERROR'
    };
  }
}

/**
 * Get the cost for a specific agent/tool
 * 
 * @param {string} agentName - Name of the agent (e.g., 'calendar', 'gmail')
 * @param {string} toolName - Optional specific tool name
 * @returns {Promise<Object>} - { success, cost, description, category }
 */
async function getAgentCost(agentName, toolName = null) {
  try {
    console.log(`[CreditService] 📊 Fetching cost for agent: ${agentName}${toolName ? `, tool: ${toolName}` : ''}`);
    
    let query = supabase
      .from('credit_costs')
      .select('cost, description, category')
      .eq('agent_name', agentName)
      .eq('is_active', true);
    
    // Add tool name filter if provided
    if (toolName) {
      query = query.eq('tool_name', toolName);
    } else {
      query = query.is('tool_name', null);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      // If cost not found, return default cost
      if (error.code === 'PGRST116') {
        console.warn(`[CreditService] ⚠️ Cost not found for ${agentName}${toolName ? `/${toolName}` : ''}, using default: ${CREDIT_CONFIG.DEFAULT_COST}`);
        return {
          success: true,
          cost: CREDIT_CONFIG.DEFAULT_COST,
          description: `${agentName} operations`,
          category: CREDIT_CONFIG.CATEGORIES.STANDARD,
          isDefault: true
        };
      }
      throw error;
    }
    
    console.log(`[CreditService] ✅ Cost: ${data.cost} credits (${data.category})`);
    
    return {
      success: true,
      cost: parseFloat(data.cost),
      description: data.description,
      category: data.category,
      isDefault: false
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error fetching agent cost:', error);
    // Return default cost on error to not block operations
    return {
      success: true,
      cost: CREDIT_CONFIG.DEFAULT_COST,
      description: `${agentName} operations`,
      category: CREDIT_CONFIG.CATEGORIES.STANDARD,
      isDefault: true,
      error: error.message
    };
  }
}

/**
 * Get costs for multiple agents (for multi-agent queries)
 * 
 * @param {Array<string>} agentNames - Array of agent names
 * @returns {Promise<Object>} - { success, costs: { agentName: cost, ... }, total }
 */
async function getMultiAgentCosts(agentNames) {
  try {
    console.log(`[CreditService] 📊 Fetching costs for ${agentNames.length} agents: ${agentNames.join(', ')}`);
    
    const costs = {};
    let total = 0;
    
    // Fetch cost for each agent
    for (const agentName of agentNames) {
      const costResult = await getAgentCost(agentName);
      if (costResult.success) {
        costs[agentName] = costResult.cost;
        total += costResult.cost;
      }
    }
    
    console.log(`[CreditService] ✅ Total estimated cost: ${total} credits`);
    
    return {
      success: true,
      costs,
      total,
      breakdown: agentNames.map(name => ({
        agent: name,
        cost: costs[name] || CREDIT_CONFIG.DEFAULT_COST
      }))
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error fetching multi-agent costs:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch costs'
    };
  }
}

/**
 * Check if user has sufficient credits for an operation
 * 
 * @param {string} userId - User ID
 * @param {number} requiredCredits - Required credit amount
 * @returns {Promise<Object>} - { success, hasSufficientCredits, balance, required, shortfall }
 */
async function checkSufficientCredits(userId, requiredCredits) {
  try {
    console.log(`[CreditService] 🔍 Checking if user has ${requiredCredits} credits`);
    
    const creditsResult = await getUserCredits(userId);
    
    if (!creditsResult.success) {
      return {
        success: false,
        error: creditsResult.error,
        code: creditsResult.code
      };
    }
    
    const hasSufficientCredits = creditsResult.balance >= requiredCredits;
    const shortfall = hasSufficientCredits ? 0 : requiredCredits - creditsResult.balance;
    
    if (!hasSufficientCredits) {
      console.warn(`[CreditService] ⚠️ Insufficient credits! Required: ${requiredCredits}, Available: ${creditsResult.balance}, Shortfall: ${shortfall}`);
    } else {
      console.log(`[CreditService] ✅ Sufficient credits available`);
    }
    
    return {
      success: true,
      hasSufficientCredits,
      balance: creditsResult.balance,
      required: requiredCredits,
      shortfall,
      isLow: creditsResult.isLow
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error checking credits:', error);
    return {
      success: false,
      error: error.message || 'Failed to check credits'
    };
  }
}

/**
 * Deduct credits after successful operation
 * IMPORTANT: Only call this AFTER the operation succeeds
 * 
 * @param {string} userId - User ID
 * @param {string} agentName - Name of the agent
 * @param {string} toolName - Optional tool name
 * @param {Object} metadata - Additional metadata to log
 * @returns {Promise<Object>} - { success, transactionId, balanceBefore, balanceAfter, amount }
 */
async function deductCredits(userId, agentName, toolName = null, metadata = {}) {
  try {
    console.log(`[CreditService] 💳 Deducting credits for ${agentName}${toolName ? `/${toolName}` : ''}`);
    
    // Get the cost for this agent/tool
    const costResult = await getAgentCost(agentName, toolName);
    if (!costResult.success) {
      throw new Error('Failed to get agent cost');
    }
    
    const amount = costResult.cost;
    
    // Call the database function to update credits atomically
    const { data, error } = await supabase.rpc('update_user_credits', {
      p_user_id: userId,
      p_transaction_type: 'debit',
      p_amount: amount,
      p_agent_name: agentName,
      p_tool_name: toolName,
      p_description: `${agentName} operation ${toolName ? `(${toolName})` : ''}`,
      p_metadata: { ...metadata, costInfo: costResult }
    });
    
    if (error) {
      throw error;
    }
    
    // Parse the JSONB response
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      console.error(`[CreditService] ❌ Credit deduction failed: ${result.error}`);
      return result;
    }
    
    console.log(`[CreditService] ✅ Credits deducted successfully. Balance: ${result.balanceBefore} → ${result.balanceAfter}`);
    
    return {
      success: true,
      transactionId: result.transactionId,
      balanceBefore: parseFloat(result.balanceBefore),
      balanceAfter: parseFloat(result.balanceAfter),
      amount: parseFloat(result.amount),
      agentName,
      toolName
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error deducting credits:', error);
    return {
      success: false,
      error: error.message || 'Failed to deduct credits',
      code: 'DEDUCTION_ERROR'
    };
  }
}

/**
 * Refund credits after a failed operation
 * 
 * @param {string} userId - User ID
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - { success, transactionId, balanceAfter, amount }
 */
async function refundCredits(userId, amount, reason, metadata = {}) {
  try {
    console.log(`[CreditService] 💰 Refunding ${amount} credits: ${reason}`);
    
    const { data, error } = await supabase.rpc('update_user_credits', {
      p_user_id: userId,
      p_transaction_type: 'refund',
      p_amount: amount,
      p_description: `Refund: ${reason}`,
      p_metadata: metadata
    });
    
    if (error) {
      throw error;
    }
    
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      console.error(`[CreditService] ❌ Refund failed: ${result.error}`);
      return result;
    }
    
    console.log(`[CreditService] ✅ Credits refunded. New balance: ${result.balanceAfter}`);
    
    return {
      success: true,
      transactionId: result.transactionId,
      balanceAfter: parseFloat(result.balanceAfter),
      amount: parseFloat(result.amount)
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error refunding credits:', error);
    return {
      success: false,
      error: error.message || 'Failed to refund credits'
    };
  }
}

/**
 * Add credits to user account (admin function)
 * 
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add
 * @param {string} reason - Reason for credit addition
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - { success, transactionId, balanceAfter, amount }
 */
async function addCredits(userId, amount, reason, metadata = {}) {
  try {
    console.log(`[CreditService] 💰 Adding ${amount} credits: ${reason}`);
    
    const { data, error } = await supabase.rpc('update_user_credits', {
      p_user_id: userId,
      p_transaction_type: 'credit',
      p_amount: amount,
      p_description: reason,
      p_metadata: metadata
    });
    
    if (error) {
      throw error;
    }
    
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      console.error(`[CreditService] ❌ Credit addition failed: ${result.error}`);
      return result;
    }
    
    console.log(`[CreditService] ✅ Credits added. New balance: ${result.balanceAfter}`);
    
    return {
      success: true,
      transactionId: result.transactionId,
      balanceAfter: parseFloat(result.balanceAfter),
      amount: parseFloat(result.amount)
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error adding credits:', error);
    return {
      success: false,
      error: error.message || 'Failed to add credits'
    };
  }
}

/**
 * Get user's transaction history
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Query options (limit, offset, type)
 * @returns {Promise<Object>} - { success, transactions, total }
 */
async function getTransactionHistory(userId, options = {}) {
  try {
    const { limit = 50, offset = 0, type = null } = options;
    
    console.log(`[CreditService] 📜 Fetching transaction history for user: ${userId}`);
    
    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Filter by transaction type if specified
    if (type) {
      query = query.eq('transaction_type', type);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    console.log(`[CreditService] ✅ Retrieved ${data.length} transactions (total: ${count})`);
    
    return {
      success: true,
      transactions: data.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: parseFloat(tx.amount),
        balanceBefore: parseFloat(tx.balance_before),
        balanceAfter: parseFloat(tx.balance_after),
        agentName: tx.agent_name,
        toolName: tx.tool_name,
        description: tx.description,
        metadata: tx.metadata,
        status: tx.status,
        createdAt: tx.created_at
      })),
      total: count,
      limit,
      offset
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error fetching transaction history:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch transactions'
    };
  }
}

/**
 * Get all available credit costs (pricing table)
 * 
 * @returns {Promise<Object>} - { success, costs }
 */
async function getAllCreditCosts() {
  try {
    console.log(`[CreditService] 📋 Fetching all credit costs`);
    
    const { data, error } = await supabase
      .from('credit_costs')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('cost', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    const costs = data.map(cost => ({
      agentName: cost.agent_name,
      toolName: cost.tool_name,
      cost: parseFloat(cost.cost),
      description: cost.description,
      category: cost.category
    }));
    
    // Group by category
    const grouped = costs.reduce((acc, cost) => {
      if (!acc[cost.category]) {
        acc[cost.category] = [];
      }
      acc[cost.category].push(cost);
      return acc;
    }, {});
    
    console.log(`[CreditService] ✅ Retrieved ${costs.length} active costs`);
    
    return {
      success: true,
      costs,
      grouped,
      categories: Object.keys(grouped)
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error fetching credit costs:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch costs'
    };
  }
}

/**
 * Update credit cost (admin function)
 * 
 * @param {string} agentName - Agent name
 * @param {string} toolName - Tool name (can be null)
 * @param {number} newCost - New cost value
 * @param {string} description - Optional description
 * @returns {Promise<Object>} - { success, message }
 */
async function updateCreditCost(agentName, toolName, newCost, description = null) {
  try {
    console.log(`[CreditService] 🔧 Updating cost for ${agentName}${toolName ? `/${toolName}` : ''} to ${newCost}`);
    
    const updates = {
      cost: newCost,
      updated_at: new Date().toISOString()
    };
    
    if (description) {
      updates.description = description;
    }
    
    let query = supabase
      .from('credit_costs')
      .update(updates)
      .eq('agent_name', agentName);
    
    if (toolName) {
      query = query.eq('tool_name', toolName);
    } else {
      query = query.is('tool_name', null);
    }
    
    const { error } = await query;
    
    if (error) {
      throw error;
    }
    
    console.log(`[CreditService] ✅ Cost updated successfully`);
    
    return {
      success: true,
      message: `Cost updated for ${agentName}${toolName ? `/${toolName}` : ''}`
    };
    
  } catch (error) {
    console.error('[CreditService] ❌ Error updating credit cost:', error);
    return {
      success: false,
      error: error.message || 'Failed to update cost'
    };
  }
}

module.exports = {
  // Configuration
  CREDIT_CONFIG,
  
  // User credit operations
  getUserCredits,
  autoInitializeCredits,  // ✅ Added for auto-initialization
  checkSufficientCredits,
  deductCredits,
  refundCredits,
  addCredits,
  
  // Cost queries
  getAgentCost,
  getMultiAgentCosts,
  getAllCreditCosts,
  updateCreditCost,
  
  // Transaction history
  getTransactionHistory
};
