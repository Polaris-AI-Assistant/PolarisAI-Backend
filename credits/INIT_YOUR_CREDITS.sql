-- ================================================
-- QUICK FIX: Initialize Credits for Your User
-- ================================================
-- Copy ALL of this and paste into Supabase SQL Editor
-- Then click RUN
-- ================================================

-- This will initialize credits for ALL existing users who don't have them yet
-- It's safe to run multiple times - it won't duplicate credits

-- Initialize credits for all users without credits
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT 
  u.id,
  1000,  -- initial balance
  1000,  -- total earned
  0      -- total spent
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create initial transaction records
INSERT INTO public.credit_transactions (
  user_id, 
  transaction_type, 
  amount,
  balance_before, 
  balance_after, 
  description, 
  status
)
SELECT 
  u.id,
  'initial',
  1000,
  0,
  1000,
  'Initial credit grant for existing user',
  'completed'
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.balance = 1000 
  AND uc.total_earned = 1000 
  AND NOT EXISTS (
    SELECT 1 
    FROM public.credit_transactions ct 
    WHERE ct.user_id = u.id 
    AND ct.transaction_type = 'initial'
  );

-- Show results
SELECT 
  u.email,
  COALESCE(uc.balance, 0) as balance,
  COALESCE(uc.total_earned, 0) as total_earned,
  COALESCE(uc.total_spent, 0) as total_spent,
  CASE 
    WHEN uc.user_id IS NOT NULL THEN '✅ Credits initialized'
    ELSE '❌ No credits'
  END as status
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY u.created_at DESC;

-- ================================================
-- EXPECTED OUTPUT:
-- You should see your email with:
-- - balance: 1000
-- - total_earned: 1000
-- - total_spent: 0
-- - status: ✅ Credits initialized
-- ================================================
