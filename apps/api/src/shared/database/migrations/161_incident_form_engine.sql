-- Incident form engine (P0-1) — dynamic, versioned reporting forms.
--
-- Until now the incident report was hardcoded fields in code: category, severity,
-- title, description. A falls report needs different questions than a medication
-- error or a safeguarding concern, and changing a question meant changing code.
-- These tables are the versioned definitions that change makes safe:
--
--   incident_form_definitions: one row per form key per org (e.g. 'general',
--     'falls', 'medication', 'safeguarding'), with a draft/published status and
--     a monotonically increasing version.
--   incident_form_versions: immutable snapshots. Publishing freezes the fields,
--     rules_ref and workflow_ref into a version row that is never updated —
--     so an incident filed last year still reproduces exactly as filed even
--     after the form changes ten times since.
--   incident_field_definitions: one row per field per version. field_key is
--     stable (labels may change; keys never do, so analytics survive renames).
--     Conditions reference values, never labels.
--   incident_answers: append-only answers per incident per field. Amendments
--     create new rows (superseded_by chain); nothing is overwritten, so the
--     history of what was said when stays answerable at inspection.
--
-- Hidden-answer policy per field (clear|preserve_inactive|retain_excluded):
-- when a parent change hides a field, 'clear' drops its answer, the other two
-- keep it for audit but exclude it from validation/submission as appropriate.
-- The evaluate endpoint enforces this; the frontend mirrors for UX only.

CREATE TABLE IF NOT EXISTS incident_form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key ~ '^[a-z0-9_]{1,64}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  effective_from TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, key, version)
);

CREATE TABLE IF NOT EXISTS incident_form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES incident_form_definitions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rules_ref TEXT,
  workflow_ref TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(definition_id, version)
);

CREATE TABLE IF NOT EXISTS incident_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_version_id UUID NOT NULL REFERENCES incident_form_versions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL CHECK (field_key ~ '^[a-z0-9_]{1,64}$'),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  help TEXT,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'boolean', 'radio', 'checkbox', 'repeating')),
  section TEXT,
  ordering INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  defaults JSONB,
  visibility JSONB,
  requiredness JSONB,
  readonly_conditions JSONB,
  repeating JSONB,
  hidden_policy TEXT NOT NULL DEFAULT 'clear' CHECK (hidden_policy IN ('clear', 'preserve_inactive', 'retain_excluded')),
  sensitivity TEXT NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard', 'restricted')),
  analytics_mapping TEXT,
  severity_deps JSONB,
  UNIQUE(form_version_id, field_key)
);

CREATE TABLE IF NOT EXISTS incident_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  form_version_id UUID NOT NULL REFERENCES incident_form_versions(id) ON DELETE RESTRICT,
  field_key TEXT NOT NULL,
  value JSONB,
  superseded_by UUID REFERENCES incident_answers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_incident_form_defs_org ON incident_form_definitions(organization_id, key);
CREATE INDEX IF NOT EXISTS idx_incident_form_versions_def ON incident_form_versions(definition_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_incident_fields_version ON incident_field_definitions(form_version_id, ordering);
CREATE INDEX IF NOT EXISTS idx_incident_answers_incident ON incident_answers(incident_id, field_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_answers_version ON incident_answers(form_version_id);

ALTER TABLE incident_form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_form_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_form_definitions;
CREATE POLICY tenant_isolation ON incident_form_definitions
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_form_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_form_versions;
CREATE POLICY tenant_isolation ON incident_form_versions
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_field_definitions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_field_definitions;
CREATE POLICY tenant_isolation ON incident_field_definitions
  FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_answers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_answers;
CREATE POLICY tenant_isolation ON incident_answers
  FOR ALL USING (org_check(organization_id));
