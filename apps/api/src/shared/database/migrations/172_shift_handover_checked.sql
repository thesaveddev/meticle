-- A senior checks each shift handover before it is closed.
--
-- Recording a handover is the outgoing worker's duty and acknowledging it is a
-- named colleague's read receipt, but neither says a senior has verified it.
-- The Shift handovers page files handovers as to-check until a manager or
-- admin marks them checked, and reports "checked this week / by a senior" from
-- these two columns. A re-check refreshes the stamp rather than duplicating
-- it: the question at inspection is "who last verified the current wording".
ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS checked_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shift_handovers ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_shift_handovers_checked ON shift_handovers(organization_id, checked_at DESC);
