-- ============================================
-- File Upload System - Database Schema
-- ============================================
-- This script creates the tables, indexes, and RLS policies
-- for the file upload system with Supabase Storage integration
-- ============================================

-- Create the files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,

  -- File metadata
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,

  -- Storage info
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'user-uploads',
  public_url TEXT,

  -- File type classification
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document', 'audio', 'video', 'other')),

  -- Processing status
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  processing_error TEXT,

  -- Extracted data from file processing
  extracted_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Access control
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for optimal query performance
-- ============================================

-- Index for user's files ordered by creation date
CREATE INDEX IF NOT EXISTS idx_files_user_id 
ON files(user_id, created_at DESC);

-- Index for chat-specific files
CREATE INDEX IF NOT EXISTS idx_files_chat_id 
ON files(chat_id, created_at DESC) 
WHERE chat_id IS NOT NULL;

-- Index for message attachments
CREATE INDEX IF NOT EXISTS idx_files_message_id 
ON files(message_id) 
WHERE message_id IS NOT NULL;

-- Index for processing status queries
CREATE INDEX IF NOT EXISTS idx_files_status 
ON files(status) 
WHERE status IN ('uploading', 'processing');

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_files_file_type 
ON files(file_type);

-- Index for expiration cleanup (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_files_expires_at 
ON files(expires_at) 
WHERE expires_at IS NOT NULL;

-- Index for full-text search on extracted text
CREATE INDEX IF NOT EXISTS idx_files_extracted_text_search 
ON files USING gin(to_tsvector('english', extracted_text)) 
WHERE extracted_text IS NOT NULL;

-- Index for storage path lookup
CREATE INDEX IF NOT EXISTS idx_files_storage_path 
ON files(storage_path);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own files or public files
CREATE POLICY "Users can view own files or public files"
  ON files FOR SELECT
  USING (
    auth.uid() = user_id OR 
    is_public = true
  );

-- Policy: Users can upload their own files
CREATE POLICY "Users can upload own files"
  ON files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
  ON files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON files FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Supabase Storage Bucket Policies
-- ============================================
-- Note: These policies need to be applied in Supabase Dashboard -> Storage -> user-uploads bucket
-- The bucket 'user-uploads' should already be created with RLS DISABLED for service role access

-- IMPORTANT: For backend service role access, disable RLS on the storage bucket
-- Go to Supabase Dashboard -> Storage -> user-uploads -> Settings -> Make bucket PUBLIC
-- Or ensure your backend uses SUPABASE_SERVICE_ROLE_KEY instead of anon key

-- Optional: If you want to enable RLS later, use these policies
-- But they require proper Supabase Auth JWT tokens, not x-user-id headers

-- Storage Policy: Allow service role to upload (bypasses RLS)
-- Storage Policy: Public read access (or use signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- If RLS is enabled, these policies allow access:
-- CREATE POLICY "Allow authenticated uploads"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'user-uploads');

-- CREATE POLICY "Allow authenticated reads"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'user-uploads');

-- CREATE POLICY "Allow authenticated updates"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'user-uploads');

-- CREATE POLICY "Allow authenticated deletes"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'user-uploads');

-- ============================================
-- Triggers and Functions
-- ============================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on file updates
DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get user's total storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage(p_user_id UUID)
RETURNS TABLE (
  total_files BIGINT,
  total_size BIGINT,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_files,
    COALESCE(SUM(size), 0)::BIGINT as total_size,
    ROUND(COALESCE(SUM(size), 0) / (1024.0 * 1024.0), 2) as total_size_mb
  FROM files
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired files
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM files
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Storage Usage Limits (Optional)
-- ============================================

-- Function to check if user has exceeded storage limit
CREATE OR REPLACE FUNCTION check_storage_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_storage_mb NUMERIC;
  storage_limit_mb NUMERIC := 5120; -- 5GB default limit
BEGIN
  -- Get current storage usage
  SELECT total_size_mb INTO user_storage_mb
  FROM get_user_storage_usage(NEW.user_id);
  
  -- Check if adding this file would exceed the limit
  IF (user_storage_mb + (NEW.size / (1024.0 * 1024.0))) > storage_limit_mb THEN
    RAISE EXCEPTION 'Storage limit exceeded. Current usage: % MB, Limit: % MB', 
      user_storage_mb, storage_limit_mb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce storage limits on file insert
DROP TRIGGER IF EXISTS enforce_storage_limit ON files;
CREATE TRIGGER enforce_storage_limit
  BEFORE INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION check_storage_limit();

-- ============================================
-- Analytics View (Optional)
-- ============================================

-- View for file upload analytics
CREATE OR REPLACE VIEW file_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  file_type,
  COUNT(*) as upload_count,
  SUM(size) as total_size,
  ROUND(AVG(size) / (1024.0 * 1024.0), 2) as avg_size_mb,
  COUNT(CASE WHEN status = 'ready' THEN 1 END) as successful_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM files
GROUP BY DATE_TRUNC('day', created_at), file_type
ORDER BY date DESC, file_type;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE files IS 'Stores metadata for all uploaded files with storage references';
COMMENT ON COLUMN files.storage_path IS 'Path in Supabase Storage bucket (format: userId/timestamp-uuid.ext)';
COMMENT ON COLUMN files.extracted_text IS 'Text extracted from PDFs, images (OCR), or audio (transcription)';
COMMENT ON COLUMN files.metadata IS 'JSONB field for file-specific metadata (dimensions, duration, thumbnails, etc.)';
COMMENT ON COLUMN files.status IS 'Processing status: uploading -> processing -> ready/failed';
COMMENT ON COLUMN files.expires_at IS 'Optional expiration date for temporary files';

-- ============================================
-- End of Schema
-- ============================================
