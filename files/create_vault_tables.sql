-- ============================================
-- File Vault - Minimal Database Updates
-- ============================================
-- Simple additions to the existing files table.
-- No complex folders table, no tags table.
-- ============================================

-- Add minimal columns to existing files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_name TEXT;

-- Simple index for fast date-sorted queries
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(user_id, created_at DESC);

-- ============================================
-- End of Vault Schema
-- ============================================
