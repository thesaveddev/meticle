-- Pay is added automatically at clock-out — there is no approval gate any more.
-- Backfill rows that were clocked in and out but left waiting for a manual approval
-- that the product no longer requires.
UPDATE homecare_timesheets
SET status = 'approved',
    approved_at = COALESCE(approved_at, NOW()),
    hourly_rate_source = COALESCE(hourly_rate_source, 'unknown'),
    hourly_rate_source_label = COALESCE(hourly_rate_source_label,
      CASE WHEN hourly_rate_pence IS NULL THEN 'Rate source unavailable for legacy timesheet' ELSE 'Historical source not captured' END),
    mileage_rate_source = COALESCE(mileage_rate_source, 'unknown'),
    mileage_rate_source_label = COALESCE(mileage_rate_source_label,
      CASE WHEN mileage_rate_pence IS NULL THEN 'No recorded mileage rate' ELSE 'Historical source not captured' END),
    paid_travel_policy_source = COALESCE(paid_travel_policy_source, 'unknown'),
    paid_travel_policy_label = COALESCE(paid_travel_policy_label, 'Historical travel policy source not captured'),
    rate_calculated_at = COALESCE(rate_calculated_at, NOW()),
    updated_at = NOW()
WHERE status = 'submitted';
