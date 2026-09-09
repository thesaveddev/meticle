-- Phase 2 homecare foundation: domiciliary packages, visits, travel and payroll preparation.
-- Statutory payroll calculation remains outside this schema; these records are an
-- auditable source for manager-approved payroll exports.

CREATE TABLE IF NOT EXISTS homecare_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','ended')),
  funding_type VARCHAR(30) NOT NULL DEFAULT 'private' CHECK (funding_type IN ('private','local_authority','nhs','other')),
  start_date DATE NOT NULL,
  end_date DATE,
  weekly_hours NUMERIC(8,2),
  hourly_rate_pence INTEGER CHECK (hourly_rate_pence IS NULL OR hourly_rate_pence >= 0),
  travel_time_paid BOOLEAN NOT NULL DEFAULT TRUE,
  mileage_rate_pence INTEGER CHECK (mileage_rate_pence IS NULL OR mileage_rate_pence >= 0),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS homecare_visit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES homecare_packages(id) ON DELETE CASCADE,
  visit_type VARCHAR(30) NOT NULL CHECK (visit_type IN ('morning','breakfast','lunch','tea','evening','night','routine','medication','custom')),
  label VARCHAR(255) NOT NULL,
  days_of_week SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,0],
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 720),
  travel_buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (travel_buffer_minutes >= 0 AND travel_buffer_minutes <= 240),
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homecare_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES homecare_packages(id) ON DELETE CASCADE,
  visit_plan_id UUID REFERENCES homecare_visit_plans(id) ON DELETE SET NULL,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  assigned_staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  visit_type VARCHAR(30) NOT NULL,
  label VARCHAR(255) NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','en_route','checked_in','completed','missed','cancelled')),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_latitude NUMERIC(10,7),
  check_in_longitude NUMERIC(10,7),
  check_in_accuracy_meters NUMERIC(8,2),
  check_out_latitude NUMERIC(10,7),
  check_out_longitude NUMERIC(10,7),
  actual_travel_minutes INTEGER CHECK (actual_travel_minutes IS NULL OR actual_travel_minutes >= 0),
  actual_mileage_miles NUMERIC(8,2) CHECK (actual_mileage_miles IS NULL OR actual_mileage_miles >= 0),
  mileage_status VARCHAR(20) NOT NULL DEFAULT 'not_submitted' CHECK (mileage_status IN ('not_submitted','submitted','approved','rejected')),
  late_reason TEXT,
  visit_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (scheduled_end > scheduled_start),
  CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at)
);

CREATE TABLE IF NOT EXISTS homecare_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL UNIQUE REFERENCES homecare_visits(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  work_minutes INTEGER NOT NULL DEFAULT 0 CHECK (work_minutes >= 0),
  travel_minutes INTEGER NOT NULL DEFAULT 0 CHECK (travel_minutes >= 0),
  paid_travel_minutes INTEGER NOT NULL DEFAULT 0 CHECK (paid_travel_minutes >= 0),
  mileage_miles NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (mileage_miles >= 0),
  mileage_rate_pence INTEGER CHECK (mileage_rate_pence IS NULL OR mileage_rate_pence >= 0),
  hourly_rate_pence INTEGER CHECK (hourly_rate_pence IS NULL OR hourly_rate_pence >= 0),
  gross_pay_pence INTEGER CHECK (gross_pay_pence IS NULL OR gross_pay_pence >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_homecare_packages_org_status ON homecare_packages(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_homecare_packages_person ON homecare_packages(person_id);
CREATE INDEX IF NOT EXISTS idx_homecare_visit_plans_package ON homecare_visit_plans(package_id, active);
CREATE INDEX IF NOT EXISTS idx_homecare_visits_org_schedule ON homecare_visits(organization_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_homecare_visits_staff_schedule ON homecare_visits(assigned_staff_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_homecare_timesheets_org_status ON homecare_timesheets(organization_id, status);

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['homecare_packages','homecare_visit_plans','homecare_visits','homecare_timesheets'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
