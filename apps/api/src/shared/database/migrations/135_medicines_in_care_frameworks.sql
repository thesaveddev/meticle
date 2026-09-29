-- Medicines in care: the records that let Welsh, Scottish and English rules
-- actually differ.
--
-- Before this, the eMAR had exactly one control over who may give a medicine:
-- `staff_profiles.medication_competent`, a boolean a manager ticks. It could
-- not be dated, scoped, or expired, and nothing in the database knew which
-- country the provider was in. Every other requirement that a provider in
-- England, Wales or Scotland is held to was prose in a seeded policy.
--
-- Three specific things were described somewhere and stored nowhere:
--
--   1. A responsible clinician. The frameworks ask for a named registered
--      nurse or pharmacist to be accountable for medicines in the setting.
--      `responsible_clinician` and `medicines_lead` did not appear anywhere in
--      the codebase, so there was no way to record one even if a provider had
--      appointed somebody.
--
--   2. A witness for controlled drugs. The marketing site advertised a
--      "Controlled Drug Register" with "witness sign-off" and "discrepancy
--      alerts". `emedication_administrations` had no witness column at all, and
--      the controlled drug record in the printed MAR drew the witness as
--      "______". A controlled drug could be recorded as given by one person,
--      alone, and the system reported no problem. The two columns below are
--      the smallest change that makes the advertised feature true.
--
--   3. Covert administration. Mentioned once, inside a seeded policy string.
--      Not a column, not a rule, not even a status a dose could carry. This is
--      also the sharpest national difference in the whole subject: covert
--      administration rests on the Mental Capacity Act 2005 in England and
--      Wales, and on the welfare powers in the Mental Welfare (Scotland) Act
--      2000 in Scotland. A system that asked a Scottish provider for a
--      best-interests determination would be asking for the wrong instrument
--      and would accept the wrong document as satisfying the rule.
--
-- The framework column ships NULL, resolved from `organizations.regulator`
-- instead, for the same reason location retention shipped NULL: a stored
-- default would silently become the answer for every provider who never
-- opened the setting, and the regulator a provider is registered with is
-- already recorded, so storing a second copy of it would only be able to
-- disagree with the first.
--
-- Nothing here deletes anything, and nothing here changes a dose that has
-- already been recorded. witness_staff_id is nullable and stays null for every
-- historical controlled drug: those were administered under the rules as they
-- were, and a migration that invented a witness would be falsifying a record.

-- ── The framework this provider operates under ─────────────────────────────
-- An override, not the source of truth. `organizations.regulator` decides it
-- unless somebody has deliberately set this, and a provider who has set it is
-- recorded as having set it.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS medication_framework VARCHAR(40),
  ADD COLUMN IF NOT EXISTS medication_framework_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS medication_framework_set_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_medication_framework_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_medication_framework_check
  CHECK (medication_framework IS NULL OR medication_framework IN ('mca_england', 'awmch_wales', 'scotland_medicines_in_care'));

-- ── 1. The named responsible clinician ─────────────────────────────────────
-- One active row per organisation at a time. Not enforced with a partial unique
-- index because the history matters: an appointment that ended is evidence of
-- who was accountable when, and a care home whose lead changed three times in
-- a year is exactly the thing an inspector asks about.
CREATE TABLE IF NOT EXISTS medication_responsible_clinicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  -- Why these two and not "manager": the frameworks name a registered nurse or
  -- a registered pharmacist. Storing the profession as free text would let a
  -- provider satisfy this with the word "nurse" typed into a text box.
  profession VARCHAR(30) NOT NULL CHECK (profession IN ('registered_nurse', 'registered_pharmacist')),
  -- Where the registration is held. Recorded, not validated: a number format
  -- we guessed wrong would reject a real one, and the check belongs to the
  -- regulator's register, not to us.
  registration_number VARCHAR(60),
  appointed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL means open-ended. A lead with no end date is the normal case; a lead
  -- with an end date is a locum or a handover, and the rules treat the two the
  -- same way because both have to be current.
  ends_at TIMESTAMPTZ,
  appointed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_rc_org ON medication_responsible_clinicians (organization_id, appointed_at DESC);

