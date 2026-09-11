-- Defense-in-depth: enforce tenant isolation at the database level on homecare tables.
-- The application middleware sets app.current_org_id on every request; these policies
-- ensure that even if a query is written without an org_id filter, PostgreSQL blocks
-- cross-tenant data access.

-- Enable RLS on all homecare tables (idempotent).
ALTER TABLE homecare_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_visit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_client_billing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_client_billing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_mileage_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_payroll_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_payroll_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_offline_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_visit_followups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent).
DO $$ BEGIN
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_packages;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_visit_plans;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_visits;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_timesheets;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_client_billing_runs;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_client_billing_lines;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_mileage_policies;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_payroll_exports;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_payroll_reconciliations;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_offline_actions;
  DROP POLICY IF EXISTS homecare_org_isolation ON homecare_visit_followups;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create per-table policies: only allow access where organization_id matches session var.
CREATE POLICY homecare_org_isolation ON homecare_packages
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_visit_plans
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_visits
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_timesheets
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_client_billing_runs
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_client_billing_lines
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_mileage_policies
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_payroll_exports
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_payroll_reconciliations
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_offline_actions
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY homecare_org_isolation ON homecare_visit_followups
  USING (organization_id = current_setting('app.current_org_id')::uuid);
