/**
 * Billing Controller - HTTP Endpoints for Billing Management
 * 
 * Provides REST API endpoints for:
 * - Viewing subscription plans and pricing
 * - Managing subscriptions
 * - Processing payments via Razorpay
 * - Purchasing credit packs
 * - Viewing billing history
 * 
 * @module billingController
 */

console.log('[BillingController] ✅ Billing controller module loaded');

const express = require('express');
const billingConfig = require('./billingConfig');
const billingService = require('./billingService');
const razorpayService = require('./razorpayService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

console.log('[BillingController] 📡 Setting up billing routes');

/**
 * GET /billing/config
 * Get complete billing configuration (plans, packs, config)
 * Public endpoint - no auth required
 */
router.get('/config', async (req, res) => {
  try {
    const result = await billingConfig.getCompleteBillingConfig();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      ...result.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing configuration'
    });
  }
});

/**
 * GET /billing/plans
 * Get all subscription plans
 * Public endpoint - no auth required
 */
router.get('/plans', async (req, res) => {
  console.log('[BillingController] /plans endpoint hit - NO AUTH REQUIRED');
  console.log('[BillingController] Headers:', req.headers);
  
  try {
    const result = await billingConfig.getSubscriptionPlans();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      plans: result.plans,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans'
    });
  }
});

/**
 * GET /billing/credit-packs
 * Get all credit packs
 * Public endpoint - no auth required
 */
router.get('/credit-packs', async (req, res) => {
  try {
    const result = await billingConfig.getCreditPacks();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      packs: result.packs,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching credit packs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit packs'
    });
  }
});

