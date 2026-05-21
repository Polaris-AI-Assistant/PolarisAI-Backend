-- Add name column to gmail_tokens table to store user's display name from Google
-- This allows us to use the actual user's name when sending emails instead of "the sender"

ALTER TABLE public.gmail_tokens 
ADD COLUMN IF NOT EXISTS name text;

-- Add comment to explain the column
COMMENT ON COLUMN public.gmail_tokens.name IS 'User display name from Google profile, used for email signatures';
