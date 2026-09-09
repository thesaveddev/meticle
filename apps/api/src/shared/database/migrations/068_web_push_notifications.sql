-- Browser push subscriptions are user-owned endpoints. The endpoint is unique
-- because a browser profile can only have one active subscription per endpoint.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_org ON push_subscriptions(organization_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON push_subscriptions;
CREATE POLICY tenant_isolation ON push_subscriptions FOR ALL USING (org_check(organization_id));

-- Email and push are separate channels. A successful email must not suppress a
-- pending push, and an unavailable VAPID configuration is recorded as skipped.
ALTER TABLE homecare_visit_reminders
  ADD COLUMN IF NOT EXISTS push_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS push_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_last_error TEXT;

DO $$
BEGIN
  ALTER TABLE homecare_visit_reminders
    ADD CONSTRAINT homecare_visit_reminders_push_status_check
    CHECK (push_status IN ('pending','sent','failed','skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_homecare_reminders_push_retry
  ON homecare_visit_reminders(push_status, updated_at);

-- Existing reminder rows predate push delivery and intentionally remain pending
-- so the next reminder pass can deliver the new channel once.
