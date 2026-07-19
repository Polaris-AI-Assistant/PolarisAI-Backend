-- ================================================
-- Initialize Credits for Existing Users
-- ================================================
-- Run this script ONCE after setting up the credit system
-- to grant initial credits to users who signed up before
-- the credit system was implemented.
-- ================================================

-- Step 1: Check how many users need credits
SELECT 
  COUNT(*) as total_users,
  COUNT(uc.user_id) as users_with_credits,
  COUNT(*) - COUNT(uc.user_id) as users_needing_credits
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id;

-- You should see users_needing_credits > 0 if you have existing users


-- Step 2: Initialize credits for ALL existing users who don't have them yet
-- This uses the function we created, which is safer and logs transactions properly

DO $$
DECLARE
  v_user RECORD;
  v_result jsonb;
  v_success_count int := 0;
  v_skip_count int := 0;
  v_error_count int := 0;
BEGIN
  -- Loop through all users who don't have credits yet
  FOR v_user IN 
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.user_credits uc ON u.id = uc.user_id
    WHERE uc.user_id IS NULL
  LOOP
    BEGIN
      -- Call the initialization function
      SELECT public.initialize_user_credits(v_user.id) INTO v_result;
      
      -- Check result
      IF v_result->>'success' = 'true' THEN
        v_success_count := v_success_count + 1;
        RAISE NOTICE 'Initialized credits for user: % (%)', v_user.email, v_user.id;
      ELSE
        v_skip_count := v_skip_count + 1;
        RAISE NOTICE 'Skipped user: % - %', v_user.email, v_result->>'message';
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE NOTICE 'Error for user %: %', v_user.email, SQLERRM;
    END;
  END LOOP;
  
  -- Summary
  RAISE NOTICE '';
  RAISE NOTICE '=== CREDIT INITIALIZATION SUMMARY ===';
  RAISE NOTICE 'Successfully initialized: %', v_success_count;
  RAISE NOTICE 'Skipped (already had credits): %', v_skip_count;
  RAISE NOTICE 'Errors: %', v_error_count;
  RAISE NOTICE '====================================';
END $$;


-- Step 3: Verify all users now have credits
SELECT 
  COUNT(*) as total_users,
  COUNT(uc.user_id) as users_with_credits,
  COUNT(*) - COUNT(uc.user_id) as users_still_missing_credits
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id;

-- users_still_missing_credits should be 0


-- Step 4: Show sample of initialized users
SELECT 
  u.email,
  uc.balance,
  uc.total_earned,
  uc.total_spent,
  uc.created_at,
  (
    SELECT COUNT(*) 
    FROM public.credit_transactions ct 
    WHERE ct.user_id = u.id AND ct.transaction_type = 'initial'
  ) as has_initial_transaction
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY uc.created_at DESC
LIMIT 10;

-- All users should show:
-- - balance: 1000
-- - total_earned: 1000
-- - total_spent: 0
-- - has_initial_transaction: 1


-- ================================================
-- OPTIONAL: Manual initialization for specific user
-- ================================================
-- If you need to manually initialize credits for a specific user,
-- use this query (replace the user_id):

/*
SELECT public.initialize_user_credits('USER-UUID-HERE');

-- Example:
-- SELECT public.initialize_user_credits('123e4567-e89b-12d3-a456-426614174000');
*/


-- ================================================
-- OPTIONAL: Check transaction history
-- ================================================
-- View all initial credit transactions

SELECT 
  u.email,
  ct.amount,
  ct.balance_before,
  ct.balance_after,
  ct.description,
  ct.created_at
FROM public.credit_transactions ct
JOIN auth.users u ON ct.user_id = u.id
WHERE ct.transaction_type = 'initial'
ORDER BY ct.created_at DESC;


-- ================================================
-- TROUBLESHOOTING
-- ================================================

-- If a user still doesn't have credits, manually add them:
/*
-- Replace USER-UUID and USER-EMAIL
INSERT INTO public.user_credits (user_id, balance, total_earned)
VALUES ('USER-UUID-HERE', 1000, 1000)
ON CONFLICT (user_id) DO UPDATE 
SET balance = 1000, total_earned = 1000;

INSERT INTO public.credit_transactions (
  user_id, transaction_type, amount,
  balance_before, balance_after, description, status
) VALUES (
  'USER-UUID-HERE', 'initial', 1000,
  0, 1000, 'Manual initialization for existing user', 'completed'
);
*/

-- Verify the fix:
/*
SELECT 
  u.email,
  uc.balance,
  uc.total_earned
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE u.id = 'USER-UUID-HERE';
*/


-- ================================================
-- COMPLETED
-- ================================================
-- All existing users should now have 1000 initial credits!
-- New users will automatically receive credits via the 
-- initialize_user_credits function called in auth.js
-- ================================================
