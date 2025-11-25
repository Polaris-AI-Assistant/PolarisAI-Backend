-- Disable Row Level Security for calendar_tokens table
-- This allows the backend service role to read/write tokens without user context
-- The backend authenticateToken middleware already ensures security

ALTER TABLE calendar_tokens DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies (they're no longer needed)
DROP POLICY IF EXISTS "Users can view their own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can insert their own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can update their own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can delete their own calendar tokens" ON calendar_tokens;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename = 'calendar_tokens';

-- Expected result: rowsecurity should be 'false'

-- Note: Security is still maintained because:
-- 1. All API endpoints require authentication (authenticateToken middleware)
-- 2. All database operations filter by user_id from the authenticated JWT token
-- 3. The Supabase service role key is kept secure on the backend
