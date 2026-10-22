-- AI-suggested corrective actions (blueprint §13.5 step 7): draft action items.
--
-- Until now every corrective action was typed in by hand: the knowledge in
-- the severity assessment, the AI triage and the category never turned into
-- candidate work. These rows are the drafts: a deterministic rule engine
-- proposes them from the incident's own facts (category, severity, harm,
-- investigation findings), and anything the AI triage already recommended
-- (`ai_triage.actions_recommended`) is folded in with its provenance kept.
-- Nothing here assigns work — a suggestion becomes an `incident_action`
-- only when a manager approves it, and rejections are recorded, not deleted,
-- so "the AI suggested X and we said no because Y" stays answerable.
--
-- Idempotency is structural: UNIQUE(incident_id, action) means re-running
-- "suggest" converges on the same draft set instead of multiplying rows.

CREATE TABLE IF NOT EXISTS incident_action_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 500),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  source TEXT NOT NULL DEFAULT 'rules' CHECK (source IN ('rules', 'ai', 'manager')),
  rule_key TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incident_id, action)
);

CREATE INDEX IF NOT EXISTS idx_action_suggestions_incident ON incident_action_suggestions(incident_id, status);

ALTER TABLE incident_action_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_action_suggestions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_action_suggestions;
CREATE POLICY tenant_isolation ON incident_action_suggestions
  FOR ALL USING (org_check(organization_id));
