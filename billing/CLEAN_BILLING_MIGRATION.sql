-- ================================================
-- POLARIS AI BILLING SYSTEM - CLEAN MIGRATION
-- ================================================
-- This migration drops any existing billing tables and creates fresh ones
-- Use this if you had a failed migration attempt
-- ================================================

-- ================================================
-- STEP 1: CLEAN UP ANY EXISTING TABLES
-- ================================================

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.billing_history CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.credit_packs CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.billing_config CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS public.user_billing_summary CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS public.create_or_update_subscription CASCADE;
DROP FUNCTION IF EXISTS public.allocate_monthly_credits CASCADE;
DROP FUNCTION IF EXISTS public.cancel_subscription CASCADE;
DROP FUNCTION IF EXISTS public.create_payment_record CASCADE;
DROP FUNCTION IF EXISTS public.complete_payment CASCADE;
DROP FUNCTION IF EXISTS update_billing_timestamp CASCADE;

-- ================================================
-- STEP 2: CREATE FRESH TABLES
-- ================================================

-- TABLE: billing_config
CREATE TABLE public.billing_config (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_config_key_check CHECK (char_length(config_key) > 0)
);

CREATE INDEX idx_billing_config_key ON public.billing_config(config_key) WHERE is_active = true;
COMMENT ON TABLE public.billing_config IS 'Centralized billing configuration';

-- TABLE: subscription_plans
CREATE TABLE public.subscription_plans (
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

CREATE INDEX idx_subscription_plans_active ON public.subscription_plans(is_active, display_order);
COMMENT ON TABLE public.subscription_plans IS 'Subscription plan definitions';

-- TABLE: user_subscriptions
CREATE TABLE public.user_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period_end ON public.user_subscriptions(current_period_end);
CREATE UNIQUE INDEX idx_user_subscriptions_active_unique ON public.user_subscriptions(user_id) WHERE status = 'active';

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_subscriptions_select_policy ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_subscriptions_insert_policy ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_subscriptions_update_policy ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_subscriptions IS 'User subscription tracking';

-- TABLE: credit_packs
CREATE TABLE public.credit_packs (
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

CREATE INDEX idx_credit_packs_active ON public.credit_packs(is_active, display_order);
COMMENT ON TABLE public.credit_packs IS 'Credit pack purchase options';

-- TABLE: payments
CREATE TABLE public.payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  CONSTRAINT payments_amount_check CHECK (amount_inr > 0)
);

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);
CREATE INDEX idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.payments IS 'Payment history and tracking';

-- TABLE: billing_history
CREATE TABLE public.billing_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'subscription_created', 'subscription_renewed', 'subscription_cancelled', 
    'subscription_upgraded', 'subscription_downgraded', 'subscription_expired',
    'credits_allocated', 'credits_purchased', 'credits_expired',
    'payment_completed', 'payment_failed', 'refund_issued'
  )),
  description text NOT NULL,
  amount_inr decimal(10,2),
  credits_change integer,
  related_payment_id bigint REFERENCES public.payments(id) ON DELETE SET NULL,
  related_subscription_id bigint REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_billing_history_user_id ON public.billing_history(user_id);
CREATE INDEX idx_billing_history_event_type ON public.billing_history(event_type);
CREATE INDEX idx_billing_history_created_at ON public.billing_history(created_at DESC);

ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_history_select_policy ON public.billing_history
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.billing_history IS 'Billing event history';

-- ================================================
-- STEP 3: INSERT INITIAL DATA
-- ================================================

-- Insert billing configuration
INSERT INTO public.billing_config (config_key, config_value, description) VALUES
('trial_credits', '100', 'Initial free credits for new users'),
('low_balance_threshold', '50', 'Credit balance warning threshold'),
('credit_expiry_days', '365', 'Days until unused top-up credits expire'),
('enable_auto_renewal', 'true', 'Enable automatic subscription renewal'),
('grace_period_days', '3', 'Days after failed payment before suspension'),
('max_retries_payment', '3', 'Maximum payment retry attempts');

