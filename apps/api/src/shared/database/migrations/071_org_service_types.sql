-- Add service_types array to organizations for type-aware provisioning.
-- service_types stores which care types the organisation provides.
-- primary_service_type determines the default UI, onboarding, and dashboard.
-- Valid values: 'supported_living', 'domiciliary', 'residential', 'live_in'

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS service_types TEXT[] DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_service_type VARCHAR(30);

-- Backfill existing orgs: all current orgs are supported living
UPDATE organizations 
SET service_types = ARRAY['supported_living']::TEXT[], 
    primary_service_type = 'supported_living' 
WHERE service_types = '{}' OR service_types IS NULL;

-- Add check constraint for valid service types
DO $$ BEGIN
  ALTER TABLE organizations ADD CONSTRAINT chk_service_types_valid 
    CHECK (
      service_types <@ ARRAY['supported_living', 'domiciliary', 'residential', 'live_in']::TEXT[]
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add index for querying by service type
CREATE INDEX IF NOT EXISTS idx_organizations_service_types ON organizations USING GIN(service_types);
CREATE INDEX IF NOT EXISTS idx_organizations_primary_type ON organizations(primary_service_type);
