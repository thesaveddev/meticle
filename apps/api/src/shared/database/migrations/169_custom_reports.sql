-- 169: saved custom report configurations for the report builder.
-- A row is a named configuration (dataset + columns + filter conditions +
-- grouping/aggregation + sort), not cached results: running a report always
-- re-executes against live data, and the engine re-validates every stored
-- identifier against its dataset whitelist, so a hand-edited row cannot
-- smuggle arbitrary SQL through the builder.
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  dataset TEXT NOT NULL CHECK (dataset IN ('staff', 'people', 'incidents', 'leave', 'shifts', 'training', 'compliance', 'tasks')),
  columns JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '[]',
  group_by TEXT,
  aggregations JSONB NOT NULL DEFAULT '[]',
  sort_by TEXT,
  sort_dir TEXT NOT NULL DEFAULT 'desc' CHECK (sort_dir IN ('asc', 'desc')),
  row_limit INTEGER NOT NULL DEFAULT 500 CHECK (row_limit BETWEEN 1 AND 5000),
  chart_type TEXT NOT NULL DEFAULT 'table' CHECK (chart_type IN ('table', 'bar', 'pie', 'line')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_reports_org ON custom_reports(organization_id);

-- RLS: members of the org read and manage their own org's configurations;
-- the API role gate (ORG_ADMIN / MANAGER on /reporting/*) decides who may
-- write. Follows the tenant_isolation FOR ALL convention.
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON custom_reports;
CREATE POLICY tenant_isolation ON custom_reports FOR ALL USING (org_check(organization_id));
