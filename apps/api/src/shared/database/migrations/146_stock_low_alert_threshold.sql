-- Organization-configurable urgency window for in-app stock run-out alerts.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stock_low_alert_days_threshold INTEGER NOT NULL DEFAULT 7
  CHECK (stock_low_alert_days_threshold BETWEEN 1 AND 90);
