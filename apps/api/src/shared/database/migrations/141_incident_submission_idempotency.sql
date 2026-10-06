ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS client_submission_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_submission_idempotency
  ON incidents (organization_id, reported_by, client_submission_id)
  WHERE client_submission_id IS NOT NULL;
