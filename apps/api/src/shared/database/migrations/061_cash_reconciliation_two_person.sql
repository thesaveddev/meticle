-- Petty cash reconciliation maker-checker workflow.
-- A request is created by one staff member and changes the balance only after
-- the assigned, independent reviewer accepts it.
CREATE TABLE IF NOT EXISTS cash_reconciliation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  money_source VARCHAR(20) NOT NULL CHECK (money_source IN ('house', 'person')),
  location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
  person_id UUID REFERENCES people(id) ON DELETE RESTRICT,
  expected_balance_pence INTEGER NOT NULL CHECK (expected_balance_pence >= 0),
  actual_balance_pence INTEGER NOT NULL CHECK (actual_balance_pence >= 0),
  variance_pence INTEGER NOT NULL,
  notes TEXT,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  handed_over_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_reconciliation_target CHECK (
    (money_source = 'house' AND location_id IS NOT NULL AND person_id IS NULL)
    OR (money_source = 'person' AND person_id IS NOT NULL AND location_id IS NULL)
  ),
  CONSTRAINT cash_reconciliation_separation CHECK (requested_by <> handed_over_to),
  CONSTRAINT cash_reconciliation_review CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL)
    OR (status = 'accepted' AND reviewed_by = handed_over_to AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)
    OR (status = 'rejected' AND reviewed_by = handed_over_to AND reviewed_at IS NOT NULL AND rejection_reason IS NOT NULL AND length(trim(rejection_reason)) >= 3)
  )
);

CREATE INDEX IF NOT EXISTS idx_cash_reconciliation_org_status
  ON cash_reconciliation_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_reconciliation_reviewer_pending
  ON cash_reconciliation_requests (organization_id, handed_over_to, status)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_reconciliation_one_pending_house_account
  ON cash_reconciliation_requests (organization_id, location_id)
  WHERE status = 'pending' AND money_source = 'house';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_reconciliation_one_pending_person_account
  ON cash_reconciliation_requests (organization_id, person_id)
  WHERE status = 'pending' AND money_source = 'person';

GRANT ALL ON TABLE cash_reconciliation_requests TO meticle_app;
