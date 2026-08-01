-- ================================================
-- POLARIS AI BILLING SYSTEM - COMPLETE MIGRATION
-- ================================================
-- This migration creates all necessary tables for a complete
-- SaaS billing infrastructure including:
-- - Centralized billing configuration
-- - Subscription plans and management
-- - Monthly credit allocation
-- - One-time credit purchases
-- - Payment history via Razorpay
-- - Credit top-ups
-- - Billing history and auditing
--
-- Run this ONCE in Supabase SQL Editor
-- ================================================

-- ================================================
-- TABLE: billing_config
-- Centralized source of truth for all billing values
-- ================================================
CREATE TABLE IF NOT EXISTS public.billing_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_config_key_check CHECK (char_length(config_key) > 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_config_key ON public.billing_config(config_key) WHERE is_active = true;
COMMENT ON TABLE public.billing_config IS 'Centralized billing configuration - single source of truth for all pricing';

-- ================================================
-- TABLE: subscription_plans
-- Available subscription tiers with all details
-- ================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan_id text NOT NULL UNIQUE,
  plan_name text NOT NULL,
  description text,
  monthly_price_inr decimal(10,2) NOT NULL DEFAULT 0,
  yearly_price_inr decimal(10,2) NOT NULL DEFAULT 0,
  monthly_credits integer NOT NULL DEFAULT 0,
  trial_credits integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  razorpay_plan_id_monthly text,
  razorpay_plan_id_yearly text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subscription_plans_price_check CHECK (monthly_price_inr >= 0 AND yearly_price_inr >= 0),
  CONSTRAINT subscription_plans_credits_check CHECK (monthly_credits >= 0 AND trial_credits >= 0)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active, display_order);
COMMENT ON TABLE public.subscription_plans IS 'Subscription plan definitions with pricing and features';

-- ================================================
-- TABLE: user_subscriptions
-- Track each user's subscription status
-- ================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id text NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial', 'payment_failed', 'paused')),
  started_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancelled_at timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  razorpay_subscription_id text,
  razorpay_customer_id text,
  monthly_credits_allocated integer NOT NULL DEFAULT 0,
  credits_reset_on timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON public.user_subscriptions(current_period_end);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_active_unique ON public.user_subscriptions(user_id) 
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_subscriptions_select_policy ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_subscriptions_insert_policy ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_subscriptions_update_policy ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_subscriptions IS 'User subscription status and billing cycle tracking';

