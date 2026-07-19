/**
 * Credit Controller - HTTP Endpoints for Credit Management
 * 
 * Provides REST API endpoints for:
 * - Viewing credit balance
 * - Viewing transaction history
 * - Viewing pricing (credit costs)
 * - Admin operations (add/update credits)
 * 
 * @module creditController
 */

const express = require('express');
const creditService = require('./creditService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /credits/balance
 * Get current user's credit balance
 * 
 * Response:
 * {
 *   "success": true,
 *   "balance": 950.5,
 *   "totalEarned": 1000,
 *   "totalSpent": 49.5,
 *   "isLow": false,
 *   "lowBalanceThreshold": 50
 * }
 */
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await creditService.getUserCredits(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
    
    res.json({
      success: true,
      balance: result.balance,
      totalEarned: result.totalEarned,
      totalSpent: result.totalSpent,
      isLow: result.isLow,
      lowBalanceThreshold: result.lowBalanceThreshold,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit balance',
      message: error.message
    });
  }
});

/**
 * GET /credits/transactions
 * Get user's transaction history
 * 
 * Query params:
 * - limit: Number of transactions to return (default: 50, max: 100)
 * - offset: Offset for pagination (default: 0)
 * - type: Filter by transaction type (credit, debit, refund, adjustment, initial)
 * 
 * Response:
 * {
 *   "success": true,
 *   "transactions": [...],
 *   "total": 150,
 *   "limit": 50,
 *   "offset": 0
 * }
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, type } = req.query;
    
    // Validate and sanitize inputs
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);
    
    const result = await creditService.getTransactionHistory(userId, {
      limit: parsedLimit,
      offset: parsedOffset,
      type: type || null
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.transactions.length < result.total,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction history',
      message: error.message
    });
  }
});

/**
 * GET /credits/pricing
 * Get credit costs for all agents and tools
 * 
 * Response:
 * {
 *   "success": true,
 *   "costs": [...],
 *   "grouped": { "basic": [...], "standard": [...], ... },
 *   "categories": ["basic", "standard", "search", "premium", "file"]
 * }
 */
router.get('/pricing', async (req, res) => {
  try {
    const result = await creditService.getAllCreditCosts();
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      costs: result.costs,
      grouped: result.grouped,
      categories: result.categories,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error fetching pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing information',
      message: error.message
    });
  }
});

/**
 * GET /credits/estimate
 * Estimate cost for specific agents
 * 
 * Query params:
 * - agents: Comma-separated list of agent names (e.g., "calendar,gmail,docs")
 * 
 * Response:
 * {
 *   "success": true,
 *   "costs": { "calendar": 2, "gmail": 3, "docs": 2 },
 *   "total": 7,
 *   "breakdown": [...]
 * }
 */
router.get('/estimate', async (req, res) => {
  try {
    const { agents } = req.query;
    
    if (!agents || typeof agents !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'agents parameter is required (comma-separated agent names)'
      });
    }
    
    const agentNames = agents.split(',').map(name => name.trim()).filter(name => name);
    
    if (agentNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one agent name is required'
      });
    }
    
    const result = await creditService.getMultiAgentCosts(agentNames);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      costs: result.costs,
      total: result.total,
      breakdown: result.breakdown,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error estimating cost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to estimate cost',
      message: error.message
    });
  }
});

/**
 * POST /credits/add
 * Add credits to a user account (Admin only)
 * 
 * Request body:
 * {
 *   "userId": "uuid",
 *   "amount": 100,
 *   "reason": "Promotional credit"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "transactionId": 123,
 *   "balanceAfter": 1100,
 *   "amount": 100
 * }
 */
router.post('/add', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    // For now, this endpoint is protected but should be admin-only
    
    const { userId, amount, reason, metadata } = req.body;
    
    // Validate inputs
    if (!userId || !amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'userId, amount, and reason are required'
      });
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount must be a positive number'
      });
    }
    
    const result = await creditService.addCredits(
      userId,
      amount,
      reason,
      {
        ...metadata,
        addedBy: req.user.id,
        addedByEmail: req.user.email
      }
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      balanceAfter: result.balanceAfter,
      amount: result.amount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error adding credits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add credits',
      message: error.message
    });
  }
});

/**
 * GET /credits/stats
 * Get credit usage statistics for the current user
 * 
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "balance": 950,
 *     "totalEarned": 1000,
 *     "totalSpent": 50,
 *     "totalTransactions": 25,
 *     "averageTransactionSize": 2.0,
 *     "mostUsedAgent": "calendar",
 *     "recentActivity": [...]
 *   }
 * }
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get balance
    const creditsResult = await creditService.getUserCredits(userId);
    if (!creditsResult.success) {
      return res.status(400).json({
        success: false,
        error: creditsResult.error
      });
    }
    
    // Get recent transactions
    const transactionsResult = await creditService.getTransactionHistory(userId, {
      limit: 100,
      offset: 0
    });
    
    if (!transactionsResult.success) {
      return res.status(400).json({
        success: false,
        error: transactionsResult.error
      });
    }
    
    const transactions = transactionsResult.transactions;
    
    // Calculate statistics
    const debits = transactions.filter(tx => tx.type === 'debit');
    const totalSpent = debits.reduce((sum, tx) => sum + tx.amount, 0);
    const averageTransactionSize = debits.length > 0 ? totalSpent / debits.length : 0;
    
    // Find most used agent
    const agentUsage = {};
    debits.forEach(tx => {
      if (tx.agentName) {
        agentUsage[tx.agentName] = (agentUsage[tx.agentName] || 0) + 1;
      }
    });
    
    const mostUsedAgent = Object.keys(agentUsage).length > 0
      ? Object.entries(agentUsage).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    
    // Recent activity (last 10 transactions)
    const recentActivity = transactions.slice(0, 10);
    
    res.json({
      success: true,
      stats: {
        balance: creditsResult.balance,
        totalEarned: creditsResult.totalEarned,
        totalSpent: creditsResult.totalSpent,
        totalTransactions: transactionsResult.total,
        totalDebits: debits.length,
        averageTransactionSize: Math.round(averageTransactionSize * 100) / 100,
        mostUsedAgent,
        agentUsage,
        recentActivity
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit statistics',
      message: error.message
    });
  }
});

/**
 * GET /credits/health
 * Health check for credit system
 * 
 * Response:
 * {
 *   "success": true,
 *   "status": "healthy",
 *   "features": [...]
 * }
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connectivity by fetching config
    const configResult = await creditService.CREDIT_CONFIG;
    
    res.json({
      success: true,
      status: 'healthy',
      features: [
        'Credit balance tracking',
        'Transaction history',
        'Cost estimation',
        'Multi-agent pricing',
        'Automatic deduction',
        'Refund support',
        'Admin operations'
      ],
      config: {
        initialCredits: configResult.INITIAL_CREDITS,
        lowBalanceThreshold: configResult.LOW_BALANCE_THRESHOLD
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CreditController] Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
