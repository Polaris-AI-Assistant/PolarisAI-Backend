/**
 * Razorpay Integration Service
 * 
 * Handles all Razorpay Test Mode operations:
 * - Order creation
 * - Payment verification
 * - Webhook handling
 * - Signature validation
 * 
 * Environment Variables Required:
 * - RAZORPAY_KEY_ID (Test Key)
 * - RAZORPAY_KEY_SECRET (Test Secret)
 * - RAZORPAY_WEBHOOK_SECRET (Webhook Secret)
 * 
 * @module razorpayService
 */

const crypto = require('crypto');

/**
 * Get Razorpay configuration
 * 
 * @returns {Object} - Razorpay config
 */
function getRazorpayConfig() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    isConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  };
}

/**
 * Create Razorpay order
 * 
 * @param {Object} options - Order options
 * @returns {Promise<Object>} - { success, order }
 */
async function createOrder(options) {
  const { amount, currency = 'INR', receipt, notes = {} } = options;
  
  try {
    const config = getRazorpayConfig();
    
    if (!config.isConfigured) {
      return {
        success: false,
        error: 'Razorpay not configured',
        message: 'Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variables'
      };
    }
    
    console.log(`[Razorpay] 📝 Creating order for amount: ₹${amount}`);
    
    // Razorpay expects amount in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);
    
    const orderData = {
      amount: amountInPaise,
      currency: currency,
      receipt: receipt,
      notes: notes
    };
    
    // Make API call to Razorpay
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.description || 'Failed to create Razorpay order');
    }
    
    const order = await response.json();
    
    console.log(`[Razorpay] ✅ Order created: ${order.id}`);
    
    return {
      success: true,
      order: {
        id: order.id,
        entity: order.entity,
        amount: order.amount / 100, // Convert back to rupees
        amountPaid: order.amount_paid / 100,
        amountDue: order.amount_due / 100,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        attempts: order.attempts,
        notes: order.notes,
        createdAt: order.created_at
      }
    };
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error creating order:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify payment signature
 * 
 * This verifies that the payment response came from Razorpay
 * and hasn't been tampered with.
 * 
 * @param {Object} params - Payment parameters
 * @returns {Object} - { success, verified }
 */
function verifyPaymentSignature(params) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  
  try {
    const config = getRazorpayConfig();
    
    if (!config.keySecret) {
      return {
        success: false,
        verified: false,
        error: 'Razorpay key secret not configured'
      };
    }
    
    console.log(`[Razorpay] 🔐 Verifying payment signature for order: ${razorpayOrderId}`);
    
    // Generate expected signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.keySecret)
      .update(text)
      .digest('hex');
    
    // Compare signatures
    const isValid = expectedSignature === razorpaySignature;
    
    if (isValid) {
      console.log(`[Razorpay] ✅ Payment signature verified`);
    } else {
      console.error(`[Razorpay] ❌ Invalid payment signature`);
    }
    
    return {
      success: true,
      verified: isValid
    };
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error verifying signature:', error);
    return {
      success: false,
      verified: false,
      error: error.message
    };
  }
}

/**
 * Verify webhook signature
 * 
 * This verifies that the webhook came from Razorpay
 * 
 * @param {string} body - Webhook body (raw)
 * @param {string} signature - Signature from header
 * @returns {boolean} - Is valid
 */
function verifyWebhookSignature(body, signature) {
  try {
    const config = getRazorpayConfig();
    
    if (!config.webhookSecret) {
      console.error('[Razorpay] ⚠️ Webhook secret not configured');
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Process webhook event
 * 
 * @param {Object} event - Webhook event data
 * @returns {Promise<Object>} - { success, action }
 */
async function processWebhookEvent(event) {
  try {
    const { entity, event: eventType, payload } = event;
    
    console.log(`[Razorpay] 📨 Processing webhook event: ${eventType}`);
    
    // Extract relevant data based on event type
    let action = null;
    
    switch (eventType) {
      case 'payment.authorized':
      case 'payment.captured':
        action = {
          type: 'payment_success',
          orderId: payload.payment.entity.order_id,
          paymentId: payload.payment.entity.id,
          amount: payload.payment.entity.amount / 100,
          status: payload.payment.entity.status
        };
        break;
      
      case 'payment.failed':
        action = {
          type: 'payment_failed',
          orderId: payload.payment.entity.order_id,
          paymentId: payload.payment.entity.id,
          errorCode: payload.payment.entity.error_code,
          errorDescription: payload.payment.entity.error_description
        };
        break;
      
      case 'subscription.charged':
        action = {
          type: 'subscription_charged',
          subscriptionId: payload.subscription.entity.id,
          paymentId: payload.payment.entity.id,
          amount: payload.payment.entity.amount / 100
        };
        break;
      
      case 'subscription.cancelled':
        action = {
          type: 'subscription_cancelled',
          subscriptionId: payload.subscription.entity.id
        };
        break;
      
      default:
        console.log(`[Razorpay] ℹ️ Unhandled webhook event: ${eventType}`);
        action = {
          type: 'unhandled',
          eventType: eventType
        };
    }
    
    return {
      success: true,
      action
    };
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error processing webhook:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get payment details
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} - { success, payment }
 */
async function getPaymentDetails(paymentId) {
  try {
    const config = getRazorpayConfig();
    
    if (!config.isConfigured) {
      return {
        success: false,
        error: 'Razorpay not configured'
      };
    }
    
    console.log(`[Razorpay] 📋 Fetching payment details: ${paymentId}`);
    
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.description || 'Failed to fetch payment details');
    }
    
    const payment = await response.json();
    
    return {
      success: true,
      payment: {
        id: payment.id,
        entity: payment.entity,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        orderId: payment.order_id,
        method: payment.method,
        captured: payment.captured,
        email: payment.email,
        contact: payment.contact,
        createdAt: payment.created_at
      }
    };
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error fetching payment details:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Refund payment
 * 
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund (optional, full refund if not specified)
 * @returns {Promise<Object>} - { success, refund }
 */
async function refundPayment(paymentId, amount = null) {
  try {
    const config = getRazorpayConfig();
    
    if (!config.isConfigured) {
      return {
        success: false,
        error: 'Razorpay not configured'
      };
    }
    
    console.log(`[Razorpay] 💰 Creating refund for payment: ${paymentId}`);
    
    const refundData = amount ? { amount: Math.round(amount * 100) } : {};
    
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`
      },
      body: JSON.stringify(refundData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.description || 'Failed to create refund');
    }
    
    const refund = await response.json();
    
    console.log(`[Razorpay] ✅ Refund created: ${refund.id}`);
    
    return {
      success: true,
      refund: {
        id: refund.id,
        entity: refund.entity,
        amount: refund.amount / 100,
        currency: refund.currency,
        paymentId: refund.payment_id,
        status: refund.status,
        createdAt: refund.created_at
      }
    };
    
  } catch (error) {
    console.error('[Razorpay] ❌ Error creating refund:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if Razorpay is configured
 * 
 * @returns {Object} - { isConfigured, mode }
 */
function checkConfiguration() {
  const config = getRazorpayConfig();
  
  // Determine mode (test/live) based on key prefix
  let mode = 'unknown';
  if (config.keyId) {
    mode = config.keyId.startsWith('rzp_test_') ? 'test' : 'live';
  }
  
  return {
    isConfigured: config.isConfigured,
    mode,
    hasWebhookSecret: !!config.webhookSecret
  };
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  processWebhookEvent,
  getPaymentDetails,
  refundPayment,
  checkConfiguration
};
