-- 170: scheduled email delivery for saved custom reports.
-- A row attaches a cadence (daily / weekly / monthly at a wall-clock time in
-- the org's own timezone) and a recipient list to a custom_reports row. The
-- hourly delivery sweep picks up rows whose next_run_at has passed, re-runs
-- the report against live data, and emails the CSV. The schedule stores no
-- results — only when to run and who to tell — so editing a schedule cannot
-- change what a report contains, and deleting the report cascades.
CREATE TABLE IF NOT EXISTS custom_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  custom_report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 28),
  send_time TIME NOT NULL,
  recipient_user_ids UUID[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (frequency = 'daily' AND day_of_week IS NULL AND day_of_month IS NULL) OR
    (frequency = 'weekly' AND day_of_week IS NOT NULL AND day_of_month IS NULL) OR
    (frequency = 'monthly' AND day_of_week IS NULL AND day_of_month IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_custom_report_schedules_due
  ON custom_report_schedules(organization_id, next_run_at) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_custom_report_schedules_report
  ON custom_report_schedules(custom_report_id);

-- RLS: members of the org read and manage their own org's schedules; the API
-- role gate (ORG_ADMIN / MANAGER on /reporting/*) decides who may write.
-- Follows the tenant_isolation FOR ALL convention.
ALTER TABLE custom_report_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_report_schedules;
CREATE POLICY tenant_isolation ON custom_report_schedules FOR ALL USING (org_check(organization_id));
