-- Add configurable compliance warning days per organization
-- Default is 14 days; admins can adjust from 7 to 90 days

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS compliance_warning_days INTEGER DEFAULT 14;

-- Constrain to a reasonable range
ALTER TABLE organizations
  ADD CONSTRAINT chk_compliance_warning_days CHECK (compliance_warning_days BETWEEN 7 AND 90);
