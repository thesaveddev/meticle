-- Domiciliary rate profiles: explicit organisation defaults with auditable overrides.
CREATE TABLE IF NOT EXISTS homecare_billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  funding_type VARCHAR(30) NOT NULL DEFAULT 'private' CHECK (funding_type IN ('private','local_authority','nhs','other','all')),
  client_rate_pence INTEGER NOT NULL CHECK (client_rate_pence >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS homecare_pay_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hourly_rate_pence INTEGER NOT NULL CHECK (hourly_rate_pence >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

ALTER TABLE homecare_packages ADD COLUMN IF NOT EXISTS billing_profile_id UUID REFERENCES homecare_billing_profiles(id) ON DELETE SET NULL;
ALTER TABLE homecare_packages ADD COLUMN IF NOT EXISTS pay_profile_id UUID REFERENCES homecare_pay_profiles(id) ON DELETE SET NULL;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS pay_profile_id UUID REFERENCES homecare_pay_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_homecare_billing_profiles_org ON homecare_billing_profiles(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_homecare_pay_profiles_org ON homecare_pay_profiles(organization_id, is_active);

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['homecare_billing_profiles','homecare_pay_profiles'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
