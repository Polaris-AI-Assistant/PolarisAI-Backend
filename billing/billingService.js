/**
 * Billing Service
 * 
 * Handles all billing operations including:
 * - Subscription management
 * - Payment processing
 * - Credit allocation
 * - Razorpay integration
 * - Billing history
 * 
 * @module billingService
 */

const supabaseAdmin = require('../supabase/supabaseAdmin');
const billingConfig = require('./billingConfig');
const creditService = require('../credits/creditService');

/**
 * Get user's current subscription
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { success, subscription }
 */
async function getUserSubscription(userId) {
  try {
    console.log(`[BillingService] 🔍 Fetching subscription for user: ${userId}`);
    
    const { data, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          plan_id,
          plan_name,
          description,
          monthly_price_inr,
          yearly_price_inr,
          monthly_credits,
          features,
          limitations
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No active subscription - user is on free plan
        return {
          success: true,
          subscription: null,
          onFreePlan: true
        };
      }
      throw error;
    }
    
    return {
      success: true,
      subscription: {
        id: data.id,
        planId: data.plan_id,
        planName: data.subscription_plans.plan_name,
        billingCycle: data.billing_cycle,
        status: data.status,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        monthlyCredits: data.monthly_credits_allocated,
        creditsResetOn: data.credits_reset_on,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        razorpaySubscriptionId: data.razorpay_subscription_id,
        razorpayCustomerId: data.razorpay_customer_id
      },
      onFreePlan: false
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error fetching subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create or update subscription
 * 
 * @param {Object} options - Subscription options
 * @returns {Promise<Object>} - { success, subscription }
 */
async function createOrUpdateSubscription(options) {
  const {
    userId,
    planId,
    billingCycle,
    razorpaySubscriptionId = null,
    razorpayCustomerId = null
  } = options;
  
  try {
    console.log(`[BillingService] 🔄 Creating/updating subscription for user: ${userId}`);
    
    const { data, error } = await supabaseAdmin.rpc('create_or_update_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_billing_cycle: billingCycle,
      p_razorpay_subscription_id: razorpaySubscriptionId,
      p_razorpay_customer_id: razorpayCustomerId
    });
    
    if (error) throw error;
    
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      return result;
    }
    
    console.log(`[BillingService] ✅ Subscription created/updated. Credits allocated: ${result.credits_allocated}`);
    
    return {
      success: true,
      subscriptionId: result.subscription_id,
      creditsAllocated: result.credits_allocated,
      nextReset: result.next_reset
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error creating subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel subscription
 * 
 * @param {string} userId - User ID
 * @param {boolean} immediately - Cancel immediately or at period end
 * @returns {Promise<Object>} - { success }
 */
async function cancelSubscription(userId, immediately = false) {
  try {
    console.log(`[BillingService] 🛑 Cancelling subscription for user: ${userId}`);
    
    // Get current subscription
    const subResult = await getUserSubscription(userId);
    if (!subResult.success || !subResult.subscription) {
      return { success: false, error: 'No active subscription found' };
    }
    
    const { data, error } = await supabaseAdmin.rpc('cancel_subscription', {
      p_subscription_id: subResult.subscription.id,
      p_cancel_immediately: immediately
    });
    
    if (error) throw error;
    
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      return result;
    }
    
    console.log(`[BillingService] ✅ Subscription cancelled ${immediately ? 'immediately' : 'at period end'}`);
    
    return {
      success: true,
      cancelledImmediately: result.cancelled_immediately
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error cancelling subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get payment history
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - { success, payments }
 */
async function getPaymentHistory(userId, options = {}) {
  try {
    const { limit = 50, offset = 0 } = options;
    
    console.log(`[BillingService] 📜 Fetching payment history for user: ${userId}`);
    
    let query = supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    const payments = data.map(payment => ({
      id: payment.id,
      type: payment.payment_type,
      amount: parseFloat(payment.amount_inr),
      currency: payment.currency,
      status: payment.status,
      planId: payment.plan_id,
      packId: payment.pack_id,
      creditsPurchased: payment.credits_purchased,
      billingCycle: payment.billing_cycle,
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      createdAt: payment.created_at,
      completedAt: payment.completed_at
    }));
    
    return {
      success: true,
      payments,
      total: count,
      limit,
      offset
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error fetching payment history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get billing history
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - { success, history }
 */
async function getBillingHistory(userId, options = {}) {
  try {
    const { limit = 50, offset = 0, eventType = null } = options;
    
    console.log(`[BillingService] 📜 Fetching billing history for user: ${userId}`);
    
    let query = supabaseAdmin
      .from('billing_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    const history = data.map(item => ({
      id: item.id,
      eventType: item.event_type,
      description: item.description,
      amount: item.amount_inr ? parseFloat(item.amount_inr) : null,
      creditsChange: item.credits_change,
      metadata: item.metadata,
      createdAt: item.created_at
    }));
    
    return {
      success: true,
      history,
      total: count,
      limit,
      offset
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error fetching billing history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create payment record
 * 
 * @param {Object} options - Payment options
 * @returns {Promise<Object>} - { success, paymentId, orderId }
 */
async function createPaymentRecord(options) {
  const {
    userId,
    paymentType,
    amount,
    razorpayOrderId,
    planId = null,
    packId = null,
    billingCycle = null,
    metadata = {}
  } = options;
  
  try {
    console.log(`[BillingService] 💳 Creating payment record for user: ${userId}`);
    
    const { data, error } = await supabaseAdmin.rpc('create_payment_record', {
      p_user_id: userId,
      p_payment_type: paymentType,
      p_amount_inr: amount,
      p_razorpay_order_id: razorpayOrderId,
      p_plan_id: planId,
      p_pack_id: packId,
      p_billing_cycle: billingCycle,
      p_metadata: metadata
    });
    
    if (error) throw error;
    
    const result = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (!result.success) {
      return result;
    }
    
    console.log(`[BillingService] ✅ Payment record created: ${result.payment_id}`);
    
    return {
      success: true,
      paymentId: result.payment_id,
      orderId: result.order_id
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error creating payment record:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete payment
 * 
 * @param {Object} options - Payment completion options
 * @returns {Promise<Object>} - { success }
 */
async function completePayment(options) {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  } = options;
  
  try {
    console.log(`[BillingService] ✅ Completing payment: ${razorpayOrderId}`);
    
    // First, get the payment record to know what we're completing
    const { data: paymentData, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();
    
    if (fetchError || !paymentData) {
      return { success: false, error: 'Payment record not found' };
    }
    
    console.log(`[BillingService] 📋 Payment details: type=${paymentData.payment_type}, plan=${paymentData.plan_id}, cycle=${paymentData.billing_cycle}`);
    
    // Mark payment as completed
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        completed_at: new Date().toISOString()
      })
      .eq('razorpay_order_id', razorpayOrderId);
    
    if (updateError) throw updateError;
    
    // Process based on payment type
    if (['subscription', 'renewal', 'upgrade', 'downgrade'].includes(paymentData.payment_type)) {
      // Create/update subscription directly
      const subResult = await createOrUpdateSubscription({
        userId: paymentData.user_id,
        planId: paymentData.plan_id,
        billingCycle: paymentData.billing_cycle,
        razorpaySubscriptionId: null,
        razorpayCustomerId: null
      });
      
      if (!subResult.success) {
        console.error(`[BillingService] ❌ Subscription creation failed: ${subResult.error}`);
        // Don't fail the payment — credits may have been added, log the issue
        console.error(`[BillingService] ⚠️ Payment ${razorpayOrderId} completed but subscription not created`);
      } else {
        console.log(`[BillingService] ✅ Subscription created for plan: ${paymentData.plan_id}`);
      }
      
    } else if (paymentData.payment_type === 'credit_pack') {
      // Add credits for credit pack purchase
      const { data: packData } = await supabaseAdmin
        .from('credit_packs')
        .select('credits')
        .eq('pack_id', paymentData.pack_id)
        .single();
      
      if (packData) {
        // Use supabaseAdmin RPC for credit update
        await supabaseAdmin.rpc('update_user_credits', {
          p_user_id: paymentData.user_id,
          p_operation: 'credit',
          p_amount: packData.credits,
          p_agent_name: null,
          p_tool_name: null,
          p_description: `Purchased ${packData.credits} credits`,
          p_metadata: { source: 'credit_pack', pack_id: paymentData.pack_id, payment_id: paymentData.id }
        });
        console.log(`[BillingService] ✅ Credits added for credit pack: ${paymentData.pack_id}`);
      }
    }
    
    // Log billing history
    await supabaseAdmin
      .from('billing_history')
      .insert({
        user_id: paymentData.user_id,
        event_type: 'payment_completed',
        description: `Payment completed for ${paymentData.payment_type}`,
        amount_inr: paymentData.amount_inr,
        credits_change: paymentData.credits_purchased,
        related_payment_id: paymentData.id
      });
    
    console.log(`[BillingService] ✅ Payment completed successfully: ${razorpayOrderId}`);
    
    return {
      success: true,
      paymentId: paymentData.id
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error completing payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark payment as failed
 * 
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} reason - Failure reason
 * @returns {Promise<Object>} - { success }
 */
async function markPaymentFailed(razorpayOrderId, reason) {
  try {
    console.log(`[BillingService] ❌ Marking payment as failed: ${razorpayOrderId}`);
    
    const { error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('razorpay_order_id', razorpayOrderId);
    
    if (error) throw error;
    
    return { success: true };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error marking payment as failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's billing summary
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { success, summary }
 */
async function getUserBillingSummary(userId) {
  try {
    console.log(`[BillingService] 📊 Fetching billing summary for user: ${userId}`);
    
    // Get subscription
    const subResult = await getUserSubscription(userId);
    
    // Get credits
    const creditsResult = await creditService.getUserCredits(userId);
    
    // Get payment stats
    const { data: paymentStats, error: statsError } = await supabaseAdmin
      .from('payments')
      .select('amount_inr, status')
      .eq('user_id', userId)
      .eq('status', 'completed');
    
    if (statsError) throw statsError;
    
    const totalSpent = paymentStats.reduce((sum, p) => sum + parseFloat(p.amount_inr), 0);
    const totalPayments = paymentStats.length;
    
    return {
      success: true,
      summary: {
        subscription: subResult.subscription,
        onFreePlan: subResult.onFreePlan,
        credits: creditsResult.success ? {
          balance: creditsResult.balance,
          totalEarned: creditsResult.totalEarned,
          totalSpent: creditsResult.totalSpent,
          isLow: creditsResult.isLow
        } : null,
        payments: {
          total: totalPayments,
          totalSpent: totalSpent
        }
      }
    };
    
  } catch (error) {
    console.error('[BillingService] ❌ Error fetching billing summary:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getUserSubscription,
  createOrUpdateSubscription,
  cancelSubscription,
  getPaymentHistory,
  getBillingHistory,
  createPaymentRecord,
  completePayment,
  markPaymentFailed,
  getUserBillingSummary
};