ALTER TABLE medication_responsible_clinicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_responsible_clinicians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medication_responsible_clinicians_manager ON medication_responsible_clinicians;
CREATE POLICY medication_responsible_clinicians_manager ON medication_responsible_clinicians
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

-- ── 2. Competence with scope, assessor and expiry ──────────────────────────
-- Replaces, for every decision from here on, the single boolean. The boolean
-- stays, because it is on the staff record and other code reads it, but it is
-- no longer the thing that decides. It cannot be: a boolean that was true
-- three years ago is indistinguishable from one set last week, and it cannot
-- express that someone may give an oral medicine but not a controlled drug.
--
-- The scopes are the ones that actually differ in practice. They are not a
-- national list — they are this provider's own scheme, recorded against the
-- framework it was assessed under, because the same scope name means what the
-- local policy says it means.
CREATE TABLE IF NOT EXISTS medication_competences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  scope VARCHAR(40) NOT NULL CHECK (scope IN ('administration', 'controlled_drugs', 'measuring_and_injecting', 'self_administration_assessment')),
  -- Which framework's requirements this was assessed against. A Welsh worker
  -- assessed under MCA and a Scottish one under the Scottish guidance are not
  -- the same assessment, and the record has to say which happened.
  framework VARCHAR(40) NOT NULL CHECK (framework IN ('mca_england', 'awmch_wales', 'scotland_medicines_in_care')),
  -- Who signed it off. Competence signed off by the person it is about is not
  -- an assessment, and the controller refuses that case explicitly.
  --
  -- Nullable, and the reason is the backfill below. A competence carried over
  -- from the old boolean genuinely has no recorded assessor — nobody wrote one
  -- down, ever — and making the column NOT NULL would have meant either failing
  -- the migration or inventing an assessor. Inventing one is worse: it would
  -- put a name on a record saying somebody vouched for a person's ability to
  -- give a controlled drug, and nobody did.
  assessed_by UUID REFERENCES staff_profiles(id),
  -- How this row came to exist. 'recorded' is an assessment somebody entered.
  -- 'backfilled_from_staff_flag' is a pre-existing tick on the staff record
  -- turned into a real, dated, expiring row — true, but weaker evidence, and
  -- the readiness report counts it separately so a manager can see how much of
  -- their assurance rests on a tick box.
  record_source TEXT NOT NULL DEFAULT 'recorded'
    CHECK (record_source IN ('recorded', 'backfilled_from_staff_flag')),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL means no expiry was set. Not the same as "expires in ten years" and
  -- treated as different by the rules: an unexpiring competence is accepted,
  -- and a provider is told on readiness how many of their staff hold one.
  expires_at DATE,
  reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_comp_staff ON medication_competences (staff_id, scope);
CREATE INDEX IF NOT EXISTS idx_med_comp_org ON medication_competences (organization_id, expires_at);

ALTER TABLE medication_competences ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_competences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medication_competences_manager ON medication_competences;
CREATE POLICY medication_competences_manager ON medication_competences
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

