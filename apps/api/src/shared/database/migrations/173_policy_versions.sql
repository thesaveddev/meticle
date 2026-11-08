-- Policy version history — the record behind 5.10's Edit/Delete copy.
--
-- The Edit policy dialog tells the manager that "saving creates version 1.1",
-- shows what changed to staff when they are asked to read again, and the Delete
-- dialog warns that "the policy, its versions and all sign-offs will be
-- removed". None of that is answerable from `policies` alone, which keeps only
-- the current row: this table snapshots each saved version with its content and
-- the manager's own note of what changed.
--
-- Snapshots are written by the policies module, never edited: a version row is
-- history the moment it is inserted, and history is append-only. Deleting the
-- policy removes its versions (ON DELETE CASCADE), which is exactly what the
-- Delete dialog promises.
CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  what_changed TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (policy_id, version)
);

-- The version history is per policy, newest first.
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_versions_org ON policy_versions(organization_id);

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON policy_versions;
CREATE POLICY tenant_isolation ON policy_versions
  FOR ALL USING (org_check(organization_id));

-- Read-request reminders (5.10 Ask staff to read): the task a read request
-- files carries the policy it is about, and whether the gentle reminder two
-- days before the read-by date has gone out. Tasks predate policies caring
-- about them, so both columns are nullable and default to "not a read task".
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES policies(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tasks_read_reminder
  ON tasks(policy_id, due_date)
  WHERE reminder_sent_at IS NULL AND status <> 'completed';
