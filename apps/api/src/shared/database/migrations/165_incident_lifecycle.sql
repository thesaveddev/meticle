-- Incident lifecycle (submit / reopen / duplicates) — explicit transitions.
--
-- Until now the incident "workflow" was two disconnected things: a 4-value
-- status column ('reported','investigating','resolved','closed') anyone with
-- PATCH could set to anything, and the workflow engine (163) with its own
-- richer states. Nothing policed the journey between them: a report could go
-- straight from filed to closed with no triage, and a closed incident could
-- never be reopened when new facts emerged — the history just ended.
--
-- This migration adds the missing lifecycle contract:
--   - status gains the intermediate states the workflow engine already uses
--     (draft/submitted/triaging/actioning/verifying/reopened), keeping the
--     four legacy values so existing rows and clients keep working.
--   - reopened_of records lineage: when a follow-up report is filed against
--     a closed incident, the new row points at the incident it continues.
--     In-place reopens (closed -> reopened on the same row) leave it NULL;
--     the reopen itself is recorded in audit_logs + workflow events.
--   - incident_links records manual relationships between incidents
--     (duplicate-of / parent / related), append-only, so repeated reporting
--     of the same event converges instead of multiplying.
--
-- Transition rules live in code (single UPDATE ... WHERE status = ANY(...)),
-- not in CHECK constraints, so a race between two managers cannot both win:
-- the loser gets zero rows and a 409, never a silent overwrite.

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_status_check CHECK (status IN (
    'draft', 'reported', 'submitted', 'triaging', 'investigating',
    'actioning', 'verifying', 'resolved', 'closed', 'reopened'
  ));

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS reopened_of UUID REFERENCES incidents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_reopened_of ON incidents(reopened_of);

CREATE TABLE IF NOT EXISTS incident_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  linked_incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('duplicate', 'parent', 'related')),
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (incident_id != linked_incident_id),
  UNIQUE(incident_id, linked_incident_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_incident_links_incident ON incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_linked ON incident_links(linked_incident_id);

ALTER TABLE incident_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_links;
CREATE POLICY tenant_isolation ON incident_links
  FOR ALL USING (org_check(organization_id));
