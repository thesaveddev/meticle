ALTER TABLE homecare_timesheets
  ADD COLUMN IF NOT EXISTS hourly_rate_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS hourly_rate_source_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mileage_rate_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS mileage_rate_source_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paid_travel_policy_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS paid_travel_policy_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rate_calculated_at TIMESTAMPTZ;

ALTER TABLE homecare_timesheets
  DROP CONSTRAINT IF EXISTS homecare_timesheets_hourly_rate_source_check,
  DROP CONSTRAINT IF EXISTS homecare_timesheets_mileage_rate_source_check,
  DROP CONSTRAINT IF EXISTS homecare_timesheets_paid_travel_policy_source_check;

ALTER TABLE homecare_timesheets
  ADD CONSTRAINT homecare_timesheets_hourly_rate_source_check
    CHECK (hourly_rate_source IS NULL OR hourly_rate_source IN ('visit_override','package','package_profile','carer_profile','manager_override','unknown')),
  ADD CONSTRAINT homecare_timesheets_mileage_rate_source_check
    CHECK (mileage_rate_source IS NULL OR mileage_rate_source IN ('visit_override','package','organisation_policy','organisation_custom','unpaid','hmrc_fallback','unknown')),
  ADD CONSTRAINT homecare_timesheets_paid_travel_policy_source_check
    CHECK (paid_travel_policy_source IS NULL OR paid_travel_policy_source IN ('organisation_policy','package_fallback','manager_override','unpaid','unknown'));
