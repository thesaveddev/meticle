-- The provider's compliance warning window — the column that was never there.
--
-- `102_compliance_warning_days.sql` adds this to `organizations` and is not in the
-- registered migration list in `setup.ts` (nor is it in `schema.sql`), so on every
-- database — fresh or upgraded — the column does not exist. Nothing failed loudly:
-- `ComplianceNotificationService.getWarningDays` catches the resulting
-- `column does not exist` error and defaults every provider to 14 days, so the
-- setting was unreachable in both directions and a provider who wanted 30 days got
-- 14 for ever, silently.
--
-- Re-stated here rather than registering 102, because the migration runner refuses
-- an unapplied migration whose version is below the applied watermark — the guard
-- that stops a late insertion rewriting history that has already been applied.
--
-- Idempotent on both halves, so this is safe on a database where somebody applied
-- 102 by hand, and safe to re-run. The column is INTENTIONALLY not added to
-- `schema.sql` as well: two definitions of the same column is how the two drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'compliance_warning_days'
  ) THEN
    ALTER TABLE organizations ADD COLUMN compliance_warning_days INTEGER DEFAULT 14;
  END IF;
END $$;

-- The 7–90 range the setting is documented to accept. A provider that had somehow
-- set a value outside it (a hand-applied 102 with data since edited) would make the
-- constraint fail, so the existing value is clamped first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_compliance_warning_days'
  ) THEN
    UPDATE organizations
       SET compliance_warning_days = LEAST(GREATEST(COALESCE(compliance_warning_days, 14), 7), 90);
    ALTER TABLE organizations ADD CONSTRAINT chk_compliance_warning_days
      CHECK (compliance_warning_days BETWEEN 7 AND 90);
  END IF;
END $$;
