/**
 * Credit Middleware - Check Credits Before Agent Execution
 * 
 * This middleware integrates with the existing authentication system
 * to check if users have sufficient credits before executing agents.
 * 
 * Features:
 * - Pre-execution credit validation
 * - Automatic cost estimation
 * - User-friendly error messages
 * - Support for single and multi-agent queries
 * - Non-blocking for read-only operations
 * 
 * Usage:
 * Add to agent controller routes AFTER authenticateToken:
 * router.post('/agent/query', authenticateToken, checkCredits, async (req, res) => { ... })
 * 
 * @module creditMiddleware
 */

const creditService = require('../credits/creditService');

/**
 * Check if user has sufficient credits before agent execution
 * 
 * This middleware:
 * 1. Estimates the cost based on the requested agents
 * 2. Checks if user has sufficient balance
 * 3. Attaches cost info to request for later deduction
 * 4. Returns error if insufficient credits
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function checkCredits(req, res, next) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      // This should never happen if authenticateToken is before this middleware
      console.error('[CreditMiddleware] ❌ No user ID found in request');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Get user's current balance
    const creditsResult = await creditService.getUserCredits(userId);
    
    if (!creditsResult.success) {
      console.error(`[CreditMiddleware] ❌ Failed to fetch credits: ${creditsResult.error}`);
      
      // If credits not initialized, return specific error
      if (creditsResult.code === 'CREDITS_NOT_FOUND') {
        return res.status(400).json({
          success: false,
          error: 'Credit account not initialized',
          message: 'Your credit account has not been set up. Please contact support.',
          code: 'CREDITS_NOT_INITIALIZED'
        });
      }
      
      // Other errors - allow request to proceed (fail-open for availability)
      console.warn('[CreditMiddleware] ⚠️ Credit check failed, allowing request to proceed');
      req.creditCheckSkipped = true;
      return next();
    }
    
    // Attach current balance to request
    req.userCredits = {
      balance: creditsResult.balance,
      isLow: creditsResult.isLow,
      totalEarned: creditsResult.totalEarned,
      totalSpent: creditsResult.totalSpent
    };
    
    // Estimate cost for this operation
    // This is complex because we don't know which agents will be used until the query is processed
    // For now, we'll do a basic check to ensure user has SOME credits
    
    const minimumRequired = 1; // At least 1 credit required
    
    if (creditsResult.balance < minimumRequired) {
      console.warn(`[CreditMiddleware] ❌ Insufficient credits for user ${userId}: ${creditsResult.balance} < ${minimumRequired}`);
      
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this action. Please purchase more credits to continue.',
        code: 'INSUFFICIENT_CREDITS',
        balance: creditsResult.balance,
        required: minimumRequired,
        shortfall: minimumRequired - creditsResult.balance,
        pricing: {
          message: 'View pricing and purchase credits in your account settings',
          link: '/settings/billing'
        }
      });
    }
    
    // Warn if balance is low
    if (creditsResult.isLow) {
      console.warn(`[CreditMiddleware] ⚠️ Low balance warning for user ${userId}: ${creditsResult.balance} credits remaining`);
      // Don't block request, just log warning
    }
    
    console.log(`[CreditMiddleware] ✅ Credit check passed for user ${userId}. Balance: ${creditsResult.balance}`);
    
    // Pass to next middleware
    next();
    
  } catch (error) {
    console.error('[CreditMiddleware] ❌ Credit check error:', error);
    
    // Fail-open: Allow request to proceed if credit check fails
    // This ensures availability even if credit system has issues
    console.warn('[CreditMiddleware] ⚠️ Credit check error, allowing request to proceed');
    req.creditCheckSkipped = true;
    next();
  }
}

/**
 * Check credits with agent-specific cost estimation
 * 
 * This is an enhanced version that can estimate costs for known agents.
 * Use this when the agent is known before execution (e.g., specific agent endpoints)
 * 
 * @param {string} agentName - Name of the agent that will be executed
 * @param {string} toolName - Optional tool name
 * @returns {Function} - Express middleware function
 */
