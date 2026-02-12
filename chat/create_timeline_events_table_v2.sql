-- Timeline Events Table for Polaris AI (V2 - Single Row per Message)
-- This table stores all execution timeline events for a message as a single JSON array
-- Run this SQL in your Supabase SQL Editor

-- First, drop the old table if it exists
DROP TABLE IF EXISTS public.timeline_events;

-- Create the new timeline_events table (one row per message)
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_id text NOT NULL UNIQUE,
  chat_session_id text NOT NULL,
  user_id uuid NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT timeline_events_pkey PRIMARY KEY (id),
  CONSTRAINT timeline_events_message_id_unique UNIQUE (message_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_timeline_events_message_id ON public.timeline_events(message_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_chat_session_id ON public.timeline_events(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON public.timeline_events(user_id);

-- Disable RLS (backend validates user via JWT)
ALTER TABLE public.timeline_events DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;

-- Comment on table and columns
COMMENT ON TABLE public.timeline_events IS 'Stores all execution timeline events for a message as a single JSON array';
COMMENT ON COLUMN public.timeline_events.message_id IS 'The chat message this timeline belongs to (unique)';
COMMENT ON COLUMN public.timeline_events.events IS 'JSON array of all timeline events in sequence';
