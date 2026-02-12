-- Timeline Events Table for Polaris AI
-- This table stores execution timeline events for each chat message
-- Run this SQL in your Supabase SQL Editor

-- Create the timeline_events table
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_id text NOT NULL,
  chat_session_id text NOT NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_id text,
  agent_name text,
  tool_name text,
  status text DEFAULT 'executing',
  message text,
  description text,
  icon text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT timeline_events_pkey PRIMARY KEY (id),
  CONSTRAINT timeline_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT timeline_events_chat_session_id_fkey FOREIGN KEY (chat_session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_timeline_events_message_id ON public.timeline_events(message_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_chat_session_id ON public.timeline_events(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_id ON public.timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_created_at ON public.timeline_events(created_at);

-- Enable Row Level Security
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only read their own timeline events
CREATE POLICY "Users can view own timeline events"
  ON public.timeline_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own timeline events
CREATE POLICY "Users can insert own timeline events"
  ON public.timeline_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own timeline events
CREATE POLICY "Users can update own timeline events"
  ON public.timeline_events
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own timeline events
CREATE POLICY "Users can delete own timeline events"
  ON public.timeline_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role has full access to timeline events"
  ON public.timeline_events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT ALL ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;

-- Comment on table and columns
COMMENT ON TABLE public.timeline_events IS 'Stores execution timeline events for AI assistant responses';
COMMENT ON COLUMN public.timeline_events.message_id IS 'The chat message this timeline belongs to';
COMMENT ON COLUMN public.timeline_events.event_type IS 'Type of timeline event (e.g., timeline_agent_executing, timeline_task_completed)';
COMMENT ON COLUMN public.timeline_events.event_id IS 'Unique identifier for update-in-place tracking';
COMMENT ON COLUMN public.timeline_events.agent_name IS 'Name of the agent (calendar, gmail, etc.)';
COMMENT ON COLUMN public.timeline_events.tool_name IS 'Name of the tool being executed';
COMMENT ON COLUMN public.timeline_events.status IS 'Current status (executing, completed, failed)';
COMMENT ON COLUMN public.timeline_events.message IS 'Human-readable message for the event';
COMMENT ON COLUMN public.timeline_events.description IS 'Additional description or details';
COMMENT ON COLUMN public.timeline_events.icon IS 'Icon path for the event';
COMMENT ON COLUMN public.timeline_events.metadata IS 'Additional JSON metadata for the event';
COMMENT ON COLUMN public.timeline_events.sequence_order IS 'Order of events within a message timeline';
