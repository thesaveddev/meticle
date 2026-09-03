-- Add explicit two-person control to daily cash checks.
ALTER TABLE cash_balance_checks
  ADD COLUMN IF NOT EXISTS counted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handed_over_to UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Preserve the original check owner for records created before two-person control.
UPDATE cash_balance_checks
SET counted_by = checked_by
WHERE counted_by IS NULL AND checked_by IS NOT NULL;

ALTER TABLE cash_balance_checks
  DROP CONSTRAINT IF EXISTS cash_balance_checks_different_staff,
  ADD CONSTRAINT cash_balance_checks_different_staff
    CHECK (handed_over_to IS NULL OR (counted_by IS NOT NULL AND handed_over_to <> counted_by)),
  DROP CONSTRAINT IF EXISTS cash_balance_checks_acceptance_pair,
  ADD CONSTRAINT cash_balance_checks_acceptance_pair
    CHECK (
      (accepted_by IS NULL AND accepted_at IS NULL)
      OR (
        accepted_by IS NOT NULL
        AND accepted_at IS NOT NULL
        AND counted_by IS NOT NULL
        AND handed_over_to IS NOT NULL
        AND accepted_by = handed_over_to
      )
    );

CREATE INDEX IF NOT EXISTS idx_cash_checks_handover_pending
  ON cash_balance_checks (organization_id, handed_over_to, accepted_at)
  WHERE handed_over_to IS NOT NULL AND accepted_at IS NULL;
