-- Payer accounts and isolated client invoices for domiciliary billing.
CREATE TABLE IF NOT EXISTS homecare_billing_payers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  funding_type VARCHAR(30) NOT NULL CHECK (funding_type IN ('private','local_authority','nhs','other')),
  contact_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  address TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

ALTER TABLE homecare_packages
  ADD COLUMN IF NOT EXISTS payer_account_id UUID REFERENCES homecare_billing_payers(id) ON DELETE SET NULL;

ALTER TABLE homecare_client_billing_lines
  ADD COLUMN IF NOT EXISTS payer_account_id UUID REFERENCES homecare_billing_payers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_homecare_billing_payers_org ON homecare_billing_payers(organization_id, funding_type, name);
CREATE INDEX IF NOT EXISTS idx_homecare_billing_lines_payer ON homecare_client_billing_lines(organization_id, run_id, payer_account_id);

CREATE TABLE IF NOT EXISTS homecare_client_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES homecare_client_billing_runs(id) ON DELETE RESTRICT,
  payer_account_id UUID NOT NULL REFERENCES homecare_billing_payers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','sent','viewed','paid','void')),
  recipient_name VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_address TEXT,
  access_token_hash CHAR(64) UNIQUE,
  token_expires_at TIMESTAMPTZ,
  subtotal_pence INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_pence >= 0),
  vat_rate SMALLINT CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  vat_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_pence >= 0),
  gross_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_pence >= 0),
  funding_breakdown JSONB NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, invoice_number),
  UNIQUE (run_id, payer_account_id)
);

CREATE INDEX IF NOT EXISTS idx_homecare_client_billing_invoices_org_status
  ON homecare_client_billing_invoices(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS homecare_client_billing_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES homecare_client_billing_invoices(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('approved','sent','viewed','paid')),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homecare_client_billing_invoice_events_invoice
  ON homecare_client_billing_invoice_events(organization_id, invoice_id, created_at DESC);

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['homecare_billing_payers','homecare_client_billing_invoices','homecare_client_billing_invoice_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
