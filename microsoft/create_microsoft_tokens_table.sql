-- Create Microsoft Tokens Table
-- This table stores OAuth tokens for Microsoft 365 integration
-- Similar structure to Google tokens tables (gmail_tokens, calendar_tokens, etc.)

-- Create the microsoft_tokens table
CREATE TABLE IF NOT EXISTS public.microsoft_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    granted_scopes TEXT[] DEFAULT '{}',
    connected_apps JSONB DEFAULT '{"outlook": false, "calendar": false, "onedrive": false, "excel": false}'::jsonb,
    email TEXT,
    name TEXT,
    microsoft_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one Microsoft connection per user
    CONSTRAINT microsoft_tokens_user_id_unique UNIQUE (user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_user_id ON public.microsoft_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_email ON public.microsoft_tokens(email);
CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_microsoft_id ON public.microsoft_tokens(microsoft_id);

-- Enable Row Level Security
ALTER TABLE public.microsoft_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tokens
CREATE POLICY "Users can view own microsoft tokens"
    ON public.microsoft_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own microsoft tokens"
    ON public.microsoft_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own microsoft tokens"
    ON public.microsoft_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own microsoft tokens"
    ON public.microsoft_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Policy for service role (backend) to manage all tokens
CREATE POLICY "Service role can manage all microsoft tokens"
    ON public.microsoft_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.microsoft_tokens TO authenticated;
GRANT ALL ON public.microsoft_tokens TO service_role;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_microsoft_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_microsoft_tokens_updated_at ON public.microsoft_tokens;
CREATE TRIGGER trigger_microsoft_tokens_updated_at
    BEFORE UPDATE ON public.microsoft_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_microsoft_tokens_updated_at();

-- Comment on table
COMMENT ON TABLE public.microsoft_tokens IS 'Stores OAuth tokens for Microsoft 365 integration (Outlook, Calendar, OneDrive, Excel)';

-- Comments on columns
COMMENT ON COLUMN public.microsoft_tokens.user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN public.microsoft_tokens.access_token IS 'Microsoft OAuth access token';
COMMENT ON COLUMN public.microsoft_tokens.refresh_token IS 'Microsoft OAuth refresh token for getting new access tokens';
COMMENT ON COLUMN public.microsoft_tokens.expires_at IS 'When the access token expires';
COMMENT ON COLUMN public.microsoft_tokens.granted_scopes IS 'Array of scopes granted by the user';
COMMENT ON COLUMN public.microsoft_tokens.connected_apps IS 'JSON object indicating which apps are connected based on scopes';
COMMENT ON COLUMN public.microsoft_tokens.email IS 'User email from Microsoft profile';
COMMENT ON COLUMN public.microsoft_tokens.name IS 'User display name from Microsoft profile';
COMMENT ON COLUMN public.microsoft_tokens.microsoft_id IS 'Microsoft user ID';
