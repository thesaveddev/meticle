-- Keep the charge actually active in Stripe separate from a replacement quote
-- that may still be awaiting acceptance. This prevents MRR from changing just
-- because sales entered a new draft amount.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domiciliary_active_monthly_price_pence INTEGER;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_domiciliary_active_price_nonnegative
    CHECK (domiciliary_active_monthly_price_pence IS NULL OR domiciliary_active_monthly_price_pence > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill only agreements with recorded acceptance and a Stripe subscription.
UPDATE organizations
SET domiciliary_active_monthly_price_pence = domiciliary_monthly_price_pence
WHERE domiciliary_quote_accepted_at IS NOT NULL
  AND domiciliary_stripe_subscription_id IS NOT NULL
  AND domiciliary_active_monthly_price_pence IS NULL;
