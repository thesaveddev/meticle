-- Ireland: HIQA and Garda vetting. A scoping spike, deliberately incomplete.
--
-- What this adds and, more importantly, what it refuses to add.
--
-- The registry has four nations and no way to express a fifth. Both CHECK
-- constraints on vetting_schemes enumerate the four UK nations and the four UK
-- regulators, so 'ireland' and 'hiqa' are rejected at the database, not just at
-- the TypeScript layer. Widening both is the minimum needed to seed the Garda
-- row, and it is a widening: nothing existing is changed, so this cannot break
-- an English, Welsh, Scottish or Northern Irish provider.
--
-- The Garda row is a real scheme with real sources, and it is shaped very
-- differently from the four UK rows because Garda vetting is not shaped like
-- them. That is the point of the exercise.
--
--   1. No tiers. DBS, PVG and AccessNI all have tiered checks (basic, standard,
--      enhanced, +barred) and a role requirement names one. Garda vetting has no
--      tiers: an organisation applies on behalf of a person, the National
--      Vetting Bureau processes it, and a disclosure comes back. There is one
--      state. Inventing four Garda tiers to fill the column would be exactly the
--      `NI-S1` failure in docs/CLAIM_REGISTER.md — plausible, unfalsifiable, and
--      unable to be looked up. So `tiers` holds a single honest value and the
--      column keeps its meaning for the UK schemes.
--
--      The VALUES block below carries no inline comments, deliberately. A test
--      parses these rows positionally to prove the table and the registry agree,
--      and a comment inside the row breaks that parse — which is how the
--      rationale here would come to be deleted by the next person tidying the
--      file. The `note` column carries the same explanation in a place that
--      cannot be accidentally dropped, because it reaches the settings screen.
--
--   2. required_document_types is EMPTY, deliberately, and this is the single
--      most important line in this file.
--
--      Every UK row carries PASSPORT, VISA and RIGHT_TO_WORK, with the reasoning
--      in migration 128: right-to-work checking is a UK-wide immigration
--      requirement. That reasoning does not travel. Ireland is in the EU and in
--      the Common Travel Area, an Irish citizen has an implicit right to work
--      and needs no visa, and requiring a visa document would report almost every
--      Irish care worker non-compliant for a document that does not apply to
--      them. That is the PVG bug from Scotland all over again, in a new country,
--      and it would be invisible because the compliance check works perfectly —
--      it is the requirement underneath that would be wrong.
--
--      An empty list means we require no identity document until somebody has
--      checked what Irish right-to-work evidence actually is. That is a gap we
--      can see and report. A guessed list is a gap we would not.
--
--      Tracked as T2-29.
--
--   3. Two Garda bodies, and the distinction is operational. Applications go to
--      the National Vetting Bureau at vetting.garda.ie. Disclosures are made by
--      the Garda National Vetting Bureau (GNVB), which is the unit formerly
--      called the Garda Central Vetting Unit, and which comprises Garda Vetting,
--      Criminal Records and ECRIS. A disclosure goes to an authorised liaison
--      person at the organisation, not to the worker or to us — so an Irish
--      provider has to have appointed one, and the product has nowhere to record
--      that. Recorded here as a gap rather than modelled as a guess.
--
-- HIQA is seeded as a regulator because the registry entry is factual and
-- sourced. Its framework is NOT seeded: apps/api/src/modules/cqc/frameworks.ts
-- carries a HIQA draft with an empty theme list and an explicit unverified
-- marker, because HIQA's standards are a PDF nobody here has read. That is
-- deliberate — see the draft's own comment. A framework with invented themes is
-- worse than no framework.
--
-- Both statements are guarded so this file is re-runnable, and both use
-- ON CONFLICT DO NOTHING against the primary keys rather than an existence
-- check, so two concurrent migrators cannot both insert.
ALTER TABLE vetting_schemes
  DROP CONSTRAINT IF EXISTS vetting_schemes_nation_check;
ALTER TABLE vetting_schemes
  ADD CONSTRAINT vetting_schemes_nation_check
  CHECK (nation IN ('england', 'wales', 'scotland', 'northern_ireland', 'ireland'));

ALTER TABLE vetting_schemes
  DROP CONSTRAINT IF EXISTS vetting_schemes_regulator_check;
ALTER TABLE vetting_schemes
  ADD CONSTRAINT vetting_schemes_regulator_check
  CHECK (regulator IN ('cqc', 'ciw', 'care-inspectorate', 'rqia', 'hiqa'));

INSERT INTO vetting_schemes
  (id, nation, regulator, check_name, issuer, tiers, check_document_types, required_document_types, note, is_default)
VALUES
  (
    'garda_vetting_ireland', 'ireland', 'hiqa', 'Garda vetting',
    'National Vetting Bureau, An Garda Síochána',
    ARRAY['garda_vetting_disclosure'],
    ARRAY['GARDA_VETTING'],
    ARRAY[]::TEXT[],
    'Garda vetting is a single process with no tiers: an organisation applies on behalf of a person and receives a disclosure. Disclosures are issued by the Garda National Vetting Bureau and go to an authorised liaison person at the organisation. No identity document is required here yet — Irish right-to-work evidence has not been verified, and the UK PASSPORT/VISA/RIGHT_TO_WORK set does not apply.',
    FALSE
  )
ON CONFLICT (id) DO NOTHING;

-- HIQA, in the same shape as the four existing rows. The format_hint is NULL for
-- the same reason CQC's and RQIA's are: HIQA publishes a register, but nobody here
-- has verified its numbering scheme, and a wrong pattern would reject a real
-- registration number.
INSERT INTO regulators
  (id, name, nations, role, description, registration_label, register_url, format_hint, vetting_scheme, note)
VALUES
  (
    'hiqa', 'Health Information and Quality Authority', ARRAY['ireland'], 'service',
    'Sets national standards for, and regulates, health and social care services in Ireland.',
    'HIQA registration number', 'https://www.hiqa.ie/',
    NULL, 'garda_vetting_ireland',
    'HIQA sets national standards under the Health Act 2007; the standards are approved by the Minister for Health. On 18 August 2026 HIQA announced a review of the National Standards for Residential Care Settings for Older People in Ireland, first published 2009 and updated 2016. The current standards remain in force until the Department of Health decides otherwise. Note that HIQA is not yet a supported regulator in the product: its framework is an explicitly unverified draft.'
  )
ON CONFLICT (id) DO NOTHING;