-- ── 3. Covert administration, on the right statutory footing ───────────────
-- The national difference, held as data rather than as a branch in three
-- places. `authority` is what the provider is recording, and the rules check
-- it against the framework's instrument: a best-interests record from an
-- English provider is not accepted for a Scottish person, and the reason is
-- visible in the row rather than in a comment.
CREATE TABLE IF NOT EXISTS medication_covert_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  -- Which framework's rules this authorisation was made under. A covert
  -- decision made in England does not travel to Scotland with the person.
  framework VARCHAR(40) NOT NULL CHECK (framework IN ('mca_england', 'awmch_wales', 'scotland_medicines_in_care')),
  -- Named, not free text, because the instrument is the thing being checked
  -- and a free-text field would accept anything including the wrong country.
  authority VARCHAR(60) NOT NULL CHECK (authority IN ('mental_capacity_act_best_interests', 'mental_welfare_act_s19', 'other')),
  -- Required where the framework requires a written protocol, which is where
  -- Scotland differs. Free text, because a protocol is the provider's document
  -- and its name is not ours to normalise.
  protocol_reference TEXT,
  -- Medicines this covers. A covert decision is made about a specific medicine
  -- or group, not about a person in the abstract, and a blanket "covert" on a
  -- chart is the thing these frameworks exist to prevent. Empty means this
  -- authorisation is not yet specific enough to be used.
  medicines TEXT NOT NULL DEFAULT '',
  authorised_by UUID NOT NULL REFERENCES users(id),
  authorised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_due TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_covert_person ON medication_covert_authorizations (person_id, review_due);
CREATE INDEX IF NOT EXISTS idx_med_covert_org ON medication_covert_authorizations (organization_id, authorised_at DESC);

ALTER TABLE medication_covert_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_covert_authorizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medication_covert_authorizations_manager ON medication_covert_authorizations;
CREATE POLICY medication_covert_authorizations_manager ON medication_covert_authorizations
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

-- Carrying the old boolean forward, as dated rows.
--
-- This exists because the alternative is a cliff. A provider who has been
-- running MeticleCare has staff_profiles.medication_competent = true and
-- nothing else, and on the day this migration deploys every one of those doses
-- starts being refused — which is the correct behaviour for a service with no
-- recorded competence and a catastrophic one for a service that has had it for
-- years and whose manager is on a computer, not a phone, at 9am.
--
-- So the tick becomes a row. The statement it makes is true: somebody assessed
-- this person. What is not recoverable is when, by whom, or for which scope, so
-- the row is dated from the staff record's creation, carries no assessor, has
-- no expiry, and is tagged record_source = 'backfilled_from_staff_flag' so the
-- readiness report can show that this is the weakest kind of evidence rather
-- than pretending it is the same as an assessment entered last month.
--
-- Only the general 'administration' scope is backfilled. Controlled-drug
-- competence is deliberately NOT inferred: a boolean that said "may give
-- medication" has never once meant "may give a controlled drug", and inferring
-- it would hand every existing care worker authority nobody assessed them for.
-- They are counted as having none, which is the safe direction to be wrong in.
INSERT INTO medication_competences
  (organization_id, staff_id, scope, framework, assessed_at, record_source, notes)
SELECT
  u.organization_id,
  sp.id,
  'administration',
  -- The framework the provider is under, derived the same way the application
  -- derives it. A Scottish provider's carried-over competence is recorded
  -- against the Scottish framework, so a later review happens under the right
  -- standard rather than the English one by accident.
  CASE o.regulator
    WHEN 'ciw' THEN 'awmch_wales'
    WHEN 'care-inspectorate' THEN 'scotland_medicines_in_care'
    ELSE 'mca_england'
  END,
  COALESCE(sp.created_at, NOW()),
  'backfilled_from_staff_flag',
  'Carried over from the medication competency tick on the staff record at upgrade. No assessor, date or scope was recorded against it. Re-assess and record a proper assessment for this person, and add a controlled-drugs scope if they give controlled drugs.'
FROM staff_profiles sp
JOIN users u ON u.id = sp.user_id
JOIN organizations o ON o.id = u.organization_id
WHERE sp.medication_competent = TRUE
  AND u.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM medication_competences c
    WHERE c.staff_id = sp.id AND c.scope = 'administration'
  );

