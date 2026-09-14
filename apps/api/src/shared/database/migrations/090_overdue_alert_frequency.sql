-- Add configurable overdue alert frequency per organization
-- Values: 30, 60, 120, 240 (minutes) — default 120 (2 hours, matching existing behavior)

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS overdue_alert_frequency_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE organizations
  ADD CONSTRAINT chk_overdue_alert_frequency CHECK (overdue_alert_frequency_minutes IN (30, 60, 120, 240));
