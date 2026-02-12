-- Add 'files' JSONB column to chat_messages table
-- Stores file attachment metadata directly on the message for reliable persistence
-- Run this in Supabase SQL Editor

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN chat_messages.files IS 'JSONB array of file attachments: [{id, filename, originalFilename, mimeType, size, url, fileType}]';
