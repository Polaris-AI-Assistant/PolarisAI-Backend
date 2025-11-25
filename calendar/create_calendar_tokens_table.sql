-- Create calendar_tokens table for storing Google Calendar OAuth tokens
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expiry_date BIGINT,
  scope TEXT,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user_id ON calendar_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_email ON calendar_tokens(email);

-- NOTE: Row Level Security is DISABLED for this table
-- Security is maintained through:
-- 1. API endpoints require authentication (authenticateToken middleware)
-- 2. All queries filter by user_id from authenticated JWT token
-- 3. Supabase service role key is secure on backend

-- Add comment to table
COMMENT ON TABLE calendar_tokens IS 'Stores Google Calendar OAuth tokens for authenticated users. RLS disabled - security via API layer.';
