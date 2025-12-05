-- ============================================================================
-- Long-Term Memory System for Polaris AI
-- ============================================================================
-- This migration creates the memories table with pgvector support for 
-- semantic similarity search of user-agent conversation memories.
-- 
-- Prerequisites:
--   1. Enable pgvector extension in Supabase Dashboard -> Database -> Extensions
--   2. Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Enable the pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Memories Table
-- ============================================================================
-- Stores long-term memories from user-agent conversations
-- Each memory contains the combined user query + assistant response,
-- classified by type, and embedded for semantic search.

CREATE TABLE IF NOT EXISTS memories (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference (foreign key to auth.users)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Memory content: combined user message + assistant response
    content TEXT NOT NULL,
    
    -- Memory classification type
    -- "user_profile" → stable preferences, identity, personal info
    -- "behavior_pattern" → habits, repeated behaviors, frequent workflows  
    -- "task_state" → ongoing or incomplete tasks
    -- "cross_app" → info derived from or linking multiple connected apps
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'user_profile', 
        'behavior_pattern', 
        'task_state', 
        'cross_app'
    )),
    
    -- Source application that generated this memory
    source_app TEXT NOT NULL DEFAULT 'chat' CHECK (source_app IN (
        'chat',
        'gmail',
        'github',
        'calendar',
        'docs',
        'sheets',
        'forms',
        'meet',
        'flights',
        'multi-agent'
    )),
    
    -- Vector embedding for semantic similarity search
    -- Using 1536 dimensions (OpenAI text-embedding-3-small default)
    embedding vector(1536),
    
    -- Additional metadata (JSON)
    -- Can store: agents_used, tools_used, conversation_id, tags, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Index for user_id lookups (common filter)
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);

-- Index for memory_type filtering
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);

-- Index for source_app filtering
CREATE INDEX IF NOT EXISTS idx_memories_source_app ON memories(source_app);

-- Index for timestamp ordering
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, memory_type);

-- HNSW index for fast approximate nearest neighbor search on embeddings
-- ef_construction: higher = more accurate but slower index build
-- m: number of connections per node (higher = more accurate but more memory)
CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw 
ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on update
DROP TRIGGER IF EXISTS trigger_memories_updated_at ON memories;
CREATE TRIGGER trigger_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memories_updated_at();

-- ============================================================================
-- RPC Function: match_memories
-- ============================================================================
-- Performs semantic similarity search to find relevant memories for a user.
-- Uses cosine distance for similarity (smaller = more similar).
-- Returns memories sorted by similarity score.
--
-- Parameters:
--   query_embedding: The embedding vector of the current user query
--   p_user_id: The user ID to filter memories for
--   match_count: Maximum number of memories to return (default 5)
--   match_threshold: Minimum similarity threshold (default 0.5, range 0-1)
--
-- Returns: Table of matching memories with similarity scores
-- ============================================================================

CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(1536),
    p_user_id UUID,
    match_count INT DEFAULT 5,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    content TEXT,
    memory_type TEXT,
    source_app TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.user_id,
        m.content,
        m.memory_type,
        m.source_app,
        m.metadata,
        m.created_at,
        m.updated_at,
        -- Calculate cosine similarity (1 - cosine_distance)
        -- Cosine distance: 0 = identical, 2 = opposite
        -- Cosine similarity: 1 = identical, -1 = opposite
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM memories m
    WHERE 
        m.user_id = p_user_id
        AND m.embedding IS NOT NULL
        -- Filter by similarity threshold
        AND (1 - (m.embedding <=> query_embedding)) >= match_threshold
    ORDER BY m.embedding <=> query_embedding  -- Order by distance (ascending = most similar first)
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on the memories table
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own memories
CREATE POLICY "Users can view their own memories"
    ON memories
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own memories
CREATE POLICY "Users can insert their own memories"
    ON memories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own memories
CREATE POLICY "Users can update their own memories"
    ON memories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own memories
CREATE POLICY "Users can delete their own memories"
    ON memories
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Service Role Bypass (for backend operations)
-- ============================================================================
-- The service_role key bypasses RLS, allowing the backend to manage
-- memories on behalf of users. This is necessary for the memory service
-- to insert/query memories using the user_id from the JWT token.

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON memories TO authenticated;

-- Grant permissions to service_role for backend operations
GRANT ALL ON memories TO service_role;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get memory count by type for a user
CREATE OR REPLACE FUNCTION get_memory_stats(p_user_id UUID)
RETURNS TABLE (
    memory_type TEXT,
    count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.memory_type,
        COUNT(*)::BIGINT
    FROM memories m
    WHERE m.user_id = p_user_id
    GROUP BY m.memory_type
    ORDER BY count DESC;
END;
$$;

-- Function to delete old memories (for cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_memories(
    p_user_id UUID,
    days_old INT DEFAULT 90
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM memories
    WHERE user_id = p_user_id
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Sample Queries (for reference)
-- ============================================================================
/*
-- Insert a memory
INSERT INTO memories (user_id, content, memory_type, source_app, embedding, metadata)
VALUES (
    'user-uuid-here',
    'User asked about their calendar events. Assistant listed 3 meetings scheduled for tomorrow.',
    'task_state',
    'calendar',
    '[0.1, 0.2, ...]'::vector(1536),
    '{"agents_used": ["calendar"], "tools_used": ["listEvents"]}'::jsonb
);

-- Find relevant memories using the RPC function
SELECT * FROM match_memories(
    '[0.1, 0.2, ...]'::vector(1536),  -- query embedding
    'user-uuid-here',                   -- user_id
    5,                                  -- match_count
    0.5                                 -- match_threshold
);

-- Get memory statistics
SELECT * FROM get_memory_stats('user-uuid-here');

-- Cleanup old memories
SELECT cleanup_old_memories('user-uuid-here', 90);
*/

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this migration, verify the setup:
-- 1. Check table exists: SELECT * FROM memories LIMIT 1;
-- 2. Check index exists: SELECT indexname FROM pg_indexes WHERE tablename = 'memories';
-- 3. Check function exists: SELECT proname FROM pg_proc WHERE proname = 'match_memories';
-- 4. Check RLS is enabled: SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'memories';
