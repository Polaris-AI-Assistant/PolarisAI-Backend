-- Create table for storing Google Docs OAuth tokens
CREATE TABLE IF NOT EXISTS docs_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  tokens JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_docs_tokens_user_id ON docs_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_tokens_email ON docs_tokens(email);

-- Disable Row Level Security (RLS) as per user requirement
ALTER TABLE docs_tokens DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT ALL ON docs_tokens TO authenticated;

-- Add helpful comment
COMMENT ON TABLE docs_tokens IS 'Stores OAuth tokens for Google Docs API access (RLS disabled)';
