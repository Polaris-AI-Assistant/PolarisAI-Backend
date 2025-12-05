-- Create memory_settings table
-- Stores user preferences for memory features

CREATE TABLE IF NOT EXISTS memory_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "categories": {
            "forms": true,
            "docs": true,
            "sheets": true,
            "calendar": true,
            "gmail": true,
            "flights": true,
            "otherArtifacts": true
        },
        "autoDeleteDays": 0,
        "weeklyDigestEnabled": false,
        "weeklyDigestDay": "sunday",
        "weeklyDigestTime": "08:00"
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_memory_settings_user_id ON memory_settings(user_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE memory_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own settings
CREATE POLICY "Users can read own memory settings"
    ON memory_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own memory settings"
    ON memory_settings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own memory settings"
    ON memory_settings
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own memory settings"
    ON memory_settings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE memory_settings IS 'Stores user preferences for memory system features including categories, auto-delete, and weekly digest settings';