-- Insert subscription plans
INSERT INTO public.subscription_plans (
  plan_id, plan_name, description, monthly_price_inr, yearly_price_inr, 
  monthly_credits, trial_credits, features, limitations, display_order
) VALUES
(
  'free',
  'Starter',
  'Perfect for trying out Polaris AI',
  0, 0, 0, 100,
  '["Gmail, Calendar & Docs agents", "Web search & weather", "Maps & location queries", "7-day conversation memory", "5 scheduled reminders", "Basic intent classification"]'::jsonb,
  '{"max_schedules": 5, "memory_retention_days": 7, "excluded_agents": ["github", "microsoft", "research"], "excluded_features": ["pdf_generation", "multi_agent_parallel"]}'::jsonb,
  1
),
(
  'pro',
  'Pro',
  'Most popular plan for professionals',
  499, 4788, 1500, 0,
  '["Everything in Starter", "GitHub & Microsoft 365 agents", "Flights & travel search", "PDF / file generation", "90-day semantic memory", "50 scheduled tasks", "Multi-agent workflows", "Credit top-ups available"]'::jsonb,
  '{"max_schedules": 50, "memory_retention_days": 90}'::jsonb,
  2
),
(
  'power',
  'Power',
  'Advanced features for power users',
  999, 9588, 4000, 0,
  '["Everything in Pro", "Parallel multi-agent execution", "Unlimited memory retention", "Unlimited scheduled tasks", "Priority queue execution", "Early access to new agents", "Advanced validation engine", "Dedicated response streaming"]'::jsonb,
  '{"max_schedules": -1, "memory_retention_days": -1, "priority_queue": true}'::jsonb,
  3
);

-- Insert credit packs
INSERT INTO public.credit_packs (
  pack_id, pack_name, credits, price_inr, savings_percentage, display_order
) VALUES
('pack_250', '250 Credits', 250, 149, 0, 1),
('pack_750', '750 Credits', 750, 349, 22, 2),
('pack_2000', '2000 Credits', 2000, 799, 33, 3);

-- ================================================
-- STEP 4: ADD FOREIGN KEY CONSTRAINT
-- ================================================

ALTER TABLE public.user_subscriptions
ADD CONSTRAINT user_subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id) ON DELETE RESTRICT;

-- ================================================
-- STEP 5: CREATE FUNCTIONS
-- ================================================

-- Function: Update timestamp
CREATE OR REPLACE FUNCTION update_billing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  SELECT * INTO v_plan_record FROM public.subscription_plans WHERE plan_id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found');
  END IF;
  
  v_period_start := timezone('utc'::text, now());
  IF p_billing_cycle = 'monthly' THEN
    v_period_end := v_period_start + interval '1 month';
  ELSIF p_billing_cycle = 'yearly' THEN
    v_period_end := v_period_start + interval '1 year';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid billing cycle');
  END IF;
  
  v_monthly_credits := v_plan_record.monthly_credits;
  
  UPDATE public.user_subscriptions
  SET status = 'cancelled', cancelled_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id AND status = 'active';
  
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, billing_cycle, status, current_period_start, current_period_end,
    razorpay_subscription_id, razorpay_customer_id, monthly_credits_allocated, credits_reset_on
  ) VALUES (
    p_user_id, p_plan_id, p_billing_cycle, 'active', v_period_start, v_period_end,
    p_razorpay_subscription_id, p_razorpay_customer_id, v_monthly_credits, v_period_end
  ) RETURNING id INTO v_subscription_id;
  
  IF v_monthly_credits > 0 THEN
    PERFORM public.update_user_credits(
      p_user_id, 'credit', v_monthly_credits, NULL, NULL,
      format('Monthly credits for %s plan', p_plan_id),
      jsonb_build_object('source', 'subscription', 'plan_id', p_plan_id, 'billing_cycle', p_billing_cycle, 'subscription_id', v_subscription_id)
    );
  END IF;
  
  INSERT INTO public.billing_history (user_id, event_type, description, credits_change, related_subscription_id)
  VALUES (p_user_id, 'subscription_created', format('Subscribed to %s plan (%s)', v_plan_record.plan_name, p_billing_cycle), v_monthly_credits, v_subscription_id);
  
  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'credits_allocated', v_monthly_credits, 'next_reset', v_period_end);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cancel subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_subscription_id bigint,
  p_cancel_immediately boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  v_subscription record;
