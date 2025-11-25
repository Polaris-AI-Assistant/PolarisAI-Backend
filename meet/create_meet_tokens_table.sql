-- Create Google Meet tokens table
-- This table stores OAuth tokens for Google Meet integration

CREATE TABLE IF NOT EXISTS public.meet_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT meet_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT meet_tokens_email_key UNIQUE (email),
  CONSTRAINT meet_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS meet_tokens_user_id_idx ON public.meet_tokens(user_id);

-- Add comments for documentation
COMMENT ON TABLE public.meet_tokens IS 'Stores OAuth tokens for Google Meet API access';
COMMENT ON COLUMN public.meet_tokens.email IS 'User email address associated with Google Meet account';
COMMENT ON COLUMN public.meet_tokens.access_token IS 'OAuth access token for API requests';
COMMENT ON COLUMN public.meet_tokens.refresh_token IS 'OAuth refresh token for getting new access tokens';
COMMENT ON COLUMN public.meet_tokens.expiry_date IS 'Unix timestamp when the access token expires';
COMMENT ON COLUMN public.meet_tokens.user_id IS 'Reference to the authenticated user';
