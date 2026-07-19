-- ================================================
-- POLARIS AI CREDIT SYSTEM - DATABASE SCHEMA
-- ================================================
-- This schema implements a flexible credit-based pricing system
-- that tracks user credits, agent/tool costs, and transaction history.
-- 
-- Tables:
-- 1. user_credits: Stores each user's current credit balance
-- 2. credit_costs: Configurable costs for each agent/tool
-- 3. credit_transactions: Complete audit log of all credit operations
--
-- Features:
-- - Initial free credits for new users
-- - Configurable costs per agent/tool
-- - Complete transaction history with metadata
-- - Support for credits, debits, refunds, and adjustments
-- ================================================

-- ================================================
-- TABLE: user_credits
-- ================================================
-- Stores the current credit balance for each user
-- One row per user with their available credits

CREATE TABLE IF NOT EXISTS public.user_credits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  balance decimal(10,2) NOT NULL DEFAULT 0,
  total_earned decimal(10,2) NOT NULL DEFAULT 0,
  total_spent decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_credits_pkey PRIMARY KEY (id),
  CONSTRAINT user_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_credits_balance_check CHECK (balance >= 0),
  CONSTRAINT user_credits_earned_check CHECK (total_earned >= 0),
  CONSTRAINT user_credits_spent_check CHECK (total_spent >= 0)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own credits
CREATE POLICY user_credits_select_policy ON public.user_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can only update their own credits (via service role in practice)
CREATE POLICY user_credits_update_policy ON public.user_credits
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.user_credits IS 'Stores credit balance for each user. Updated automatically via credit_transactions.';


-- ================================================
-- TABLE: credit_costs
-- ================================================
-- Configurable cost table for all agents and tools
-- Allows dynamic pricing without code changes

CREATE TABLE IF NOT EXISTS public.credit_costs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  agent_name text NOT NULL,
  tool_name text,
  cost decimal(10,2) NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'standard',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT credit_costs_pkey PRIMARY KEY (id),
  CONSTRAINT credit_costs_agent_tool_unique UNIQUE (agent_name, tool_name),
  CONSTRAINT credit_costs_cost_check CHECK (cost >= 0)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_costs_agent_name ON public.credit_costs(agent_name);
CREATE INDEX IF NOT EXISTS idx_credit_costs_active ON public.credit_costs(is_active) WHERE is_active = true;

-- Comment
COMMENT ON TABLE public.credit_costs IS 'Configurable costs for each agent and tool. Allows dynamic pricing updates.';


-- ================================================
-- TABLE: credit_transactions
-- ================================================
-- Complete audit log of all credit operations
-- Tracks every credit/debit with full metadata

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  transaction_type text NOT NULL,
  amount decimal(10,2) NOT NULL,
  balance_before decimal(10,2) NOT NULL,
  balance_after decimal(10,2) NOT NULL,
  agent_name text,
  tool_name text,
  description text,
  metadata jsonb,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT credit_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT credit_transactions_type_check CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment', 'initial')),
  CONSTRAINT credit_transactions_status_check CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_agent ON public.credit_transactions(agent_name);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON public.credit_transactions(status);

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own transactions
CREATE POLICY credit_transactions_select_policy ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE public.credit_transactions IS 'Complete audit log of all credit operations with full metadata.';


-- ================================================
-- INITIAL CREDIT COSTS CONFIGURATION
-- ================================================
-- Professional, reasonable costs based on agent complexity,
-- API usage, and expected computational cost

