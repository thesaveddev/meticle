-- Backfill escalation fields for cash check tables created before migration 058
-- was applied against an existing table.
ALTER TABLE cash_balance_checks
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
