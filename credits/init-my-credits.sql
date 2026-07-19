-- ================================================
-- ONE-LINE FIX: Initialize Credits for All Users
-- ================================================
-- Just copy and paste this ENTIRE file into Supabase SQL Editor
-- and click RUN. That's it!
-- ================================================

-- This will grant 1000 credits to all users who don't have credits yet
DO $
DECLARE
  v_user RECORD;
  v_result jsonb;
  v_count int := 0;
BEGIN
  RAISE NOTICE '⏳ Starting credit initialization...';
  RAISE NOTICE '';
  
  FOR v_user IN 
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.user_credits uc ON u.id = uc.user_id
    WHERE uc.user_id IS NULL
  LOOP
    SELECT public.initialize_user_credits(v_user.id) INTO v_result;
    
    IF v_result->>'success' = 'true' THEN
      v_count := v_count + 1;
      RAISE NOTICE '✅ % - 1000 credits granted', v_user.email;
    ELSE
      RAISE NOTICE '⚠️ % - %', v_user.email, v_result->>'message';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Done! Initialized % user(s)', v_count;
  RAISE NOTICE '';
  RAISE NOTICE '👉 Now refresh your browser to see your credits!';
END $;

-- Verify: Show all users with their credits
SELECT 
  u.email,
  uc.balance as credits,
  uc.created_at as initialized_at
FROM auth.users u
JOIN public.user_credits uc ON u.id = uc.user_id
ORDER BY uc.created_at DESC;
