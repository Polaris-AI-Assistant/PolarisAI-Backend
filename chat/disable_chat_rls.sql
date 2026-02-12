-- Disable RLS on Chat Tables for Realtime to work with custom auth
-- Run this in your Supabase SQL Editor

-- Since this app uses custom authentication (not Supabase Auth),
-- RLS policies based on auth.uid() won't work for realtime subscriptions.
-- Disable RLS to allow realtime updates to work.

-- Disable RLS on chat_messages
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Disable RLS on chat_sessions
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('chat_messages', 'chat_sessions');
