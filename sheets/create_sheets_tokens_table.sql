-- Create sheets_tokens table to store Google Sheets OAuth tokens
CREATE TABLE IF NOT EXISTS public.sheets_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    scope TEXT,
    token_type TEXT DEFAULT 'Bearer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sheets_tokens_user_id ON public.sheets_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sheets_tokens_email ON public.sheets_tokens(email);

-- Disable Row Level Security (RLS) for this table
ALTER TABLE public.sheets_tokens DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheets_tokens TO authenticated;

-- Add comment to table
COMMENT ON TABLE public.sheets_tokens IS 'Stores Google Sheets OAuth tokens for authenticated users';
