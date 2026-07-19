/**
 * Credit Integration - Helper for Main Agent Credit Management
 * 
 * This module provides helper functions to integrate credit checks and deductions
 * into the main agent workflow without breaking existing functionality.
 * 
 * Key Design Principles:
 * - Non-breaking: Works alongside existing code
 * - Fail-safe: Errors in credit system don't block agent execution
 * - Transparent: Clear logging for debugging
 * - Automatic: Minimal changes to existing controllers
 * 
 * @module creditIntegration
 */

const creditService = require('./creditService');

/**
 * Estimate cost for a query before execution
 * 
 * This analyzes which agents will be used and estimates total cost.
 * Called BEFORE agent execution to inform the user.
 * 
 * @param {Array<string>} agentNames - List of agents that will be used
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { success, estimatedCost, breakdown, hasSufficientCredits }
 */
async function estimateQueryCost(agentNames, userId) {
  try {
    console.log(`[CreditIntegration] 💰 Estimating cost for agents: ${agentNames.join(', ')}`);
    
    // Get costs for all agents
    const costsResult = await creditService.getMultiAgentCosts(agentNames);
    
    if (!costsResult.success) {
      console.error(`[CreditIntegration] ❌ Failed to get costs: ${costsResult.error}`);
      return {
        success: false,
        error: costsResult.error,
        estimatedCost: 0
      };
    }
    
    // Check if user has sufficient credits
    const checkResult = await creditService.checkSufficientCredits(userId, costsResult.total);
    
    if (!checkResult.success) {
      console.error(`[CreditIntegration] ❌ Failed to check credits: ${checkResult.error}`);
      return {
        success: false,
        error: checkResult.error,
        estimatedCost: costsResult.total
      };
    }
    
    console.log(`[CreditIntegration] ✅ Estimated cost: ${costsResult.total} credits. User has ${checkResult.balance} credits.`);
    
    return {
      success: true,
      estimatedCost: costsResult.total,
      breakdown: costsResult.breakdown,
      hasSufficientCredits: checkResult.hasSufficientCredits,
      currentBalance: checkResult.balance,
      shortfall: checkResult.shortfall,
      isLow: checkResult.isLow
    };
    
  } catch (error) {
    console.error('[CreditIntegration] ❌ Error estimating cost:', error);
    return {
      success: false,
      error: error.message,
      estimatedCost: 0
    };
  }
}

/**
 * Deduct credits for executed agents
 * 
 * This should be called AFTER successful agent execution.
 * It deducts credits for each agent that was actually used.
 * 
 * @param {Array<string>} agentNames - Agents that were executed
 * @param {string} userId - User ID
 * @param {Object} metadata - Additional metadata to log
 * @returns {Promise<Object>} - { success, totalDeducted, transactions, newBalance }
 */
async function deductCreditsForAgents(agentNames, userId, metadata = {}) {
  try {
    console.log(`[CreditIntegration] 💳 Deducting credits for ${agentNames.length} agents: ${agentNames.join(', ')}`);
    
    const transactions = [];
    let totalDeducted = 0;
    let newBalance = null;
    
    // Deduct credits for each agent
    for (const agentName of agentNames) {
      const deductResult = await creditService.deductCredits(
        userId,
        agentName,
        null,
        {
          ...metadata,
          multiAgent: agentNames.length > 1,
          allAgents: agentNames
        }
      );
      
      if (deductResult.success) {
        totalDeducted += deductResult.amount;
        newBalance = deductResult.balanceAfter;
        transactions.push({
          agentName,
          amount: deductResult.amount,
          transactionId: deductResult.transactionId
        });
      } else {
        console.error(`[CreditIntegration] ⚠️ Failed to deduct credits for ${agentName}: ${deductResult.error}`);
        // Continue with other agents even if one fails
      }
    }
    
    console.log(`[CreditIntegration] ✅ Total credits deducted: ${totalDeducted}. New balance: ${newBalance}`);
    
    return {
      success: true,
      totalDeducted,
      transactions,
      newBalance,
      agentsCharged: agentNames.length
    };
    
  } catch (error) {
    console.error('[CreditIntegration] ❌ Error deducting credits:', error);
    return {
      success: false,
      error: error.message,
      totalDeducted: 0
    };
  }
}

/**
 * Handle credit flow for main agent query
 * 
 * This is the main integration point. Call this in mainAgentController
 * to handle the complete credit flow:
 * 1. Estimate cost before execution
 * 2. Check sufficient credits
 * 3. Execute query (if sufficient)
 * 4. Deduct credits after success
 * 5. Refund on failure
 * 
 * @param {Object} options - Configuration object
 * @param {Array<string>} options.agentNames - Agents to be used
 * @param {string} options.userId - User ID
 * @param {Function} options.executeQuery - Async function that executes the query
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} - Query result with credit info
 */
