-- ================================================
-- SIMPLE FIX: Initialize Credits (No DO block)
-- ================================================
-- Copy and paste this into Supabase SQL Editor and RUN
-- ================================================

-- Step 1: Find users without credits
SELECT 
  u.id,
  u.email,
  'No credits yet' as status
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.user_id IS NULL;

-- Step 2: Initialize credits for each user (replace USER_ID below)
-- Get the user ID from Step 1 output, then uncomment and run this:

-- SELECT public.initialize_user_credits('PASTE_YOUR_USER_ID_HERE');

-- Step 3: Verify credits were created
-- SELECT 
--   u.email,
--   uc.balance,
--   uc.total_earned,
--   uc.created_at
-- FROM auth.users u
-- JOIN public.user_credits uc ON u.id = uc.user_id
-- ORDER BY uc.created_at DESC;
