-- Corrective billing migration. Historical migrations remain immutable.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_org_stripe_invoice
  ON invoices (organization_id, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stripe_webhook_event_id
  ON stripe_webhook_events (event_id);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE organizations ADD CONSTRAINT organizations_grace_period_days_check
  CHECK (grace_period_days BETWEEN 0 AND 30);
