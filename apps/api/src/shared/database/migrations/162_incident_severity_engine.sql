-- Incident severity engine (P0-2) — deterministic, explainable, versioned.
--
-- Severity used to be a free input plus an AI suggestion nobody could explain:
-- two managers scored the same fall differently and nothing recorded why. These
-- tables make the decision reproducible: versioned rules per org, and an
-- append-only assessment per incident that records the inputs hash, the fired
-- rules, the score, the level and whether it is provisional.
--
-- Invariants enforced in code, not just documented here:
--   - weighted score never downgrades a mandatory escalation;
--   - unknown ≠ no harm (missing data → provisional + owner + deadline);
--   - every reassessment appends a new row (supersedes_id chain), never edits.
-- Overrides need a reason and a manager role; the override itself is a row.

CREATE TABLE IF NOT EXISTS incident_severity_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_from TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, version)
);

CREATE TABLE IF NOT EXISTS incident_severity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  rules_version INTEGER NOT NULL,
  inputs_hash TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER,
  level TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high', 'critical')),
  provisional BOOLEAN NOT NULL DEFAULT false,
  explanation JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  override_reason TEXT,
  supersedes_id UUID REFERENCES incident_severity_assessments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_severity_rules_org ON incident_severity_rules(organization_id, status, version DESC);
CREATE INDEX IF NOT EXISTS idx_severity_assess_incident ON incident_severity_assessments(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_severity_assess_org ON incident_severity_assessments(organization_id);

ALTER TABLE incident_severity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_severity_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_severity_rules;
CREATE POLICY tenant_isolation ON incident_severity_rules
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_severity_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_severity_assessments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_severity_assessments;
CREATE POLICY tenant_isolation ON incident_severity_assessments
  FOR ALL USING (org_check(organization_id));
