ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS care_capabilities JSONB NOT NULL DEFAULT '{"medication_support": false, "nutrition_support": false}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_organizations_care_capabilities
  ON organizations USING GIN (care_capabilities);