-- CONVERSATIONAL AGENT (Pure LLM - Minimal cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('conversational', NULL, 1.0, 'General conversation, Q&A, and coding assistance', 'basic');

-- CALENDAR AGENT (Google API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('calendar', NULL, 2.0, 'Google Calendar operations (create, update, delete events)', 'standard');

-- DOCS AGENT (Google API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('docs', NULL, 2.0, 'Google Docs operations (create, edit documents)', 'standard');

-- SHEETS AGENT (Google API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('sheets', NULL, 2.0, 'Google Sheets operations (create, edit spreadsheets)', 'standard');

-- FORMS AGENT (Google API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('forms', NULL, 2.0, 'Google Forms operations (create, manage forms)', 'standard');

-- MEET AGENT (Google API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('meet', NULL, 2.0, 'Google Meet operations (create meeting spaces)', 'standard');

-- GMAIL AGENT (Google API - Medium cost due to email processing)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('gmail', NULL, 3.0, 'Gmail operations (send, read, search emails)', 'standard');

-- GITHUB AGENT (GitHub API - Medium cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('github', NULL, 3.0, 'GitHub operations (repos, issues, PRs, commits)', 'standard');

-- MICROSOFT AGENT (Microsoft 365 - Medium cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('microsoft', NULL, 3.0, 'Microsoft 365 operations (Outlook, OneDrive, Excel)', 'standard');

-- WEB SEARCH AGENT (Serper API - Medium cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('websearch', NULL, 5.0, 'Web, news, and image search', 'search');

-- FLIGHTS AGENT (SerpAPI - High cost due to external API)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('flights', NULL, 5.0, 'Flight search and price comparison', 'search');

-- MAPS AGENT (Google Maps API - Medium cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('maps', NULL, 4.0, 'Google Maps (places, directions, geocoding)', 'standard');

-- WEATHER AGENT (OpenWeather API - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('weather', NULL, 2.0, 'Weather data and forecasts', 'standard');

-- SCHEDULES AGENT (Internal - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('schedules', NULL, 2.0, 'Reminders and scheduled actions', 'standard');

-- RESEARCH AGENT (Multi-step deep research - Premium cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('research', NULL, 10.0, 'Comprehensive deep research with multiple sources and analysis', 'premium');

-- FILE GENERATION (PDF/TXT generation - Low cost)
INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('file_generation', 'pdf', 3.0, 'Generate PDF documents', 'file');

INSERT INTO public.credit_costs (agent_name, tool_name, cost, description, category) VALUES
('file_generation', 'txt', 1.0, 'Generate text files', 'file');


-- ================================================
-- FUNCTION: Initialize credits for new users
-- ================================================
-- Grants initial free credits to new users
-- Call this function from application code after user signup

CREATE OR REPLACE FUNCTION public.initialize_user_credits(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  initial_credits decimal(10,2) := 1000.00; -- 1000 free credits for new users
  v_exists boolean;
BEGIN
  -- Check if user already has credits
  SELECT EXISTS(
    SELECT 1 FROM public.user_credits WHERE user_id = p_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User already has credits initialized'
    );
  END IF;
  
  -- Create user_credits record with initial balance
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (p_user_id, initial_credits, initial_credits);
  
  -- Log the initial credit transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    status
  ) VALUES (
    p_user_id,
    'initial',
    initial_credits,
    0,
    initial_credits,
    'Welcome bonus - initial free credits',
    'completed'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Initial credits granted successfully',
    'balance', initial_credits
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON FUNCTION public.initialize_user_credits(uuid) IS 'Grants initial free credits to new users. Call from application code after signup.';


-- ================================================
-- TRIGGER: Auto-initialize credits on user signup
-- ================================================
-- Note: Supabase doesn't allow triggers on auth.users directly
-- Instead, we'll create the trigger on public.user_credits
-- and handle initialization via application code or webhook
-- For existing approach, we'll use a different method

-- Since we can't create triggers on auth.users, we'll handle this via:
-- 1. Application code (in auth.js during signup)
-- 2. OR Supabase Auth Webhooks
-- 3. OR Manual initialization for existing users

-- For now, comment out the trigger and we'll handle it in the application layer
-- DROP TRIGGER IF EXISTS trigger_initialize_user_credits ON auth.users;
-- CREATE TRIGGER trigger_initialize_user_credits
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.initialize_user_credits();


-- ================================================
-- FUNCTION: Update user credits with transaction log
-- ================================================
-- Atomically updates user credits and logs the transaction
-- Ensures consistency between balance and transaction history

CREATE OR REPLACE FUNCTION public.update_user_credits(
  p_user_id uuid,
  p_transaction_type text,
  p_amount decimal(10,2),
  p_agent_name text DEFAULT NULL,
  p_tool_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_current_balance decimal(10,2);
  v_new_balance decimal(10,2);
  v_transaction_id bigint;
  v_result jsonb;
BEGIN
  -- Lock the user's credit row for update
  SELECT balance INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- If user doesn't exist, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User credits not found'
    );
  END IF;
  
  -- Calculate new balance based on transaction type
  IF p_transaction_type IN ('credit', 'refund', 'adjustment') THEN
    v_new_balance := v_current_balance + p_amount;
  ELSIF p_transaction_type = 'debit' THEN
    v_new_balance := v_current_balance - p_amount;
    
    -- Check for insufficient credits
    IF v_new_balance < 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient credits',
        'required', p_amount,
        'available', v_current_balance,
        'shortfall', p_amount - v_current_balance
      );
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid transaction type'
    );
  END IF;
  
  -- Update user credits
  UPDATE public.user_credits
  SET 
    balance = v_new_balance,
    total_earned = CASE 
      WHEN p_transaction_type IN ('credit', 'refund') THEN total_earned + p_amount
      ELSE total_earned
    END,
    total_spent = CASE 
      WHEN p_transaction_type = 'debit' THEN total_spent + p_amount
      ELSE total_spent
    END,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    agent_name,
    tool_name,
    description,
    metadata,
    status
  ) VALUES (
    p_user_id,
    p_transaction_type,
    p_amount,
    v_current_balance,
    v_new_balance,
    p_agent_name,
    p_tool_name,
    p_description,
    p_metadata,
    'completed'
  )
  RETURNING id INTO v_transaction_id;
  
  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'balanceBefore', v_current_balance,
    'balanceAfter', v_new_balance,
    'amount', p_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON FUNCTION public.update_user_credits IS 'Atomically updates user credits and logs transaction with full audit trail';


-- ================================================
-- VIEWS: Analytics and Reporting
-- ================================================

-- View: User credit summary with statistics
CREATE OR REPLACE VIEW public.user_credits_summary AS
SELECT 
  uc.user_id,
  uc.balance,
  uc.total_earned,
  uc.total_spent,
  COUNT(ct.id) as total_transactions,
  COUNT(ct.id) FILTER (WHERE ct.transaction_type = 'debit') as total_debits,
  COUNT(ct.id) FILTER (WHERE ct.transaction_type = 'credit') as total_credits,
  uc.created_at as account_created,
  uc.updated_at as last_activity
FROM public.user_credits uc
LEFT JOIN public.credit_transactions ct ON uc.user_id = ct.user_id
GROUP BY uc.user_id, uc.balance, uc.total_earned, uc.total_spent, uc.created_at, uc.updated_at;

-- Comment
COMMENT ON VIEW public.user_credits_summary IS 'Summary view of user credits with transaction statistics';


-- ================================================
-- GRANTS: Ensure proper permissions
-- ================================================

-- Grant permissions (adjust based on your Supabase setup)
-- GRANT SELECT, INSERT, UPDATE ON public.user_credits TO authenticated;
-- GRANT SELECT ON public.credit_costs TO authenticated;
-- GRANT SELECT, INSERT ON public.credit_transactions TO authenticated;


-- ================================================
-- COMPLETED
-- ================================================
-- Credit system schema created successfully!
-- 
-- Next steps:
-- 1. Run this SQL in your Supabase SQL editor
-- 2. Implement credit service in backend code
-- 3. Add credit middleware to agent controllers
-- 4. Update frontend to display credit balance
-- ================================================
