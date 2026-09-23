-- Client-specific invoice contacts and invoices. Keep migration 110 immutable.
CREATE TABLE IF NOT EXISTS homecare_client_invoice_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  payer_account_id UUID NOT NULL REFERENCES homecare_billing_payers(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_address TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, person_id, payer_account_id)
);
CREATE INDEX IF NOT EXISTS idx_homecare_invoice_recipients_org
  ON homecare_client_invoice_recipients(organization_id, person_id, payer_account_id);

-- Keep old secure links valid across resend attempts while storing hashes only.
CREATE TABLE IF NOT EXISTS homecare_client_invoice_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES homecare_client_billing_invoices(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homecare_invoice_access_tokens_invoice
  ON homecare_client_invoice_access_tokens(organization_id, invoice_id, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE homecare_client_billing_invoices
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE RESTRICT;

-- Older payer-level invoices remain available internally, but public links and
-- future delivery are restricted to invoices with a client identity.
ALTER TABLE homecare_client_billing_invoices
  DROP CONSTRAINT IF EXISTS homecare_client_billing_invoices_run_id_payer_account_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_homecare_client_invoice_run_payer_person
  ON homecare_client_billing_invoices(run_id, payer_account_id, person_id)
  WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homecare_client_invoices_person
  ON homecare_client_billing_invoices(organization_id, person_id, status);

ALTER TABLE homecare_client_billing_invoice_events
  DROP CONSTRAINT IF EXISTS homecare_client_billing_invoice_events_event_type_check;
ALTER TABLE homecare_client_billing_invoice_events
  ADD CONSTRAINT homecare_client_billing_invoice_events_event_type_check
  CHECK (event_type IN ('approved','sent','viewed','paid','void'));

ALTER TABLE homecare_client_invoice_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_client_invoice_access_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON homecare_client_invoice_access_tokens;
CREATE POLICY tenant_isolation ON homecare_client_invoice_access_tokens
  FOR ALL USING (org_check(organization_id));

ALTER TABLE homecare_client_invoice_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_client_invoice_recipients FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON homecare_client_invoice_recipients;
CREATE POLICY tenant_isolation ON homecare_client_invoice_recipients
  FOR ALL USING (org_check(organization_id));
