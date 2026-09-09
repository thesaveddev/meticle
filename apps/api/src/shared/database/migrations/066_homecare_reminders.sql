-- Retryable reminder ledger for assigned homecare visits.
CREATE TABLE IF NOT EXISTS homecare_visit_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  reminder_type VARCHAR(30) NOT NULL DEFAULT 'travel_buffer',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (visit_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_homecare_reminders_pending ON homecare_visit_reminders(status, updated_at);

DO $$
BEGIN
  ALTER TABLE homecare_visit_reminders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE homecare_visit_reminders FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON homecare_visit_reminders;
  CREATE POLICY tenant_isolation ON homecare_visit_reminders FOR ALL USING (org_check(organization_id));
EXCEPTION WHEN undefined_function THEN
  RAISE EXCEPTION 'org_check() must exist before homecare reminder migration';
END $$;
