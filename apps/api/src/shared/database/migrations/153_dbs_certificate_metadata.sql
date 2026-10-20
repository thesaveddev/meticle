-- DBS certificate metadata — the only thing we may hold, and for no longer than
-- six months (docs/DBS_INTEGRATION_PLAN.md §5 phase 0 items 4–5, §6).
--
-- A DBS certificate is not a document we may keep. The DBS model policy permits
-- keeping limited *audit metadata* — issue date, name, certificate type, role,
-- certificate reference number and the recruitment decision — and says not to
-- keep a photocopy, image or copy of the certificate contents. The usual period
-- is no longer than six months after the recruitment decision.
--
-- `dbs_checks` already had the check's own facts (level, workforce, status,
-- times, cost) and two metadata columns nobody wrote to: `certificate_number`
-- and `disclosure_date`. What was missing is the rest of the permitted set —
-- which recruitment decision was taken on the disclosure, and when it is due to
-- be reconsidered — and the retention marker that makes the six-month rule a
-- thing the database enforces rather than a paragraph in a plan.
--
-- `purge_after` is when the certificate *information* must go. The check itself
-- stays: level, workforce, status, the times, the cost and the decision taken on
-- it are the provider's record that a check happened and what they did about it,
-- and none of that is certificate information. `renewal_due_on` likewise
-- survives, because a renewal date is the provider's own marker and holds no
-- detail from the certificate.

ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS recruitment_decision VARCHAR(30);
ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS recruitment_decision_on DATE;
ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS recruitment_decision_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS renewal_due_on DATE;

-- Null until certificate information is recorded. Nothing purges a check that
-- never held a certificate, so an application still in flight keeps the
-- references polling depends on.
ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;
-- Stamped when the purge runs, so the row can say why the fields the provider
-- typed are now empty instead of looking like data loss.
ALTER TABLE dbs_checks ADD COLUMN IF NOT EXISTS certificate_purged_at TIMESTAMPTZ;

-- The recruitment decision vocabulary, applied idempotently: the column arrives
-- unconstrained on an existing database, and a free-text decision would not be
-- countable in a report.
DO $$ BEGIN
  ALTER TABLE dbs_checks DROP CONSTRAINT IF EXISTS dbs_checks_recruitment_decision_check;
  ALTER TABLE dbs_checks ADD CONSTRAINT dbs_checks_recruitment_decision_check
    CHECK (recruitment_decision IS NULL OR recruitment_decision IN ('pending', 'proceed', 'proceed_with_conditions', 'not_proceed', 'withdrawn'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- The purge scan reads only rows still due, so the index is partial.
CREATE INDEX IF NOT EXISTS idx_dbs_checks_purge_due
  ON dbs_checks(purge_after)
  WHERE purge_after IS NOT NULL AND certificate_purged_at IS NULL;

-- Backfill for rows that already hold certificate information. The clock starts
-- at completion where there is one, because that is when the recruitment
-- decision could first have been taken; rows already past their date are cleared
-- by the next nightly sweep, which is the point of the rule rather than a
-- problem with it. Rows holding only a note are left alone: a note is the
-- provider's own annotation, and the metadata endpoint sets a purge date as soon
-- as they record the certificate it was about.
UPDATE dbs_checks
   SET purge_after = COALESCE(completed_at, updated_at, created_at, NOW()) + INTERVAL '6 months'
 WHERE purge_after IS NULL
   AND certificate_purged_at IS NULL
   AND (certificate_number IS NOT NULL OR disclosure_date IS NOT NULL);

-- Name the columns so the rule travels with the schema. `disclosure_date` is the
-- certificate's issue date — it has been called that since the table was created
-- and nothing else has ever written to it — and `certificate_number` is the
-- certificate reference an inspection asks for.
COMMENT ON COLUMN dbs_checks.certificate_number IS 'Certificate reference number. Audit metadata permitted by the DBS model policy; cleared six months after the recruitment decision.';
COMMENT ON COLUMN dbs_checks.disclosure_date IS 'The certificate''s issue date. Audit metadata permitted by the DBS model policy; cleared with the rest of the certificate information.';
COMMENT ON COLUMN dbs_checks.recruitment_decision IS 'The decision taken on the disclosure: pending, proceed, proceed_with_conditions, not_proceed or withdrawn. Survives the purge — it is a fact about the recruitment, not certificate information.';
COMMENT ON COLUMN dbs_checks.renewal_due_on IS 'When the provider wants the check reconsidered. Survives the purge: a renewal marker holds no certificate detail.';
COMMENT ON COLUMN dbs_checks.purge_after IS 'When the certificate information on this row must be deleted. Six months after the recruitment decision (docs/DBS_INTEGRATION_PLAN.md §6).';
COMMENT ON COLUMN dbs_checks.certificate_purged_at IS 'When the certificate information was deleted, so an empty reference reads as a retention decision rather than missing data.';
COMMENT ON COLUMN dbs_checks.notes IS 'Provider''s own note. Cleared with the certificate information, because a free-text field is where a certificate number gets pasted.';
