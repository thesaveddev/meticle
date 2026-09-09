-- Add billing configuration for per-type pricing
-- This stores the organisation's pricing preferences for domiciliary care
-- and configurable mileage rates

-- Add billing_config JSONB column to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_config JSONB DEFAULT '{
  "domiciliary": {
    "per_client_monthly": 600,
    "per_carer_monthly": 200,
    "per_visit": 0,
    "travel_pay_included": false,
    "vat_inclusive": false,
    "vat_rate": 20
  },
  "mileage_rates": [
    {
      "id": "default-car-petrol-2024",
      "tax_year": "2024-25",
      "vehicle_type": "car",
      "fuel_category": "petrol",
      "rate_per_mile": 45,
      "effective_from": "2024-04-06",
      "effective_to": "2025-04-05"
    },
    {
      "id": "default-car-petrol-2025",
      "tax_year": "2025-26",
      "vehicle_type": "car",
      "fuel_category": "petrol",
      "rate_per_mile": 45,
      "effective_from": "2025-04-06",
      "effective_to": "2026-04-05"
    },
    {
      "id": "default-car-diesel-2024",
      "tax_year": "2024-25",
      "vehicle_type": "car",
      "fuel_category": "diesel",
      "rate_per_mile": 45,
      "effective_from": "2024-04-06",
      "effective_to": "2025-04-05"
    },
    {
      "id": "default-car-diesel-2025",
      "tax_year": "2025-26",
      "vehicle_type": "car",
      "fuel_category": "diesel",
      "rate_per_mile": 45,
      "effective_from": "2025-04-06",
      "effective_to": "2026-04-05"
    },
    {
      "id": "default-motorcycle-2024",
      "tax_year": "2024-25",
      "vehicle_type": "motorcycle",
      "fuel_category": "petrol",
      "rate_per_mile": 24,
      "effective_from": "2024-04-06",
      "effective_to": "2025-04-05"
    },
    {
      "id": "default-motorcycle-2025",
      "tax_year": "2025-26",
      "vehicle_type": "motorcycle",
      "fuel_category": "petrol",
      "rate_per_mile": 24,
      "effective_from": "2025-04-06",
      "effective_to": "2026-04-05"
    },
    {
      "id": "default-bicycle-2024",
      "tax_year": "2024-25",
      "vehicle_type": "bicycle",
      "fuel_category": "electric",
      "rate_per_mile": 20,
      "effective_from": "2024-04-06",
      "effective_to": "2025-04-05"
    },
    {
      "id": "default-bicycle-2025",
      "tax_year": "2025-26",
      "vehicle_type": "bicycle",
      "fuel_category": "electric",
      "rate_per_mile": 20,
      "effective_from": "2025-04-06",
      "effective_to": "2026-04-05"
    }
  ],
  "payroll_provider": "generic_csv",
  "gps_retention_days": 2920,
  "escalation_policy": {
    "missed_visit_window_minutes": 15,
    "escalation_chain": [
      "duty_manager",
      "registered_manager",
      "on_call"
    ],
    "contact_attempts": 3,
    "contact_interval_minutes": 5
  }
}';

-- Add GIN index for billing_config queries
CREATE INDEX IF NOT EXISTS idx_organizations_billing_config ON organizations USING GIN(billing_config);
