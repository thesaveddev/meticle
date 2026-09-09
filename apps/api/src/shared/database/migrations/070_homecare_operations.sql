-- Phase 2 operations: field resilience, travel governance, payroll handoff and follow-up audit.

CREATE TABLE IF NOT EXISTS homecare_visit_disruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  disruption_type VARCHAR(40) NOT NULL CHECK (disruption_type IN ('traffic','public_transport','weather','vehicle','client_unavailable','unsafe','other')),
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  description TEXT NOT NULL,
  expected_arrival TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homecare_disruptions_org_status ON homecare_visit_disruptions(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homecare_disruptions_visit ON homecare_visit_disruptions(visit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS homecare_mileage_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_year VARCHAR(9) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL CHECK (vehicle_type IN ('car','motorcycle','bicycle','public_transport','other')),
  fuel_category VARCHAR(30) NOT NULL CHECK (fuel_category IN ('petrol','diesel','hybrid','electric','lpg','not_applicable','other')),
  rate_pence INTEGER NOT NULL CHECK (rate_pence >= 0),
  effective_from DATE,
  effective_to DATE,
  source_label VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  UNIQUE (organization_id, tax_year, vehicle_type, fuel_category)
);
CREATE INDEX IF NOT EXISTS idx_homecare_mileage_policies_org_year ON homecare_mileage_policies(organization_id, tax_year, is_active);

CREATE TABLE IF NOT EXISTS homecare_payroll_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL CHECK (provider IN ('sage','xero','quickbooks','brightpay','staffology','generic_csv')),
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','downloaded','reconciled','failed')),
  row_count INTEGER NOT NULL DEFAULT 0,
  file_checksum VARCHAR(64),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reconciled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (period_to >= period_from)
);
CREATE INDEX IF NOT EXISTS idx_homecare_payroll_exports_org_period ON homecare_payroll_exports(organization_id, period_from, period_to);

CREATE TABLE IF NOT EXISTS homecare_payroll_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  export_id UUID NOT NULL REFERENCES homecare_payroll_exports(id) ON DELETE CASCADE,
  timesheet_id UUID NOT NULL REFERENCES homecare_timesheets(id) ON DELETE RESTRICT,
  external_reference VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','exception','ignored')),
  exported_gross_pay_pence INTEGER,
  reconciled_gross_pay_pence INTEGER,
  note TEXT,
  reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (export_id, timesheet_id)
);
CREATE INDEX IF NOT EXISTS idx_homecare_payroll_recon_export ON homecare_payroll_reconciliations(export_id, status);

CREATE TABLE IF NOT EXISTS homecare_visit_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  followup_type VARCHAR(20) NOT NULL CHECK (followup_type IN ('communication','incident')),
  channel VARCHAR(30),
  recipient VARCHAR(255),
  outcome VARCHAR(30) NOT NULL DEFAULT 'recorded' CHECK (outcome IN ('recorded','attempted','completed','no_answer','escalated')),
  notes TEXT NOT NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homecare_followups_visit ON homecare_visit_followups(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_homecare_followups_org ON homecare_visit_followups(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS homecare_offline_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_key VARCHAR(120) NOT NULL,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('check-in','check-out')),
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  UNIQUE (organization_id, action_key)
);
CREATE INDEX IF NOT EXISTS idx_homecare_offline_actions_visit ON homecare_offline_actions(visit_id, created_at DESC);

-- Existing staff_availability is linked to the organisation through staff_profiles -> users.
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_day ON staff_availability(staff_id, day_of_week, start_time, end_time);

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['homecare_visit_disruptions','homecare_mileage_policies','homecare_payroll_exports','homecare_payroll_reconciliations','homecare_visit_followups','homecare_offline_actions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
