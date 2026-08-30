-- Historical migration drift remediation.
-- Do not edit or rerun migrations 001, 033, or 039.

-- 001: subscription and invoice fields used by the current billing model.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GBP';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- 033: incident fields and evidence table.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_near_miss BOOLEAN DEFAULT FALSE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT FALSE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS investigation_notes TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
ALTER TABLE incident_actions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
CREATE TABLE IF NOT EXISTS incident_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_incident_attachments_incident ON incident_attachments(incident_id);

-- 039: operational workflow fields.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) NOT NULL DEFAULT 'once';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) NOT NULL DEFAULT 'once';
ALTER TABLE person_expenses ALTER COLUMN person_id DROP NOT NULL;
ALTER TABLE person_expenses ADD COLUMN IF NOT EXISTS money_source VARCHAR(20) NOT NULL DEFAULT 'person';
ALTER TABLE person_expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
