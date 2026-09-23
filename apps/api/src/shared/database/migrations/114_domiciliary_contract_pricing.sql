-- Sales-led domiciliary contracts need an explicit agreed amount. Never infer a
-- customer's charge from the legacy per-client/per-carer internal cost fields or
-- the supported-living self-serve plan catalogue.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domiciliary_monthly_price_pence INTEGER,
  ADD COLUMN IF NOT EXISTS domiciliary_stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS domiciliary_quote_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domiciliary_quote_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS domiciliary_stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS domiciliary_price_vat_behavior TEXT;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_domiciliary_monthly_price_nonnegative
    CHECK (domiciliary_monthly_price_pence IS NULL OR domiciliary_monthly_price_pence > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_domiciliary_price_vat_behavior
    CHECK (domiciliary_price_vat_behavior IS NULL OR domiciliary_price_vat_behavior IN ('inclusive', 'exclusive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS domiciliary_billing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('quote_set', 'checkout_started', 'subscription_activated')),
  monthly_price_pence INTEGER,
  stripe_price_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domiciliary_billing_audit_org_created
  ON domiciliary_billing_audit (organization_id, created_at DESC);
