-- Add sequence_order column to chat_messages for reliable message ordering
-- This ensures messages appear in the correct order even if timestamps are identical

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sequence_order INTEGER;

-- Create an index for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_chat_messages_sequence ON chat_messages(chat_session_id, sequence_order);

-- For existing messages, populate sequence_order based on created_at order
WITH ordered_messages AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY chat_session_id ORDER BY created_at) as seq
  FROM chat_messages
)
UPDATE chat_messages 
SET sequence_order = ordered_messages.seq
FROM ordered_messages
WHERE chat_messages.id = ordered_messages.id 
  AND chat_messages.sequence_order IS NULL;
