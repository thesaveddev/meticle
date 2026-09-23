-- A configured sales quote is not permission to charge. The domiciliary admin
-- must explicitly accept the current quote before billing can create a Stripe
-- subscription. Updating the price clears acceptance and requires confirmation.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domiciliary_quote_accepted_at TIMESTAMPTZ;
