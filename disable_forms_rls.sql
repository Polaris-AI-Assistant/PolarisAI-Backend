-- OPTION 1: Disable RLS for forms_tokens (to match gmail_tokens and google_calendar_tokens)
-- This is the simplest fix if other token tables don't have RLS

ALTER TABLE forms_tokens DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'forms_tokens';
