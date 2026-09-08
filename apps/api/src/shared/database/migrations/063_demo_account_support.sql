-- Add is_demo flag to organizations for the public demo account
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Index for quick demo org lookups
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON organizations(is_demo) WHERE is_demo = TRUE;
