-- ================================================
-- DISABLE RLS ON CREDIT TABLES
-- ================================================
-- This will allow the backend API to read/write credits
-- Run this in Supabase SQL Editor
-- ================================================

-- Disable RLS on user_credits table
ALTER TABLE public.user_credits DISABLE ROW LEVEL SECURITY;

-- Disable RLS on credit_transactions table
ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;

-- Disable RLS on credit_costs table
ALTER TABLE public.credit_costs DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user_credits', 'credit_transactions', 'credit_costs');

-- Expected output: rls_enabled should be FALSE for all three tables

-- ================================================
-- Test: Fetch credits for a user
-- ================================================
-- Replace with your actual user_id from the previous query
SELECT 
  user_id,
  balance,
  total_earned,
  total_spent
FROM public.user_credits
LIMIT 1;

-- If you see data, RLS is now disabled and backend should work!
-- ================================================
