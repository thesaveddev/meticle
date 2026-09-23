ALTER TABLE homecare_payroll_reconciliations
  DROP CONSTRAINT IF EXISTS homecare_payroll_reconciliations_status_check;

UPDATE homecare_payroll_reconciliations SET status = 'exported' WHERE status = 'pending';

ALTER TABLE homecare_payroll_reconciliations
  ADD CONSTRAINT homecare_payroll_reconciliations_status_check
  CHECK (status IN ('exported','acknowledged','matched','exception','ignored'));

ALTER TABLE homecare_payroll_reconciliations
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_homecare_payroll_recon_org_status
  ON homecare_payroll_reconciliations (organization_id, status, created_at DESC);