BEGIN
  SELECT * INTO v_subscription FROM public.user_subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  IF v_subscription.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription is not active');
  END IF;
  
  IF p_cancel_immediately THEN
    UPDATE public.user_subscriptions SET status = 'cancelled', cancelled_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
    WHERE id = p_subscription_id;
  ELSE
    UPDATE public.user_subscriptions SET cancel_at_period_end = true, updated_at = timezone('utc'::text, now())
    WHERE id = p_subscription_id;
  END IF;
  
  INSERT INTO public.billing_history (user_id, event_type, description, related_subscription_id)
  VALUES (v_subscription.user_id, 'subscription_cancelled', format('Subscription cancelled %s', CASE WHEN p_cancel_immediately THEN 'immediately' ELSE 'at period end' END), p_subscription_id);
  
  RETURN jsonb_build_object('success', true, 'cancelled_immediately', p_cancel_immediately);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  IF p_pack_id IS NOT NULL THEN
    SELECT credits INTO v_credits FROM public.credit_packs WHERE pack_id = p_pack_id;
  END IF;
  
  INSERT INTO public.payments (user_id, payment_type, amount_inr, status, razorpay_order_id, plan_id, pack_id, credits_purchased, billing_cycle, metadata)
  VALUES (p_user_id, p_payment_type, p_amount_inr, 'pending', p_razorpay_order_id, p_plan_id, p_pack_id, v_credits, p_billing_cycle, p_metadata)
  RETURNING id INTO v_payment_id;
  
  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'order_id', p_razorpay_order_id);
  
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
  SELECT * INTO v_payment FROM public.payments WHERE razorpay_order_id = p_razorpay_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;
  
  UPDATE public.payments
  SET status = 'completed', razorpay_payment_id = p_razorpay_payment_id, razorpay_signature = p_razorpay_signature, completed_at = timezone('utc'::text, now())
  WHERE razorpay_order_id = p_razorpay_order_id;
  
  IF v_payment.payment_type IN ('subscription', 'renewal', 'upgrade', 'downgrade') THEN
    v_result := public.create_or_update_subscription(v_payment.user_id, v_payment.plan_id, v_payment.billing_cycle, NULL, NULL);
  ELSIF v_payment.payment_type = 'credit_pack' THEN
    v_result := public.update_user_credits(v_payment.user_id, 'credit', v_payment.credits_purchased, NULL, NULL,
      format('Purchased %s credits', v_payment.credits_purchased),
      jsonb_build_object('source', 'credit_pack', 'pack_id', v_payment.pack_id, 'payment_id', v_payment.id)
    );
  END IF;
  
  INSERT INTO public.billing_history (user_id, event_type, description, amount_inr, credits_change, related_payment_id)
  VALUES (v_payment.user_id, 'payment_completed', format('Payment completed for %s', v_payment.payment_type), v_payment.amount_inr, v_payment.credits_purchased, v_payment.id);
  
  RETURN jsonb_build_object('success', true, 'payment_id', v_payment.id);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- STEP 6: CREATE TRIGGERS
-- ================================================

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
-- STEP 7: GRANT PERMISSIONS
-- ================================================

GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT SELECT ON public.credit_packs TO authenticated, anon;
GRANT SELECT ON public.billing_config TO authenticated;

-- ================================================
-- COMPLETION
-- ================================================

SELECT 
  'Billing system migration completed successfully!' AS status,
  (SELECT COUNT(*) FROM public.subscription_plans) AS plans_created,
  (SELECT COUNT(*) FROM public.credit_packs) AS packs_created,
  (SELECT COUNT(*) FROM public.billing_config) AS config_entries;
