-- Release 2C follow-up: provider-approved client invoice generation with VAT, funding rules and audit controls.
-- Extends invoice-ready utilisation (073) into an approved invoice artefact without charging Stripe.
-- Runs remain immutable once approved; voiding creates an audited reversal rather than deleting evidence.

ALTER TABLE homecare_client_billing_runs
  ADD COLUMN IF NOT EXISTS vat_rate SMALLINT CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  ADD COLUMN IF NOT EXISTS vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal_pence INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_pence >= 0),
  ADD COLUMN IF NOT EXISTS vat_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS gross_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS funding_breakdown JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_homecare_client_billing_runs_org_invoice
  ON homecare_client_billing_runs(organization_id, invoice_number) WHERE invoice_number IS NOT NULL;

ALTER TABLE homecare_client_billing_lines
  ADD COLUMN IF NOT EXISTS net_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (net_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS vat_rate SMALLINT CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  ADD COLUMN IF NOT EXISTS vat_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS gross_amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_pence >= 0),
  ADD COLUMN IF NOT EXISTS vat_inclusive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funding_applied TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy_applied TEXT;

-- Backfill existing artefacts so aggregate queries do not break (idempotent).
UPDATE homecare_client_billing_runs
SET subtotal_pence = COALESCE(total_amount_pence, 0),
    vat_amount_pence = 0,
    gross_amount_pence = COALESCE(total_amount_pence, 0),
    funding_breakdown = COALESCE(funding_breakdown, '{}'::jsonb)
WHERE subtotal_pence = 0 AND COALESCE(total_amount_pence, 0) <> 0;

UPDATE homecare_client_billing_lines
SET net_amount_pence = COALESCE(amount_pence, 0),
    gross_amount_pence = COALESCE(amount_pence, 0),
    vat_amount_pence = 0
WHERE net_amount_pence = 0 AND COALESCE(amount_pence, 0) <> 0;

-- Convenience: keep total_amount_pence as the gross for legacy callers (future reads should prefer gross_amount_pence).
CREATE OR REPLACE FUNCTION homecare_billing_run_totals_sync() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.total_amount_pence := COALESCE(NEW.gross_amount_pence, NEW.total_amount_pence, 0);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homecare_billing_run_totals ON homecare_client_billing_runs;
CREATE TRIGGER trg_homecare_billing_run_totals
BEFORE INSERT OR UPDATE ON homecare_client_billing_runs
FOR EACH ROW EXECUTE FUNCTION homecare_billing_run_totals_sync();
