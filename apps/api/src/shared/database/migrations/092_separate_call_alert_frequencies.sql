-- Separate organisation-level repeat frequencies for overdue and unassigned call alerts.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS unassigned_alert_frequency_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE organizations
  ADD CONSTRAINT chk_unassigned_alert_frequency
  CHECK (unassigned_alert_frequency_minutes IN (30, 60, 120, 240));
