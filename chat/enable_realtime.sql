-- Enable Realtime on Chat Tables
-- Run this in your Supabase SQL Editor

-- 1. Enable realtime for chat_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 2. Enable realtime for chat_sessions table  
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;

-- 3. Grant necessary permissions for realtime (if using RLS)
-- Make sure these policies allow SELECT for authenticated users

-- For chat_messages - allow users to see messages from their own sessions
CREATE POLICY IF NOT EXISTS "Users can view their own chat messages via realtime"
ON chat_messages
FOR SELECT
USING (
  chat_session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()::text
  )
);

-- For chat_sessions - allow users to see their own sessions
CREATE POLICY IF NOT EXISTS "Users can view their own chat sessions via realtime"
ON chat_sessions
FOR SELECT
USING (user_id = auth.uid()::text);

-- 4. If RLS is not enabled, enable it (or skip if already enabled)
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Verify realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
