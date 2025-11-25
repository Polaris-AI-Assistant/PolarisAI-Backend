-- Complete SQL setup for Gmail Message Embeddings with pgvector
-- Copy and paste this entire script into your Supabase SQL Editor and execute

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the gmail_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.gmail_messages (
  id text NOT NULL,
  thread_id text,
  user_id uuid,
  user_email text,
  snippet text,
  subject text,
  sender text,
  recipients text,
  body text,
  date timestamp with time zone,
  labels text[],
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_messages_pkey PRIMARY KEY (id)
);

-- Step 3: Create the gmail_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_tokens_pkey PRIMARY KEY (id)
);

-- Step 4: Create the gmail_message_embeddings table with proper vector type
CREATE TABLE IF NOT EXISTS public.gmail_message_embeddings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  message_id text NOT NULL,
  user_id uuid NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_message_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_message_embeddings_message_id_unique UNIQUE (message_id)
);

-- Step 5: Add foreign key constraints (only if the tables exist)
DO $$
BEGIN
    -- Add foreign key constraint to gmail_messages if auth.users exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- Check if constraint doesn't already exist for gmail_messages
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'gmail_messages' 
            AND constraint_name = 'gmail_messages_user_id_fkey'
        ) THEN
            ALTER TABLE public.gmail_messages 
            ADD CONSTRAINT gmail_messages_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id);
            RAISE NOTICE 'Added foreign key constraint for gmail_messages.user_id';
        END IF;
        
        -- Check if constraint doesn't already exist for gmail_tokens
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'gmail_tokens' 
            AND constraint_name = 'gmail_tokens_user_id_fkey'
        ) THEN
            ALTER TABLE public.gmail_tokens 
            ADD CONSTRAINT gmail_tokens_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id);
            RAISE NOTICE 'Added foreign key constraint for gmail_tokens.user_id';
        END IF;
        
        -- Check if constraint doesn't already exist for gmail_message_embeddings
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'gmail_message_embeddings' 
            AND constraint_name = 'gmail_message_embeddings_user_id_fkey'
        ) THEN
            ALTER TABLE public.gmail_message_embeddings 
            ADD CONSTRAINT gmail_message_embeddings_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id);
            RAISE NOTICE 'Added foreign key constraint for gmail_message_embeddings.user_id';
        END IF;
    ELSE
        RAISE NOTICE 'auth.users table not found - skipping user_id foreign key constraints';
    END IF;
    
    -- Add foreign key constraint from embeddings to messages
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'gmail_message_embeddings' 
        AND constraint_name = 'gmail_message_embeddings_message_id_fkey'
    ) THEN
        ALTER TABLE public.gmail_message_embeddings 
        ADD CONSTRAINT gmail_message_embeddings_message_id_fkey 
        FOREIGN KEY (message_id) REFERENCES public.gmail_messages(id);
        RAISE NOTICE 'Added foreign key constraint for gmail_message_embeddings.message_id';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding foreign key constraints: %. This might be normal.', SQLERRM;
END $$;

-- Step 6: Create the RPC function for vector similarity search
CREATE OR REPLACE FUNCTION search_gmail_messages_by_embedding(
  query_embedding vector(1536),
  search_user_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  message_id text,
  subject text,
  snippet text,
  body text,
  date timestamp with time zone,
  sender text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    gm.id as message_id,
    gm.subject,
    gm.snippet,
    gm.body,
    gm.date,
    gm.sender,
    1 - (gme.embedding <-> query_embedding) as similarity
  FROM gmail_message_embeddings gme
  JOIN gmail_messages gm ON gme.message_id = gm.id
  WHERE gme.user_id = search_user_id
  ORDER BY gme.embedding <-> query_embedding
  LIMIT match_count;
$$;

-- Step 7: Create indexes for better performance (only if you have data)
-- Note: These indexes require some data to exist in the table
-- If you get an error, run the embedding endpoint first, then come back and run these:

DO $$
BEGIN
    -- Check if we have any embeddings first
    IF (SELECT COUNT(*) FROM gmail_message_embeddings) > 0 THEN
        -- Create cosine similarity index
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'gmail_message_embeddings' 
            AND indexname = 'gmail_message_embeddings_embedding_cosine_idx'
        ) THEN
            CREATE INDEX gmail_message_embeddings_embedding_cosine_idx 
            ON gmail_message_embeddings 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
            RAISE NOTICE 'Created cosine similarity index';
        END IF;
        
        -- Create L2 distance index
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'gmail_message_embeddings' 
            AND indexname = 'gmail_message_embeddings_embedding_l2_idx'
        ) THEN
            CREATE INDEX gmail_message_embeddings_embedding_l2_idx 
            ON gmail_message_embeddings 
            USING ivfflat (embedding vector_l2_ops)
            WITH (lists = 100);
            RAISE NOTICE 'Created L2 distance index';
        END IF;
    ELSE
        RAISE NOTICE 'No embeddings found - indexes will be created after you generate some embeddings';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create indexes: %. This is normal if you have no embeddings yet.', SQLERRM;
END $$;

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.gmail_messages TO anon, authenticated;
GRANT ALL ON public.gmail_tokens TO anon, authenticated;
GRANT ALL ON public.gmail_message_embeddings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_gmail_messages_by_embedding TO anon, authenticated;

-- Step 9: Verification queries
-- Check pgvector extension
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') 
    THEN '✅ pgvector extension is enabled'
    ELSE '❌ pgvector extension is NOT enabled'
  END as pgvector_status;

-- Check embedding column type
SELECT 
  column_name, 
  data_type, 
  udt_name,
  CASE 
    WHEN udt_name = 'vector' THEN '✅ Correct vector type'
    ELSE '❌ Wrong type: ' || udt_name
  END as type_status
FROM information_schema.columns 
WHERE table_name = 'gmail_message_embeddings' 
AND column_name = 'embedding';

-- Check unique constraint
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'gmail_message_embeddings' 
      AND constraint_name = 'gmail_message_embeddings_message_id_unique'
    )
    THEN '✅ Unique constraint on message_id exists'
    ELSE '❌ Unique constraint on message_id is missing'
  END as constraint_status;

-- Check RPC function
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'search_gmail_messages_by_embedding'
    )
    THEN '✅ RPC function exists'
    ELSE '❌ RPC function is missing'
  END as function_status;

-- Check current data counts
SELECT 
  (SELECT COUNT(*) FROM gmail_messages) as total_messages,
  (SELECT COUNT(*) FROM gmail_message_embeddings) as total_embeddings,
  (SELECT COUNT(*) FROM gmail_messages WHERE id NOT IN (SELECT message_id FROM gmail_message_embeddings)) as messages_without_embeddings;

-- Final success message
SELECT '🎉 Database setup complete! You can now use the embedding endpoints.' as setup_status;