-- ================================================
-- TABLE: credit_packs
-- One-time credit purchase options
-- ================================================
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pack_id text NOT NULL UNIQUE,
  pack_name text NOT NULL,
  credits integer NOT NULL,
  price_inr decimal(10,2) NOT NULL,
  price_per_credit decimal(10,4) GENERATED ALWAYS AS (price_inr / NULLIF(credits, 0)) STORED,
  savings_percentage decimal(5,2),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  razorpay_plan_id text,
  available_for_plans text[] DEFAULT ARRAY['pro', 'power']::text[],
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT credit_packs_credits_check CHECK (credits > 0),
  CONSTRAINT credit_packs_price_check CHECK (price_inr > 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_packs_active ON public.credit_packs(is_active, display_order);
COMMENT ON TABLE public.credit_packs IS 'One-time credit pack purchase options';

-- ================================================
-- TABLE: payments
-- Complete payment history via Razorpay
-- ================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('subscription', 'credit_pack', 'renewal', 'upgrade', 'downgrade')),
  amount_inr decimal(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text,
  razorpay_signature text,
  plan_id text,
  pack_id text,
  credits_purchased integer,
  billing_cycle text,
  payment_method text,
  failure_reason text,
  webhook_verified boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamp with time zone,
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT payments_amount_check CHECK (amount_inr > 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.payments IS 'Complete payment history and Razorpay transaction tracking';

-- ================================================
-- TABLE: billing_history
-- Consolidated billing events
-- ================================================
CREATE TABLE IF NOT EXISTS public.billing_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'subscription_created', 'subscription_renewed', 'subscription_cancelled', 
    'subscription_upgraded', 'subscription_downgraded', 'subscription_expired',
    'credits_allocated', 'credits_purchased', 'credits_expired',
    'payment_completed', 'payment_failed', 'refund_issued'
  )),
  description text NOT NULL,
  amount_inr decimal(10,2),
  credits_change integer,
  related_payment_id bigint,
  related_subscription_id bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT billing_history_payment_id_fkey FOREIGN KEY (related_payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  CONSTRAINT billing_history_subscription_id_fkey FOREIGN KEY (related_subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON public.billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_event_type ON public.billing_history(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON public.billing_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_history_select_policy ON public.billing_history
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.billing_history IS 'Complete billing event history for audit and user reference';

-- ================================================
-- INITIAL CONFIGURATION DATA
-- ================================================

-- Insert default billing configuration
INSERT INTO public.billing_config (config_key, config_value, description) VALUES
('trial_credits', '100', 'Initial free credits for new users'),
('low_balance_threshold', '50', 'Credit balance warning threshold'),
('credit_expiry_days', '365', 'Days until unused top-up credits expire (0 = never)'),
('enable_auto_renewal', 'true', 'Enable automatic subscription renewal'),
('grace_period_days', '3', 'Days after failed payment before service suspension'),
('max_retries_payment', '3', 'Maximum payment retry attempts')
ON CONFLICT (config_key) DO NOTHING;

-- Insert subscription plans
INSERT INTO public.subscription_plans (
  plan_id, plan_name, description, monthly_price_inr, yearly_price_inr, 
  monthly_credits, trial_credits, features, limitations, display_order
) VALUES
(
  'free',
  'Starter',
  'Perfect for trying out Polaris AI',
  0,
  0,
  0,
  100,
  '["Gmail, Calendar & Docs agents", "Web search & weather", "Maps & location queries", "7-day conversation memory", "5 scheduled reminders", "Basic intent classification"]'::jsonb,
  '{"max_schedules": 5, "memory_retention_days": 7, "excluded_agents": ["github", "microsoft", "research"], "excluded_features": ["pdf_generation", "multi_agent_parallel"]}'::jsonb,
  1
),
(
  'pro',
  'Pro',
  'Most popular plan for professionals',
  499,
  4788,
  1500,
  0,
  '["Everything in Starter", "GitHub & Microsoft 365 agents", "Flights & travel search", "PDF / file generation", "90-day semantic memory", "50 scheduled tasks", "Multi-agent workflows", "Credit top-ups available"]'::jsonb,
  '{"max_schedules": 50, "memory_retention_days": 90}'::jsonb,
  2
),
(
  'power',
  'Power',
  'Advanced features for power users',
  999,
  9588,
  4000,
  0,
  '["Everything in Pro", "Parallel multi-agent execution", "Unlimited memory retention", "Unlimited scheduled tasks", "Priority queue execution", "Early access to new agents", "Advanced validation engine", "Dedicated response streaming"]'::jsonb,
  '{"max_schedules": -1, "memory_retention_days": -1, "priority_queue": true}'::jsonb,
  3
)
ON CONFLICT (plan_id) DO NOTHING;

-- Insert credit packs
INSERT INTO public.credit_packs (
  pack_id, pack_name, credits, price_inr, savings_percentage, display_order
) VALUES
('pack_250', '250 Credits', 250, 149, 0, 1),
('pack_750', '750 Credits', 750, 349, 22, 2),
('pack_2000', '2000 Credits', 2000, 799, 33, 3)
ON CONFLICT (pack_id) DO NOTHING;

-- ================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- Now that subscription_plans data exists, add the foreign key
-- ================================================
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id) ON DELETE RESTRICT;

-- ================================================
-- FUNCTIONS: Subscription Management
-- ================================================

-- Function: Create or update subscription
CREATE OR REPLACE FUNCTION public.create_or_update_subscription(
  p_user_id uuid,
  p_plan_id text,
  p_billing_cycle text,
  p_razorpay_subscription_id text DEFAULT NULL,
  p_razorpay_customer_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_plan_record record;
  v_subscription_id bigint;
  v_monthly_credits integer;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan_record
  FROM public.subscription_plans
  WHERE plan_id = p_plan_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;
  
  -- Calculate period
  v_period_start := timezone('utc'::text, now());
  IF p_billing_cycle = 'monthly' THEN
    v_period_end := v_period_start + interval '1 month';
  ELSIF p_billing_cycle = 'yearly' THEN
    v_period_end := v_period_start + interval '1 year';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid billing cycle');
  END IF;
  
  v_monthly_credits := v_plan_record.monthly_credits;
  
  -- Cancel existing active subscription
  UPDATE public.user_subscriptions
  SET status = 'cancelled',
      cancelled_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id AND status = 'active';
  
  -- Create new subscription
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, billing_cycle, status,
    current_period_start, current_period_end,
    razorpay_subscription_id, razorpay_customer_id,
    monthly_credits_allocated, credits_reset_on
  ) VALUES (
    p_user_id, p_plan_id, p_billing_cycle, 'active',
    v_period_start, v_period_end,
    p_razorpay_subscription_id, p_razorpay_customer_id,
    v_monthly_credits, v_period_end
  )
  RETURNING id INTO v_subscription_id;
  
  -- Allocate monthly credits
  IF v_monthly_credits > 0 THEN
    PERFORM public.update_user_credits(
      p_user_id,
      'credit',
      v_monthly_credits,
      NULL,
      NULL,
      format('Monthly credits for %s plan', p_plan_id),
      jsonb_build_object(
        'source', 'subscription',
        'plan_id', p_plan_id,
        'billing_cycle', p_billing_cycle,
        'subscription_id', v_subscription_id
      )
    );
  END IF;
  
  -- Log billing history
  INSERT INTO public.billing_history (
    user_id, event_type, description, credits_change, related_subscription_id
  ) VALUES (
    p_user_id, 'subscription_created',
    format('Subscribed to %s plan (%s)', v_plan_record.plan_name, p_billing_cycle),
    v_monthly_credits, v_subscription_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'credits_allocated', v_monthly_credits,
    'next_reset', v_period_end
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_or_update_subscription IS 'Create or update user subscription with credit allocation';

-- Function: Allocate monthly credits (for renewals)
CREATE OR REPLACE FUNCTION public.allocate_monthly_credits(
  p_subscription_id bigint
)
RETURNS jsonb AS $$
DECLARE
  v_subscription record;
  v_plan_record record;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription
  FROM public.user_subscriptions
  WHERE id = p_subscription_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Get plan details
  SELECT * INTO v_plan_record
  FROM public.subscription_plans
  WHERE plan_id = v_subscription.plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;
  
  -- Allocate credits
  IF v_plan_record.monthly_credits > 0 THEN
    PERFORM public.update_user_credits(
      v_subscription.user_id,
      'credit',
      v_plan_record.monthly_credits,
      NULL,
      NULL,
      format('Monthly credits renewal for %s plan', v_subscription.plan_id),
      jsonb_build_object(
        'source', 'renewal',
        'plan_id', v_subscription.plan_id,
        'subscription_id', p_subscription_id
      )
    );
  END IF;
  
  -- Update subscription period
  UPDATE public.user_subscriptions
  SET current_period_start = current_period_end,
      current_period_end = CASE
        WHEN billing_cycle = 'monthly' THEN current_period_end + interval '1 month'
        WHEN billing_cycle = 'yearly' THEN current_period_end + interval '1 year'
        ELSE current_period_end
      END,
      credits_reset_on = CASE
        WHEN billing_cycle = 'monthly' THEN current_period_end + interval '1 month'
        WHEN billing_cycle = 'yearly' THEN current_period_end + interval '1 year'
        ELSE current_period_end
      END,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_subscription_id;
  
  -- Log billing history
  INSERT INTO public.billing_history (
    user_id, event_type, description, credits_change, related_subscription_id
  ) VALUES (
    v_subscription.user_id, 'credits_allocated',
    format('Monthly credits allocated for %s plan', v_plan_record.plan_name),
    v_plan_record.monthly_credits, p_subscription_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_allocated', v_plan_record.monthly_credits
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.allocate_monthly_credits IS 'Allocate monthly credits on subscription renewal';

-- Function: Cancel subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_subscription_id bigint,
  p_cancel_immediately boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_subscription record;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM public.user_subscriptions
  WHERE id = p_subscription_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  IF v_subscription.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription is not active');
  END IF;
  
  IF p_cancel_immediately THEN
    -- Cancel immediately
    UPDATE public.user_subscriptions
    SET status = 'cancelled',
        cancelled_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_subscription_id;
  ELSE
    -- Cancel at period end
    UPDATE public.user_subscriptions
    SET cancel_at_period_end = true,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_subscription_id;
  END IF;
  
  -- Log billing history
  INSERT INTO public.billing_history (
    user_id, event_type, description, related_subscription_id
  ) VALUES (
    v_subscription.user_id, 'subscription_cancelled',
    format('Subscription cancelled %s', CASE WHEN p_cancel_immediately THEN 'immediately' ELSE 'at period end' END),
    NULL, p_subscription_id
  );
  
  RETURN jsonb_build_object('success', true, 'cancelled_immediately', p_cancel_immediately);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cancel_subscription IS 'Cancel user subscription immediately or at period end';

-- ================================================
-- FUNCTIONS: Payment Processing
-- ================================================

-- Function: Create payment record
CREATE OR REPLACE FUNCTION public.create_payment_record(
  p_user_id uuid,
  p_payment_type text,
  p_amount_inr decimal,
  p_razorpay_order_id text,
  p_plan_id text DEFAULT NULL,
  p_pack_id text DEFAULT NULL,
  p_billing_cycle text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_payment_id bigint;
  v_credits integer;
BEGIN
  -- Get credits if credit pack
  IF p_pack_id IS NOT NULL THEN
    SELECT credits INTO v_credits
    FROM public.credit_packs
    WHERE pack_id = p_pack_id;
  END IF;
  
  -- Create payment record
  INSERT INTO public.payments (
    user_id, payment_type, amount_inr, status, razorpay_order_id,
    plan_id, pack_id, credits_purchased, billing_cycle, metadata
  ) VALUES (
    p_user_id, p_payment_type, p_amount_inr, 'pending', p_razorpay_order_id,
    p_plan_id, p_pack_id, v_credits, p_billing_cycle, p_metadata
  )
  RETURNING id INTO v_payment_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'order_id', p_razorpay_order_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Complete payment
CREATE OR REPLACE FUNCTION public.complete_payment(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text
)
RETURNS jsonb AS $$
DECLARE
  v_payment record;
  v_result jsonb;
BEGIN
  -- Get payment record
  SELECT * INTO v_payment
  FROM public.payments
  WHERE razorpay_order_id = p_razorpay_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;
  
  -- Update payment status
  UPDATE public.payments
  SET status = 'completed',
      razorpay_payment_id = p_razorpay_payment_id,
      razorpay_signature = p_razorpay_signature,
      completed_at = timezone('utc'::text, now())
  WHERE razorpay_order_id = p_razorpay_order_id;
  
  -- Process based on payment type
  IF v_payment.payment_type IN ('subscription', 'renewal', 'upgrade', 'downgrade') THEN
    -- Create/update subscription
    v_result := public.create_or_update_subscription(
      v_payment.user_id,
      v_payment.plan_id,
      v_payment.billing_cycle,
      NULL, -- Will be set later if using Razorpay subscription
      NULL
    );
  ELSIF v_payment.payment_type = 'credit_pack' THEN
    -- Add credits
    v_result := public.update_user_credits(
      v_payment.user_id,
      'credit',
      v_payment.credits_purchased,
      NULL,
      NULL,
      format('Purchased %s credits', v_payment.credits_purchased),
      jsonb_build_object(
        'source', 'credit_pack',
        'pack_id', v_payment.pack_id,
        'payment_id', v_payment.id
      )
    );
  END IF;
  
  -- Log billing history
  INSERT INTO public.billing_history (
    user_id, event_type, description, amount_inr, credits_change, related_payment_id
  ) VALUES (
    v_payment.user_id, 'payment_completed',
    format('Payment completed for %s', v_payment.payment_type),
    v_payment.amount_inr,
    v_payment.credits_purchased,
    v_payment.id
  );
  
  RETURN jsonb_build_object('success', true, 'payment_id', v_payment.id);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- TRIGGERS: Automated Updates
-- ================================================

-- Trigger: Update timestamp on config changes
CREATE OR REPLACE FUNCTION update_billing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_config_updated
  BEFORE UPDATE ON public.billing_config
  FOR EACH ROW EXECUTE FUNCTION update_billing_timestamp();

CREATE TRIGGER subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_billing_timestamp();

CREATE TRIGGER credit_packs_updated
  BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION update_billing_timestamp();

CREATE TRIGGER user_subscriptions_updated
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_billing_timestamp();

-- ================================================
-- VIEWS: Convenient Data Access
-- ================================================

-- View: User billing summary
CREATE OR REPLACE VIEW public.user_billing_summary AS
SELECT
  us.user_id,
  us.plan_id,
  sp.plan_name,
  us.billing_cycle,
  us.status AS subscription_status,
  us.current_period_end,
  us.monthly_credits_allocated,
  uc.balance AS current_credits,
  uc.total_spent AS credits_spent_lifetime,
  (SELECT COUNT(*) FROM public.payments p WHERE p.user_id = us.user_id AND p.status = 'completed') AS total_payments,
  (SELECT SUM(amount_inr) FROM public.payments p WHERE p.user_id = us.user_id AND p.status = 'completed') AS lifetime_revenue
FROM public.user_subscriptions us
JOIN public.subscription_plans sp ON us.plan_id = sp.plan_id
LEFT JOIN public.user_credits uc ON us.user_id = uc.user_id
WHERE us.status = 'active';

COMMENT ON VIEW public.user_billing_summary IS 'Consolidated view of user billing and subscription status';

-- ================================================
-- GRANTS: Permissions
-- ================================================

-- Grant SELECT on plans and packs (public data)
GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT SELECT ON public.credit_packs TO authenticated, anon;
GRANT SELECT ON public.billing_config TO authenticated;

-- ================================================
-- COMPLETION
-- ================================================

SELECT 'Billing system migration completed successfully!' AS status;
