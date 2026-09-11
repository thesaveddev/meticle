-- Release 2C: client billing and package utilisation.
-- This is invoice-ready operational output only; it does not charge Stripe or
-- create a statutory invoice until the provider's funding and cancellation rules
-- have been approved.

ALTER TABLE homecare_packages
  ADD COLUMN IF NOT EXISTS client_rate_pence INTEGER
  CHECK (client_rate_pence IS NULL OR client_rate_pence >= 0);

CREATE TABLE IF NOT EXISTS homecare_client_billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','void')),
  row_count INTEGER NOT NULL DEFAULT 0,
  total_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (total_amount_pence >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (period_to >= period_from)
);

CREATE TABLE IF NOT EXISTS homecare_client_billing_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES homecare_client_billing_runs(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE RESTRICT,
  package_id UUID NOT NULL REFERENCES homecare_packages(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  funding_type VARCHAR(30) NOT NULL,
  visit_status VARCHAR(20) NOT NULL,
  scheduled_minutes INTEGER NOT NULL DEFAULT 0 CHECK (scheduled_minutes >= 0),
  delivered_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delivered_minutes >= 0),
  client_rate_pence INTEGER CHECK (client_rate_pence IS NULL OR client_rate_pence >= 0),
  amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (amount_pence >= 0),
  billing_status VARCHAR(20) NOT NULL CHECK (billing_status IN ('billable','not_billable','review')),
  exclusion_reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, visit_id)
);

CREATE INDEX IF NOT EXISTS idx_homecare_client_billing_runs_org_period
  ON homecare_client_billing_runs(organization_id, period_from, period_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homecare_client_billing_lines_run
  ON homecare_client_billing_lines(organization_id, run_id, billing_status);

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['homecare_client_billing_runs','homecare_client_billing_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
