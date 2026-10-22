-- Incident closeout (P3–P5): investigation, action verification, reporting.
--
-- Until now an incident could be PATCHed straight to closed with no
-- investigation, no verified corrective action and no regulatory record:
-- the status column moved but nothing proved the work happened. These tables
-- are the proof, and POST /incidents/:id/close is the gate that reads them:
--   - incident_investigations: at most one per incident (UNIQUE), opened by a
--     manager, with append-only notes — findings accumulate, never rewrite.
--   - incident_investigation_notes: the append-only trail behind an
--     investigation. New facts append rows; nothing edits them.
--   - incident_actions gains verification: verified_by/at plus an
--     effectiveness rating (effective/partial/ineffective) with notes. A
--     completed action that nobody verified blocks closure — done is not
--     the same as done-and-checked.
--   - incident_reporting_assessments: append-only decisions about external
--     reporting (CQC and others). A CQC-reportable incident cannot close
--     without one naming the outcome.
-- Close rules live in code (transitionStatus-style guarded UPDATE plus
-- blocker queries), so the 409 lists exactly what is missing.

CREATE TABLE IF NOT EXISTS incident_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
  lead_id UUID REFERENCES users(id) ON DELETE SET NULL,
  summary TEXT,
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE(incident_id)
);

CREATE TABLE IF NOT EXISTS incident_investigation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  investigation_id UUID NOT NULL REFERENCES incident_investigations(id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 5000),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_reporting_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  reportable BOOLEAN NOT NULL,
  channel TEXT NOT NULL DEFAULT 'CQC' CHECK (char_length(channel) BETWEEN 1 AND 100),
  reference TEXT,
  reported_at TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE incident_actions
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effectiveness TEXT CHECK (effectiveness IN ('effective', 'partial', 'ineffective')),
  ADD COLUMN IF NOT EXISTS effectiveness_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_investigations_incident ON incident_investigations(incident_id);
CREATE INDEX IF NOT EXISTS idx_investigation_notes_inv ON incident_investigation_notes(investigation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reporting_assess_incident ON incident_reporting_assessments(incident_id, created_at DESC);

ALTER TABLE incident_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_investigations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_investigations;
CREATE POLICY tenant_isolation ON incident_investigations
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_investigation_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_investigation_notes;
CREATE POLICY tenant_isolation ON incident_investigation_notes
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_reporting_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reporting_assessments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_reporting_assessments;
CREATE POLICY tenant_isolation ON incident_reporting_assessments
  FOR ALL USING (org_check(organization_id));
