-- ================================================
-- EMERGENCY: Initialize Your Credits NOW
-- ================================================
-- Copy ALL of this and paste into Supabase SQL Editor
-- Click RUN - it will initialize credits for ALL users
-- ================================================

-- Step 1: Initialize credits for all users without them
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT 
  u.id,
  1000,  -- initial balance
  1000,  -- total earned
  0      -- total spent
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_credits uc WHERE uc.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Create transaction records
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
  uc.user_id,
  'initial',
  1000,
  0,
  1000,
  'Initial credit grant - manual initialization',
  'completed'
FROM public.user_credits uc
WHERE uc.balance = 1000 
  AND uc.total_earned = 1000
  AND NOT EXISTS (
    SELECT 1 
    FROM public.credit_transactions ct 
    WHERE ct.user_id = uc.user_id 
    AND ct.transaction_type = 'initial'
  );

-- Step 3: Verify - Show all users and their credit status
SELECT 
  u.email,
  u.id as user_id,
  COALESCE(uc.balance, 0) as balance,
  COALESCE(uc.total_earned, 0) as total_earned,
  COALESCE(uc.total_spent, 0) as total_spent,
  CASE 
    WHEN uc.user_id IS NOT NULL THEN '✅ HAS CREDITS'
    ELSE '❌ NO CREDITS'
  END as status,
  uc.created_at,
  (
    SELECT COUNT(*) 
    FROM public.credit_transactions ct 
    WHERE ct.user_id = u.id
  ) as transaction_count
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY u.created_at DESC;

-- ================================================
-- EXPECTED RESULT:
-- All users should show:
-- - balance: 1000
-- - status: ✅ HAS CREDITS
-- - transaction_count: 1 or more
-- ================================================
