-- Incident workflow engine (P0-3) — state machine + tasks + escalation.
--
-- A severity level on its own changes nothing; until now the "workflow" was a
-- 4-value status column nobody policed, so a critical incident could sit
-- unacknowledged with no owner, no deadline and no trace. These tables are the
-- machine that stops that: one workflow per incident (idempotent start — a
-- retry with the same key returns the same workflow, never a duplicate), tasks
-- with owners, due dates and ack tracking, an append-only event log of every
-- transition, and an escalation ledger for unacknowledged work.
--
-- Retries are duplicate-free by UNIQUE(idempotency_key): two starts racing
-- each other converge on one workflow, and the loser reads back the winner.

CREATE TABLE IF NOT EXISTS incident_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  definition_version INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'triaging', 'investigating', 'actioning', 'verifying', 'closed', 'reopened')),
  workstreams JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, incident_id)
);

CREATE TABLE IF NOT EXISTS incident_workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES incident_workflows(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('acknowledge', 'triage', 'investigate', 'action', 'verify', 'report')),
  title TEXT NOT NULL,
  owner_role TEXT NOT NULL DEFAULT 'MANAGER',
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'overdue', 'escalated')),
  due_at TIMESTAMPTZ NOT NULL,
  ack_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  fallback_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(idempotency_key)
);

CREATE TABLE IF NOT EXISTS incident_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES incident_workflows(id) ON DELETE CASCADE,
  task_id UUID REFERENCES incident_workflow_tasks(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES incident_workflow_tasks(id) ON DELETE CASCADE,
  from_owner TEXT,
  to_owner TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_incident ON incident_workflows(incident_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_due ON incident_workflow_tasks(workflow_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow ON incident_workflow_events(workflow_id, created_at);

ALTER TABLE incident_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_workflows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_workflows;
CREATE POLICY tenant_isolation ON incident_workflows FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_workflow_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_workflow_tasks;
CREATE POLICY tenant_isolation ON incident_workflow_tasks FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_workflow_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_workflow_events;
CREATE POLICY tenant_isolation ON incident_workflow_events FOR ALL USING (org_check(organization_id));

ALTER TABLE incident_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_escalations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON incident_escalations;
CREATE POLICY tenant_isolation ON incident_escalations FOR ALL USING (org_check(organization_id));
