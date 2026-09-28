-- How much of the clinical record may cross the LLM boundary.
--
-- The gap this closes is not a missing feature, it is a missing *decision*.
-- De-identification (migration-era work in ai.redaction.ts) removes identifiers
-- from prompts, but a note reading "refused risperidone, seemed withdrawn"
-- survives that intact. That is still special-category health data about an
-- identifiable person once re-identified against the care record, and it is
-- what a US processor's terms and a UK GDPR Article 9 analysis actually turn
-- on. Pseudonymisation reduces the risk; it does not remove the category.
--
-- So each organisation states its own position, and the value is stored rather
-- than held in a constant. A provider whose DPAs are signed and whose clients
-- accept model-assisted drafting wants the narrative; one facing a local
-- authority audit, or carrying an enhanced confidentiality clause, does not.
-- Recording it means the decision is auditable and belongs to the customer.
--
-- The default is 'full' on purpose, and this is the most important line in the
-- file. Every existing customer's behaviour is byte-identical after this
-- migration, and a privacy control that silently degrades a feature people rely
-- on gets disabled wholesale within a week, taking the stricter option with it.
-- 'minimal' is one setting change away and is the defensible answer to a
-- security questionnaire. Flipping the default later is a deliberate, announced
-- decision rather than something a deploy can do by accident.
--
-- The CHECK keeps this to the two values the code implements. An unrecognised
-- string must not fall through to a silent default, because 'strictly reduced'
-- typed by an integrator would then be honoured as 'full'.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_data_minimisation TEXT NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_ai_data_minimisation_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_ai_data_minimisation_check
      CHECK (ai_data_minimisation IN ('full', 'minimal'));
  END IF;
END $$;
