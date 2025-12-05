-- Disable RLS on memory_settings table for testing/development
-- WARNING: Only use this in development. Re-enable RLS in production!

ALTER TABLE memory_settings DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can insert own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can update own memory settings" ON memory_settings;
DROP POLICY IF EXISTS "Users can delete own memory settings" ON memory_settings;

-- Optionally, you can re-enable with service role access:
-- ALTER TABLE memory_settings ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Service role can do anything"
--     ON memory_settings
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);
