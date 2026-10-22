-- Policy acknowledgement — the record of who has read what.
--
-- The web app has a policy library and the mobile blueprint (§9.7) asks for a
-- support worker to read and acknowledge a policy from the field, but until now
-- there was nowhere to record it: reading left no trace, so no manager could
-- evidence at inspection that a worker had seen the safeguarding policy. This
-- table is that trace — one row per person per policy, refreshed when they
-- re-acknowledge a new version rather than duplicated.
--
-- Keyed on the user rather than the staff profile: acknowledgement is an act of
-- the person, and a leaver's row must survive whatever happens to their profile
-- so the historic record ("who had read it then") stays answerable.
CREATE TABLE IF NOT EXISTS policy_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_id, user_id)
);

-- The manager's view is per organisation and per policy, newest first.
CREATE INDEX IF NOT EXISTS idx_policy_ack_org ON policy_acknowledgements(organization_id);
CREATE INDEX IF NOT EXISTS idx_policy_ack_policy ON policy_acknowledgements(policy_id, acknowledged_at DESC);
-- A worker's own reading history.
CREATE INDEX IF NOT EXISTS idx_policy_ack_user ON policy_acknowledgements(user_id);

ALTER TABLE policy_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_acknowledgements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON policy_acknowledgements;
CREATE POLICY tenant_isolation ON policy_acknowledgements
  FOR ALL USING (org_check(organization_id));
