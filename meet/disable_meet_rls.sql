-- Disable RLS for meet_tokens table
-- This matches the pattern used for other OAuth token tables (gmail_tokens, forms_tokens, etc.)

ALTER TABLE meet_tokens DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'meet_tokens';
