-- SMS notifications (Twilio): per-organisation credentials plus a DB-backed
-- queue with retry, mirroring email_queue.
--
-- `organizations.sms_config` holds `{ enabled, account_sid, auth_token,
-- from_number }`. The secrets are encrypted under the organisation key before
-- they are written (see sms.service.ts) — a Twilio auth token sends paid
-- messages on whoever holds it, so it is not stored the way the AI provider
-- keys are. Reads through the API never return the secrets, masked or not.
--
-- `sms_queue` has no RLS, like `email_queue`: the processor runs outside a
-- request and every access is explicitly scoped by organization_id. The
-- delivery receipts land through the public `/sms/status` webhook, which
-- carries no session and matches rows by the provider SID alone.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sms_config JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS sms_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  to_phone VARCHAR(32) NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1600),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'undelivered', 'failed')),
  provider_sid VARCHAR(64),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  related_entity_type VARCHAR(100),
  related_entity_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON sms_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_queue_provider_sid ON sms_queue(provider_sid);
CREATE INDEX IF NOT EXISTS idx_sms_queue_org ON sms_queue(organization_id, status);
