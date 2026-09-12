-- Add configurable location threshold per organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS location_threshold_meters INTEGER NOT NULL DEFAULT 500;
ALTER TABLE organizations ADD CONSTRAINT organizations_location_threshold_check CHECK (location_threshold_meters >= 50 AND location_threshold_meters <= 5000);
