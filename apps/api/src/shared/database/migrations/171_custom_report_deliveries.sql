-- 171: per-schedule delivery history for saved custom reports.
-- The 170 sweep only kept last_run_at / last_error on the schedule row, so a
-- manager could see that a run failed but never what actually went out. Each
-- sweep now appends one row here per schedule it attempted: sent with the
-- recipient and row counts, or failed with the error. The dialog reads the
-- latest rows per schedule; the schedule row stays the liveness signal.
CREATE TABLE IF NOT EXISTS custom_report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  custom_report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES custom_report_schedules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_report_deliveries_schedule
  ON custom_report_deliveries(schedule_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_report_deliveries_org
  ON custom_report_deliveries(organization_id, ran_at DESC);

ALTER TABLE custom_report_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_report_deliveries;
CREATE POLICY tenant_isolation ON custom_report_deliveries FOR ALL USING (org_check(organization_id));