function checkCreditsForAgent(agentName, toolName = null) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      console.log(`[CreditMiddleware] 🔍 Checking credits for agent: ${agentName}${toolName ? `/${toolName}` : ''}`);
      
      // Get the cost for this specific agent
      const costResult = await creditService.getAgentCost(agentName, toolName);
      
      if (!costResult.success && !costResult.isDefault) {
        console.error(`[CreditMiddleware] ❌ Failed to get agent cost: ${costResult.error}`);
        req.creditCheckSkipped = true;
        return next();
      }
      
      const estimatedCost = costResult.cost;
      
      // Check if user has sufficient credits
      const checkResult = await creditService.checkSufficientCredits(userId, estimatedCost);
      
      if (!checkResult.success) {
        console.error(`[CreditMiddleware] ❌ Credit check failed: ${checkResult.error}`);
        req.creditCheckSkipped = true;
        return next();
      }
      
      if (!checkResult.hasSufficientCredits) {
        console.warn(`[CreditMiddleware] ❌ Insufficient credits for ${agentName}: Required ${estimatedCost}, Available ${checkResult.balance}`);
        
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message: `This action requires ${estimatedCost} credits, but you only have ${checkResult.balance} credits available.`,
          code: 'INSUFFICIENT_CREDITS',
          agentName,
          toolName,
          estimatedCost,
          balance: checkResult.balance,
          shortfall: checkResult.shortfall,
          costInfo: {
            description: costResult.description,
            category: costResult.category
          },
          pricing: {
            message: 'Purchase more credits to continue',
            link: '/settings/billing'
          }
        });
      }
      
      // Attach cost info to request for later deduction
      req.agentCostInfo = {
        agentName,
        toolName,
        estimatedCost,
        costDescription: costResult.description,
        costCategory: costResult.category
      };
      
      // Attach user credits
      req.userCredits = {
        balance: checkResult.balance,
        isLow: checkResult.isLow
      };
      
      console.log(`[CreditMiddleware] ✅ Credit check passed. Cost: ${estimatedCost}, Balance: ${checkResult.balance}`);
      
      next();
      
    } catch (error) {
      console.error('[CreditMiddleware] ❌ Agent credit check error:', error);
      req.creditCheckSkipped = true;
      next();
    }
  };
}

/**
 * Deduct credits after successful operation
 * 
 * This should be called in the controller AFTER the agent successfully completes.
 * It uses the cost info attached by checkCreditsForAgent or estimates cost dynamically.
 * 
 * @param {Object} req - Express request object
 * @param {string} agentName - Agent that was executed
 * @param {string} toolName - Optional tool name
 * @param {Object} metadata - Additional metadata to log
 * @returns {Promise<Object>} - Deduction result
 */
async function deductCreditsAfterExecution(req, agentName, toolName = null, metadata = {}) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('[CreditMiddleware] ❌ Cannot deduct credits: No user ID');
      return { success: false, error: 'No user ID' };
    }
    
    // Skip deduction if credit check was skipped
    if (req.creditCheckSkipped) {
      console.warn('[CreditMiddleware] ⚠️ Skipping credit deduction (check was skipped)');
      return { success: true, skipped: true };
    }
    
    console.log(`[CreditMiddleware] 💳 Deducting credits for ${agentName}${toolName ? `/${toolName}` : ''}`);
    
    // Deduct credits
    const deductionResult = await creditService.deductCredits(
      userId,
      agentName,
      toolName,
      {
        ...metadata,
        requestPath: req.path,
        requestMethod: req.method,
        timestamp: new Date().toISOString()
      }
    );
    
    if (!deductionResult.success) {
      console.error(`[CreditMiddleware] ❌ Failed to deduct credits: ${deductionResult.error}`);
      // Don't fail the request if deduction fails - log for manual reconciliation
      return deductionResult;
    }
    
    console.log(`[CreditMiddleware] ✅ Credits deducted: ${deductionResult.amount}. New balance: ${deductionResult.balanceAfter}`);
    
    return deductionResult;
    
  } catch (error) {
    console.error('[CreditMiddleware] ❌ Error deducting credits:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refund credits after failed operation
 * 
 * Call this if an operation fails after credits were deducted
 * 
 * @param {Object} req - Express request object
 * @param {number} amount - Amount to refund
 * @param {string} reason - Reason for refund
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - Refund result
 */
async function refundCreditsAfterFailure(req, amount, reason, metadata = {}) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('[CreditMiddleware] ❌ Cannot refund credits: No user ID');
      return { success: false, error: 'No user ID' };
    }
    
    console.log(`[CreditMiddleware] 💰 Refunding ${amount} credits: ${reason}`);
    
    const refundResult = await creditService.refundCredits(
      userId,
      amount,
      reason,
      {
        ...metadata,
        requestPath: req.path,
        requestMethod: req.method,
        timestamp: new Date().toISOString()
      }
    );
    
    if (!refundResult.success) {
      console.error(`[CreditMiddleware] ❌ Failed to refund credits: ${refundResult.error}`);
      return refundResult;
    }
    
    console.log(`[CreditMiddleware] ✅ Credits refunded: ${amount}. New balance: ${refundResult.balanceAfter}`);
    
    return refundResult;
    
  } catch (error) {
    console.error('[CreditMiddleware] ❌ Error refunding credits:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkCredits,
  checkCreditsForAgent,
  deductCreditsAfterExecution,
  refundCreditsAfterFailure
};
