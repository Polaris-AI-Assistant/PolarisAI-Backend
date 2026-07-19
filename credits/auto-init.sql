-- ================================================
-- AUTO INITIALIZE: Grant Credits to All Users
-- ================================================
-- This will work in Supabase SQL Editor
-- Just copy ALL lines below and click RUN
-- ================================================

-- Initialize credits for ALL users who don't have any yet
-- This calls the function once for each user
SELECT 
  u.email,
  public.initialize_user_credits(u.id) as result
FROM auth.users u
LEFT JOIN public.user_credits uc ON u.id = uc.user_id
WHERE uc.user_id IS NULL;

-- Show results: All users with their credits
SELECT 
  u.email,
  uc.balance as credits,
  uc.total_earned,
  uc.total_spent,
  uc.created_at as initialized_at
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY uc.created_at DESC;
