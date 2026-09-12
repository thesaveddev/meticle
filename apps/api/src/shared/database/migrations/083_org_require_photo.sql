-- Add configurable photo requirement on check-out per organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS require_photo_on_checkout BOOLEAN NOT NULL DEFAULT FALSE;
