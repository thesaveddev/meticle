-- Add org-level default rates for domiciliary care
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_hourly_rate_pence INTEGER;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_mileage_rate_pence INTEGER;

-- Add per-visit rate overrides (NULL means use package rate, 0 means unpaid)
ALTER TABLE homecare_visit_plans ADD COLUMN IF NOT EXISTS hourly_rate_pence INTEGER;
ALTER TABLE homecare_visit_plans ADD COLUMN IF NOT EXISTS mileage_rate_pence INTEGER;

-- Add per-visit rate overrides on the visits table itself
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS hourly_rate_pence INTEGER;
ALTER TABLE homecare_visits ADD COLUMN IF NOT EXISTS mileage_rate_pence INTEGER;