async function handleQueryWithCredits(options) {
  const { agentNames, userId, executeQuery, metadata = {} } = options;
  
  try {
    console.log(`[CreditIntegration] 🚀 Starting credit-managed query for user ${userId}`);
    
    // Step 1: Estimate cost
    const estimate = await estimateQueryCost(agentNames, userId);
    
    if (!estimate.success) {
      console.warn(`[CreditIntegration] ⚠️ Cost estimation failed, proceeding anyway: ${estimate.error}`);
      // Don't block query if estimation fails
    } else if (!estimate.hasSufficientCredits) {
      // User doesn't have enough credits - return error
      console.error(`[CreditIntegration] ❌ Insufficient credits: Required ${estimate.estimatedCost}, Available ${estimate.currentBalance}`);
      return {
        success: false,
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        estimatedCost: estimate.estimatedCost,
        currentBalance: estimate.currentBalance,
        shortfall: estimate.shortfall,
        breakdown: estimate.breakdown
      };
    }
    
    // Step 2: Execute the query
    console.log(`[CreditIntegration] ✅ Credit check passed. Executing query...`);
    const queryResult = await executeQuery();
    
    // Step 3: Check if query was successful
    if (!queryResult || !queryResult.success) {
      console.warn(`[CreditIntegration] ⚠️ Query failed, no credits will be deducted`);
      return {
        ...queryResult,
        creditInfo: {
          charged: false,
          reason: 'Query failed - no charge'
        }
      };
    }
    
    // Step 4: Deduct credits after successful execution
    const deductionResult = await deductCreditsForAgents(agentNames, userId, {
      ...metadata,
      querySuccess: true,
      queryTimestamp: new Date().toISOString()
    });
    
    if (!deductionResult.success) {
      console.error(`[CreditIntegration] ⚠️ Credit deduction failed: ${deductionResult.error}`);
      // Don't fail the query if deduction fails - log for manual reconciliation
    }
    
    // Step 5: Return result with credit info
    console.log(`[CreditIntegration] ✅ Query completed successfully. Credits deducted: ${deductionResult.totalDeducted}`);
    
    return {
      ...queryResult,
      creditInfo: {
        charged: deductionResult.success,
        amountCharged: deductionResult.totalDeducted,
        newBalance: deductionResult.newBalance,
        transactions: deductionResult.transactions,
        estimatedCost: estimate.estimatedCost,
        breakdown: estimate.breakdown
      }
    };
    
  } catch (error) {
    console.error('[CreditIntegration] ❌ Error in credit-managed query:', error);
    
    // Return error but don't block the query
    return {
      success: false,
      error: error.message,
      creditInfo: {
        charged: false,
        reason: 'Error in credit system'
      }
    };
  }
}

/**
 * Get credit info to include in SSE stream
 * 
 * This generates credit information to send to the frontend during streaming.
 * Call this before starting the stream to inform the user about costs.
 * 
 * @param {Array<string>} agentNames - Agents that will be used
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Credit info chunk for SSE
 */
async function getCreditInfoForStream(agentNames, userId) {
  try {
    const estimate = await estimateQueryCost(agentNames, userId);
    
    if (!estimate.success) {
      return {
        type: 'credit_info',
        available: true,
        estimatedCost: 0,
        error: estimate.error
      };
    }
    
    return {
      type: 'credit_info',
      available: estimate.hasSufficientCredits,
      estimatedCost: estimate.estimatedCost,
      currentBalance: estimate.currentBalance,
      breakdown: estimate.breakdown,
      isLow: estimate.isLow,
      shortfall: estimate.shortfall
    };
    
  } catch (error) {
    console.error('[CreditIntegration] ❌ Error getting credit info for stream:', error);
    return {
      type: 'credit_info',
      available: true,
      estimatedCost: 0,
      error: error.message
    };
  }
}

/**
 * Get credit deduction info after execution
 * 
 * This generates the final credit info to send after successful execution.
 * Call this after deducting credits to inform the user.
 * 
 * @param {Object} deductionResult - Result from deductCreditsForAgents
 * @returns {Object} - Credit deduction chunk for SSE
 */
function getCreditDeductionInfoForStream(deductionResult) {
  if (!deductionResult.success) {
    return {
      type: 'credit_deduction',
      success: false,
      error: deductionResult.error
    };
  }
  
  return {
    type: 'credit_deduction',
    success: true,
    amountCharged: deductionResult.totalDeducted,
    newBalance: deductionResult.newBalance,
    transactions: deductionResult.transactions
  };
}

module.exports = {
  estimateQueryCost,
  deductCreditsForAgents,
  handleQueryWithCredits,
  getCreditInfoForStream,
  getCreditDeductionInfoForStream
};
