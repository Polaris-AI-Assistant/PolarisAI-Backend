/**
 * Billing Configuration Service
 * 
 * Centralized source of truth for all billing values.
 * All pricing, credits, and feature limits come from this single source.
 * 
 * This ensures consistency across:
 * - Backend billing engine
 * - Frontend pricing display
 * - Razorpay integration
 * - Database operations
 * 
 * @module billingConfig
 */

const supabaseAdmin = require('../supabase/supabaseAdmin');

/**
 * Cache for billing configuration
 * Reduces database queries for frequently accessed config
 */
let configCache = {
  plans: null,
  packs: null,
  config: null,
  lastUpdated: null,
  cacheDuration: 5 * 60 * 1000 // 5 minutes
};

/**
 * Get all subscription plans
 * 
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Promise<Object>} - { success, plans }
 */
async function getSubscriptionPlans(forceRefresh = false) {
  try {
    // Check cache
    const now = Date.now();
    if (!forceRefresh && configCache.plans && 
        configCache.lastUpdated && 
        (now - configCache.lastUpdated < configCache.cacheDuration)) {
      console.log('[BillingConfig] 💨 Returning cached plans');
      return { success: true, plans: configCache.plans };
    }

    console.log('[BillingConfig] 📋 Fetching subscription plans from database');
    
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    const plans = data.map(plan => ({
      planId: plan.plan_id,
      name: plan.plan_name,
      description: plan.description,
      pricing: {
        monthly: parseFloat(plan.monthly_price_inr),
        yearly: parseFloat(plan.yearly_price_inr)
      },
      credits: {
        monthly: plan.monthly_credits,
        trial: plan.trial_credits
      },
      features: plan.features,
      limitations: plan.limitations,
      razorpayPlanIds: {
        monthly: plan.razorpay_plan_id_monthly,
        yearly: plan.razorpay_plan_id_yearly
      }
    }));
    
    // Update cache
    configCache.plans = plans;
    configCache.lastUpdated = now;
    
    return { success: true, plans };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching plans:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get specific subscription plan
 * 
 * @param {string} planId - Plan identifier
 * @returns {Promise<Object>} - { success, plan }
 */
async function getSubscriptionPlan(planId) {
  try {
    const result = await getSubscriptionPlans();
    if (!result.success) return result;
    
    const plan = result.plans.find(p => p.planId === planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }
    
    return { success: true, plan };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching plan:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all credit packs
 * 
 * @param {boolean} forceRefresh - Force cache refresh
 * @returns {Promise<Object>} - { success, packs }
 */
async function getCreditPacks(forceRefresh = false) {
  try {
    // Check cache
    const now = Date.now();
    if (!forceRefresh && configCache.packs && 
        configCache.lastUpdated && 
        (now - configCache.lastUpdated < configCache.cacheDuration)) {
      console.log('[BillingConfig] 💨 Returning cached credit packs');
      return { success: true, packs: configCache.packs };
    }

    console.log('[BillingConfig] 📦 Fetching credit packs from database');
    
    const { data, error } = await supabaseAdmin
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    const packs = data.map(pack => ({
      packId: pack.pack_id,
      name: pack.pack_name,
      credits: pack.credits,
      price: parseFloat(pack.price_inr),
      pricePerCredit: parseFloat(pack.price_per_credit),
      savingsPercentage: pack.savings_percentage ? parseFloat(pack.savings_percentage) : null,
      razorpayPlanId: pack.razorpay_plan_id,
      availableForPlans: pack.available_for_plans
    }));
    
    // Update cache
    configCache.packs = packs;
    configCache.lastUpdated = now;
    
    return { success: true, packs };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching credit packs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get specific credit pack
 * 
 * @param {string} packId - Pack identifier
 * @returns {Promise<Object>} - { success, pack }
 */
async function getCreditPack(packId) {
  try {
    const result = await getCreditPacks();
    if (!result.success) return result;
    
    const pack = result.packs.find(p => p.packId === packId);
    if (!pack) {
      return { success: false, error: 'Credit pack not found' };
    }
    
    return { success: true, pack };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching pack:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get billing system configuration
 * 
 * @returns {Promise<Object>} - { success, config }
 */
async function getBillingConfig() {
  try {
    // Check cache
    const now = Date.now();
    if (configCache.config && 
        configCache.lastUpdated && 
        (now - configCache.lastUpdated < configCache.cacheDuration)) {
      console.log('[BillingConfig] 💨 Returning cached config');
      return { success: true, config: configCache.config };
    }

    console.log('[BillingConfig] ⚙️ Fetching billing configuration');
    
    const { data, error } = await supabaseAdmin
      .from('billing_config')
      .select('config_key, config_value')
      .eq('is_active', true);
    
    if (error) throw error;
    
    // Convert to object
    const config = {};
    data.forEach(item => {
      config[item.config_key] = item.config_value;
    });
    
    // Update cache
    configCache.config = config;
    configCache.lastUpdated = now;
    
    return { success: true, config };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching config:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get specific config value
 * 
 * @param {string} key - Config key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>} - Config value
 */
async function getConfigValue(key, defaultValue = null) {
  try {
    const result = await getBillingConfig();
    if (!result.success) return defaultValue;
    
    return result.config[key] || defaultValue;
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching config value:', error);
    return defaultValue;
  }
}

/**
 * Update billing configuration
 * (Admin function)
 * 
 * @param {string} key - Config key
 * @param {*} value - Config value
 * @returns {Promise<Object>} - { success }
 */
async function updateBillingConfig(key, value) {
  try {
    console.log(`[BillingConfig] 🔧 Updating config: ${key}`);
    
    const { error } = await supabaseAdmin
      .from('billing_config')
      .upsert({
        config_key: key,
        config_value: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      });
    
    if (error) throw error;
    
    // Invalidate cache
    configCache.config = null;
    configCache.lastUpdated = null;
    
    console.log(`[BillingConfig] ✅ Config updated: ${key}`);
    return { success: true };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error updating config:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invalidate configuration cache
 * Call this after updating plans, packs, or config
 */
function invalidateCache() {
  console.log('[BillingConfig] 🗑️ Cache invalidated');
  configCache = {
    plans: null,
    packs: null,
    config: null,
    lastUpdated: null,
    cacheDuration: configCache.cacheDuration
  };
}

/**
 * Get complete billing configuration for frontend
 * 
 * @returns {Promise<Object>} - Complete config
 */
async function getCompleteBillingConfig() {
  try {
    console.log('[BillingConfig] 📦 Fetching complete billing configuration');
    
    const [plansResult, packsResult, configResult] = await Promise.all([
      getSubscriptionPlans(),
      getCreditPacks(),
      getBillingConfig()
    ]);
    
    if (!plansResult.success || !packsResult.success || !configResult.success) {
      return {
        success: false,
        error: 'Failed to fetch complete configuration'
      };
    }
    
    return {
      success: true,
      data: {
        plans: plansResult.plans,
        creditPacks: packsResult.packs,
        config: configResult.config
      }
    };
    
  } catch (error) {
    console.error('[BillingConfig] ❌ Error fetching complete config:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getSubscriptionPlans,
  getSubscriptionPlan,
  getCreditPacks,
  getCreditPack,
  getBillingConfig,
  getConfigValue,
  updateBillingConfig,
  invalidateCache,
  getCompleteBillingConfig
};
