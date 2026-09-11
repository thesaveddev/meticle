-- Allow draft care packages to be created without a person or start date.
-- These fields are populated later when the package is assigned to a client.

ALTER TABLE homecare_packages
  ALTER COLUMN person_id DROP NOT NULL,
  ALTER COLUMN start_date DROP NOT NULL;

-- Update the CHECK constraint to handle null start_date
ALTER TABLE homecare_packages
  DROP CONSTRAINT IF EXISTS homecare_packages_end_date_check;

ALTER TABLE homecare_packages
  ADD CONSTRAINT homecare_packages_end_date_check
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
