-- Domiciliary platform subscriptions are sales-led. The old per-client and
-- per-carer values were unused defaults, not MeticleCare subscription prices.
-- A column DEFAULT must be a constant expression; it cannot read billing_config.
ALTER TABLE organizations
  ALTER COLUMN billing_config SET DEFAULT '{
    "domiciliary": {
      "vat_inclusive": false,
      "vat_rate": 20,
      "travel_time_paid": true,
      "pay_inter_client_travel": true,
      "mileage_payment_mode": "approved_rate"
    },
    "mileage_rates": [],
    "payroll_provider": "generic_csv",
    "gps_retention_days": 2920,
    "escalation_policy": {
      "missed_visit_window_minutes": 15,
      "escalation_chain": ["duty_manager", "registered_manager", "on_call"],
      "contact_attempts": 3,
      "contact_interval_minutes": 5
    }
  }'::jsonb;

-- Remove only the untouched legacy defaults; preserve any organisation-specific
-- amounts in case an administrator was using them as internal planning notes.
UPDATE organizations
SET billing_config = jsonb_set(
  billing_config,
  '{domiciliary}',
  (billing_config->'domiciliary') - 'per_client_monthly' - 'per_carer_monthly' - 'per_visit',
  true
)
WHERE billing_config->'domiciliary'->>'per_client_monthly' = '600'
  AND billing_config->'domiciliary'->>'per_carer_monthly' = '200'
  AND billing_config->'domiciliary'->>'per_visit' = '0';
