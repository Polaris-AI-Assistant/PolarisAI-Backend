-- ============================================================================
-- Disable RLS for Memories Table (for Backend Service Role)
-- ============================================================================
-- Run this if the backend is having issues inserting/querying memories.
-- The service_role should bypass RLS, but this ensures it works.
-- ============================================================================

-- Disable RLS on the memories table
ALTER TABLE memories DISABLE ROW LEVEL SECURITY;

-- Alternatively, if you want to keep RLS but allow the backend to bypass it,
-- make sure you're using the service_role key (not anon key) in the backend.

-- Drop existing policies (if any issues)
DROP POLICY IF EXISTS "Users can view their own memories" ON memories;
DROP POLICY IF EXISTS "Users can insert their own memories" ON memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON memories;

-- Re-grant permissions
GRANT ALL ON memories TO authenticated;
GRANT ALL ON memories TO anon;
GRANT ALL ON memories TO service_role;