/**
 * GET /billing/subscription
 * Get user's current subscription
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await billingService.getUserSubscription(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      subscription: result.subscription,
      onFreePlan: result.onFreePlan,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

/**
 * GET /billing/summary
 * Get user's complete billing summary
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await billingService.getUserBillingSummary(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      summary: result.summary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching billing summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing summary'
    });
  }
});

/**
 * POST /billing/create-order
 * Create Razorpay order for subscription or credit pack purchase
 * 
 * Body:
 * {
 *   "type": "subscription" | "credit_pack",
 *   "planId": "pro" (for subscription),
 *   "packId": "pack_250" (for credit pack),
 *   "billingCycle": "monthly" | "yearly" (for subscription)
 * }
 */
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, planId, packId, billingCycle } = req.body;
    
    // Validate input
    if (!type || !['subscription', 'credit_pack'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment type'
      });
    }
    
    let amount, description, itemData;
    
    if (type === 'subscription') {
      if (!planId || !billingCycle) {
        return res.status(400).json({
          success: false,
          error: 'planId and billingCycle are required for subscription'
        });
      }
      
      // Get plan details
      const planResult = await billingConfig.getSubscriptionPlan(planId);
      if (!planResult.success) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }
      
      amount = billingCycle === 'monthly' 
        ? planResult.plan.pricing.monthly 
        : planResult.plan.pricing.yearly;
      
      description = `${planResult.plan.name} - ${billingCycle} subscription`;
      itemData = { planId, billingCycle };
      
    } else if (type === 'credit_pack') {
      if (!packId) {
        return res.status(400).json({
          success: false,
          error: 'packId is required for credit pack'
        });
      }
      
      // Get pack details
      const packResult = await billingConfig.getCreditPack(packId);
      if (!packResult.success) {
        return res.status(404).json({
          success: false,
          error: 'Credit pack not found'
        });
      }
      
      amount = packResult.pack.price;
      description = `${packResult.pack.name} credit pack`;
      itemData = { packId };
    }
    
    // Check if amount is valid
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }
    
    // Generate unique receipt ID
    const receipt = `rcpt_${Date.now()}_${userId.substring(0, 8)}`;
    
    // Create Razorpay order
    const orderResult = await razorpayService.createOrder({
      amount,
      currency: 'INR',
      receipt,
      notes: {
        userId,
        type,
        ...itemData
      }
    });
    
    if (!orderResult.success) {
      return res.status(500).json({
        success: false,
        error: orderResult.error
      });
    }
    
    // Create payment record in database
    const paymentResult = await billingService.createPaymentRecord({
      userId,
      paymentType: type,
      amount,
      razorpayOrderId: orderResult.order.id,
      planId: type === 'subscription' ? planId : null,
      packId: type === 'credit_pack' ? packId : null,
      billingCycle: type === 'subscription' ? billingCycle : null,
      metadata: {
        description,
        receipt
      }
    });
    
    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create payment record'
      });
    }
    
    res.json({
      success: true,
      order: orderResult.order,
      paymentId: paymentResult.paymentId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
    
  } catch (error) {
    console.error('[BillingController] Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
});

/**
 * POST /billing/verify-payment
 * Verify and complete payment after Razorpay checkout
 * 
 * Body:
 * {
 *   "razorpayOrderId": "order_xxx",
 *   "razorpayPaymentId": "pay_xxx",
 *   "razorpaySignature": "signature"
 * }
 */
router.post('/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    
    // Validate input
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment parameters'
      });
    }
    
    // Verify signature
    const verifyResult = razorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });
    
    if (!verifyResult.success || !verifyResult.verified) {
      // Mark payment as failed
      await billingService.markPaymentFailed(razorpayOrderId, 'Invalid signature');
      
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
        code: 'INVALID_SIGNATURE'
      });
    }
    
    // Complete payment
    const completeResult = await billingService.completePayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });
    
    if (!completeResult.success) {
      return res.status(500).json({
        success: false,
        error: completeResult.error
      });
    }
    
    res.json({
      success: true,
      message: 'Payment verified and completed successfully',
      paymentId: completeResult.paymentId
    });
    
  } catch (error) {
    console.error('[BillingController] Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

/**
 * POST /billing/cancel-subscription
 * Cancel user's subscription
 * 
 * Body:
 * {
 *   "immediately": true | false
 * }
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediately = false } = req.body;
    
    const result = await billingService.cancelSubscription(userId, immediately);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: immediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of current period',
      cancelledImmediately: result.cancelledImmediately
    });
    
  } catch (error) {
    console.error('[BillingController] Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * GET /billing/payment-history
 * Get user's payment history
 * 
 * Query params:
 * - limit: Number of records (default: 50)
 * - offset: Offset for pagination (default: 0)
 */
router.get('/payment-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await billingService.getPaymentHistory(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      payments: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.payments.length < result.total,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
});

/**
 * GET /billing/history
 * Get user's billing history
 * 
 * Query params:
 * - limit: Number of records (default: 50)
 * - offset: Offset for pagination (default: 0)
 * - eventType: Filter by event type (optional)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, eventType = null } = req.query;
    
    const result = await billingService.getBillingHistory(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      eventType
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      history: result.history,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.history.length < result.total,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Error fetching billing history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing history'
    });
  }
});

/**
 * POST /billing/webhook
 * Razorpay webhook endpoint
 * This endpoint handles payment notifications from Razorpay
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body.toString();
    
    // Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(body, signature);
    
    if (!isValid) {
      console.error('[BillingController] Invalid webhook signature');
      return res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }
    
    // Parse webhook data
    const event = JSON.parse(body);
    
    // Process webhook event
    const result = await razorpayService.processWebhookEvent(event);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    // Handle specific webhook actions
    // This is where you would update payment status, subscriptions, etc.
    // based on the webhook event
    
    console.log('[BillingController] Webhook processed:', result.action.type);
    
    // Always return 200 to acknowledge receipt
    res.json({
      success: true,
      received: true
    });
    
  } catch (error) {
    console.error('[BillingController] Error processing webhook:', error);
    // Still return 200 to prevent Razorpay from retrying
    res.status(200).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * GET /billing/razorpay-status
 * Check Razorpay configuration status
 */
router.get('/razorpay-status', async (req, res) => {
  try {
    const status = razorpayService.checkConfiguration();
    
    res.json({
      success: true,
      razorpay: status
    });
    
  } catch (error) {
    console.error('[BillingController] Error checking Razorpay status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Razorpay status'
    });
  }
});

/**
 * GET /billing/health
 * Health check for billing system
 */
router.get('/health', async (req, res) => {
  try {
    const razorpayStatus = razorpayService.checkConfiguration();
    
    res.json({
      success: true,
      status: 'healthy',
      features: [
        'Subscription management',
        'Credit pack purchases',
        'Payment processing',
        'Billing history',
        'Razorpay integration'
      ],
      razorpay: razorpayStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[BillingController] Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
