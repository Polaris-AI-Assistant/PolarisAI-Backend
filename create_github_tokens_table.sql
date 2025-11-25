-- Create github_tokens table for storing GitHub OAuth tokens
CREATE TABLE public.github_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  github_user_id text NOT NULL,
  github_username text NOT NULL,
  access_token text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT github_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT github_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT github_tokens_user_id_unique UNIQUE (user_id)
);

-- Add Row Level Security (RLS)
ALTER TABLE public.github_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own tokens
CREATE POLICY "Users can only access their own github tokens" ON public.github_tokens
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.github_tokens TO authenticated;
GRANT USAGE ON SEQUENCE public.github_tokens_id_seq TO authenticated;