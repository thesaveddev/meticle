-- A cancelled domiciliary subscription may later be restarted on the same quote.
-- Stripe idempotency keys include this generation so recovery does not return the
-- previously cancelled subscription for a legitimate new activation attempt.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domiciliary_subscription_generation BIGINT NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_domiciliary_subscription_generation_nonnegative
    CHECK (domiciliary_subscription_generation >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
