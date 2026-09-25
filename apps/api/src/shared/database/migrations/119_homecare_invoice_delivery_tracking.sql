-- Correlate the generic SMTP queue with invoice delivery and incoming DSN reports.
ALTER TABLE email_queue
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dsn_id UUID,
  ADD COLUMN IF NOT EXISTS dsn_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dsn_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_dsn_diagnostic TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_queue_dsn_id
  ON email_queue(dsn_id) WHERE dsn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_message_id
  ON email_queue(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_related_entity
  ON email_queue(organization_id, related_entity_type, related_entity_id, created_at DESC)
  WHERE related_entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_dsn_events (
  event_id VARCHAR(255) PRIMARY KEY,
  dsn_id UUID NOT NULL,
  queue_id UUID NOT NULL REFERENCES email_queue(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('delivered','delayed','bounced')),
  recipient VARCHAR(255) NOT NULL,
  diagnostic TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_dsn_events_queue
  ON email_dsn_events(queue_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_dsn_events_dsn
  ON email_dsn_events(dsn_id, received_at DESC);

ALTER TABLE homecare_client_billing_invoices
  ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS delivery_queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_delayed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_diagnostic TEXT;

ALTER TABLE homecare_client_billing_invoices
  DROP CONSTRAINT IF EXISTS homecare_client_billing_invoices_delivery_status_check;
ALTER TABLE homecare_client_billing_invoices
  ADD CONSTRAINT homecare_client_billing_invoices_delivery_status_check
  CHECK (delivery_status IN ('not_sent','queued','accepted','delayed','delivered','bounced','failed','unverified'));

-- Earlier releases marked invoices "sent" as soon as an email was queued.
-- Preserve secure-link opens as delivery proof; downgrade the rest to an
-- explicit unverified state so they can be retried without false claims.
UPDATE homecare_client_billing_invoices
SET delivery_status = 'delivered',
    delivered_at = COALESCE(delivered_at, viewed_at),
    sent_at = COALESCE(viewed_at, sent_at),
    updated_at = NOW()
WHERE status = 'viewed' AND viewed_at IS NOT NULL AND delivery_status = 'not_sent';

UPDATE homecare_client_billing_invoices
SET status = 'approved', delivery_status = 'unverified', sent_at = NULL, updated_at = NOW()
WHERE status = 'sent' AND delivery_status = 'not_sent';

UPDATE homecare_client_billing_invoices
SET delivery_status = 'unverified', updated_at = NOW()
WHERE status IN ('viewed','paid') AND delivery_status = 'not_sent';

ALTER TABLE homecare_client_billing_invoice_events
  DROP CONSTRAINT IF EXISTS homecare_client_billing_invoice_events_event_type_check;

-- The old "sent" event was written during queue insertion. Reclassify it so
-- the audit timeline does not imply provider delivery where none was proven.
UPDATE homecare_client_billing_invoice_events
SET event_type = 'queued',
    details = COALESCE(details, '{}'::jsonb) || jsonb_build_object(
      'delivery_status', 'unverified',
      'note', 'Legacy event recorded queue submission; provider delivery was not verified'
    )
WHERE event_type = 'sent';

ALTER TABLE homecare_client_billing_invoice_events
  ADD CONSTRAINT homecare_client_billing_invoice_events_event_type_check
  CHECK (event_type IN ('approved','queued','accepted','delayed','delivered','bounced','failed','viewed','paid','void'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_homecare_invoice_delivery_queue
  ON homecare_client_billing_invoices(delivery_queue_id) WHERE delivery_queue_id IS NOT NULL;

ALTER TABLE email_dsn_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dsn_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON email_dsn_events;
CREATE POLICY tenant_isolation ON email_dsn_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM homecare_client_billing_invoices invoice
    WHERE invoice.delivery_queue_id = email_dsn_events.queue_id
      AND org_check(invoice.organization_id)
  ));