-- ── 4. The witness, on the dose rather than on a printout ─────────────────
-- Nullable, and left null for every dose already recorded.
ALTER TABLE emedication_administrations
  ADD COLUMN IF NOT EXISTS witness_staff_id UUID REFERENCES staff_profiles(id),
  ADD COLUMN IF NOT EXISTS witnessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS competence_id UUID REFERENCES medication_competences(id),
  ADD COLUMN IF NOT EXISTS framework VARCHAR(40),
  ADD COLUMN IF NOT EXISTS administered_covertly BOOLEAN DEFAULT FALSE;

-- The two columns have to agree. A witnessed_at with no witness is a date
-- against nobody; a witness with no date is a signature that was never timed,
-- which for a controlled drug is the whole point of having one.
ALTER TABLE emedication_administrations
  DROP CONSTRAINT IF EXISTS emedication_administrations_witness_check;
ALTER TABLE emedication_administrations
  ADD CONSTRAINT emedication_administrations_witness_check
  CHECK ((witness_staff_id IS NULL AND witnessed_at IS NULL) OR (witness_staff_id IS NOT NULL AND witnessed_at IS NOT NULL));

-- A witness who is the person who gave the dose is not a witness. The
-- application checks this too, because the constraint is the thing that has to
-- hold even if the check is bypassed.
ALTER TABLE emedication_administrations
  DROP CONSTRAINT IF EXISTS emedication_administrations_witness_distinct_check;
ALTER TABLE emedication_administrations
  ADD CONSTRAINT emedication_administrations_witness_distinct_check
  CHECK (witness_staff_id IS NULL OR witness_staff_id <> staff_id);

ALTER TABLE emedication_administrations
  DROP CONSTRAINT IF EXISTS emedication_administrations_framework_check;
ALTER TABLE emedication_administrations
  ADD CONSTRAINT emedication_administrations_framework_check
  CHECK (framework IS NULL OR framework IN ('mca_england', 'awmch_wales', 'scotland_medicines_in_care'));

-- ── 5. What a PRN medicine is for ──────────────────────────────────────────
-- `is_prn` said a medicine was as-needed and nothing else. Nothing recorded
-- what it was needed for or how much could be given in a day, which are the
-- two things that make a PRN medicine safe to hand to a care worker.
ALTER TABLE emedication_items
  ADD COLUMN IF NOT EXISTS prn_indication TEXT,
  ADD COLUMN IF NOT EXISTS prn_max_dose_per_24h VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_covert BOOLEAN DEFAULT FALSE;

ALTER TABLE emedication_items
  DROP CONSTRAINT IF EXISTS emedication_items_prn_indication_check;
ALTER TABLE emedication_items
  ADD CONSTRAINT emedication_items_prn_indication_check
  -- Not "NOT NULL when is_prn" at the database level: the column is added to a
  -- table with existing PRN medicines, and a constraint that could not be
  -- satisfied by the data already there would either fail the migration or
  -- force a backfill that fabricates a clinical indication. So the rule is
  -- enforced when a medicine is created or changed, and the readiness report
  -- lists the existing ones that predate it.
  CHECK (is_prn = false OR prn_indication IS NOT NULL OR created_at < TIMESTAMP '2026-09-29');

-- ── 6. The structured medication review ────────────────────────────────────
-- Recorded rather than blocking, deliberately. Refusing to record a dose
-- because a review is overdue would push staff back onto the paper MAR, which
-- is worse for the provider than a visible overdue review.
CREATE TABLE IF NOT EXISTS medication_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  framework VARCHAR(40) NOT NULL CHECK (framework IN ('mca_england', 'awmch_wales', 'scotland_medicines_in_care')),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_due TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Who carried out the clinical review. Often not the same person as the
  -- reviewer, and often not staff at all — a GP or a care home pharmacist.
  conducted_by VARCHAR(200),
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_review_person ON medication_reviews (person_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_review_org ON medication_reviews (organization_id, next_review_due);

ALTER TABLE medication_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medication_reviews_manager ON medication_reviews;
CREATE POLICY medication_reviews_manager ON medication_reviews
  FOR ALL USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );
