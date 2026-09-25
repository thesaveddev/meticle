-- The shared-files gallery showed a Size column that could never be
-- populated: org_chat_messages only ever stored the file's URL and name.
-- Recording the size and MIME type at upload time lets the gallery show and
-- sort on real metadata, and lets the message bubble decide on a preview
-- type without guessing from the file extension.
ALTER TABLE org_chat_messages
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_files
  ON org_chat_messages(organization_id, channel, created_at DESC)
  WHERE file_url IS NOT NULL;
