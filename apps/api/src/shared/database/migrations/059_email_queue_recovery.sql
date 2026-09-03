-- Recover email jobs left in sending after an API process crash.
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS sending_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_email_queue_sending_recovery
  ON email_queue (status, sending_at)
  WHERE status = 'sending';
