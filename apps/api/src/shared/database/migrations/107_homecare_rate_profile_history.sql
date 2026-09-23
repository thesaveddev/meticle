CREATE TABLE IF NOT EXISTS homecare_rate_profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('billing', 'pay')),
  profile_id UUID NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated')),
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homecare_rate_profile_history_org_profile
  ON homecare_rate_profile_history (organization_id, profile_type, profile_id, created_at DESC);

ALTER TABLE homecare_rate_profile_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_rate_profile_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON homecare_rate_profile_history;
DROP POLICY IF EXISTS tenant_isolation_select ON homecare_rate_profile_history;
DROP POLICY IF EXISTS tenant_isolation_insert ON homecare_rate_profile_history;
CREATE POLICY tenant_isolation_select ON homecare_rate_profile_history
  FOR SELECT USING (org_check(organization_id));
CREATE POLICY tenant_isolation_insert ON homecare_rate_profile_history
  FOR INSERT WITH CHECK (org_check(organization_id));