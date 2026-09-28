-- Nation-specific staff vetting.
--
-- The weakness this closes: the scoring layer has carried all four UK
-- regulators (CQC, CIW, Care Inspectorate, RQIA) since the framework-aware
-- readiness work, but the operational data layer behind it did not. Every
-- provider, in every nation, was measured against one hardcoded document list
-- of DBS / PASSPORT / VISA / RIGHT_TO_WORK.
--
-- Concretely, that meant a Scottish provider was told its staff were
-- non-compliant for not holding a DBS — a document that is not recognised in
-- Scotland — while a real PVG certificate sitting in the same table counted
-- for nothing. Northern Ireland had the same problem with AccessNI. Wales
-- happened to be fine by accident, because Wales does use DBS.
--
-- So the two layers disagreed, and the scoring layer was the one making the
-- claim. A framework-aware score computed over England-and-Wales-only evidence
-- is not a four-nations score.
--
-- vetting_schemes is a reference table, not tenant data: four rows that never
-- change, holding no personal data, so it carries no RLS policy and is readable
-- by the app role. It is seeded from the same registry the API validates
-- against (apps/api/src/modules/compliance/compliance.vetting.ts), and a test
-- asserts the two agree — a tier name drifting between the code and the table
-- would make a real check look missing, which is the exact failure being
-- removed here.
--
-- check_document_types and required_document_types are separate columns rather
-- than one list for a reason found while building this: a flat list would ask
-- a correctly-vetted Scottish carer for a PVG certificate AND a Disclosure
-- Scotland record, and report them non-compliant for a document they do not
-- need. Holding at least one of the check types is what satisfies the check;
-- every required type must be held.
--
-- organizations.vetting_scheme is the organisation's regulatory jurisdiction and
-- is NOT NULL, because "which regulator inspects you" is not an unknown for a
-- live provider. It defaults to England, which is correct for every existing
-- customer and for the overwhelming majority of the market.
--
-- staff_profiles.vetting_scheme is nullable and overrides the organisation.
-- This is not gold-plating: providers registered in England do send carers to
-- work in Scotland, and a national operator inspecting across all four nations
-- cannot be described by one column. NULL means "same as the organisation",
-- which is what almost every record should hold.
--
-- The ON DELETE RESTRICT is deliberate. Deleting a scheme row that an
-- organisation or a person is pointing at should fail loudly rather than leave
-- a staff record whose required documents can no longer be determined.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS vetting_scheme TEXT NOT NULL DEFAULT 'dbs_england_wales';

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS vetting_scheme TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vetting_schemes'
  ) THEN
    CREATE TABLE vetting_schemes (
      id TEXT PRIMARY KEY,
      nation TEXT NOT NULL CHECK (nation IN ('england', 'wales', 'scotland', 'northern_ireland')),
      regulator TEXT NOT NULL CHECK (regulator IN ('cqc', 'ciw', 'care-inspectorate', 'rqia')),
      check_name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      -- Weakest first. A role requirement names one of these.
      tiers TEXT[] NOT NULL,
      -- Documents that satisfy the background check. At least one is required;
      -- holding all of them is not. Scotland has two routes into the same
      -- scheme, which is why this is an array and not a single type.
      check_document_types TEXT[] NOT NULL,
      -- Documents required outright, every one of them.
      required_document_types TEXT[] NOT NULL,
      note TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- PASSPORT / VISA / RIGHT_TO_WORK are in required_document_types for every
    -- row on purpose: right to work is a UK-wide immigration requirement with
    -- nothing to do with which nation's background-checking scheme applies, and
    -- dropping it for Scotland would invent a compliance gap that does not exist.
    INSERT INTO vetting_schemes
      (id, nation, regulator, check_name, issuer, tiers, check_document_types, required_document_types, note, is_default)
    VALUES
      (
        'dbs_england_wales', 'england', 'cqc', 'DBS',
        'Disclosure and Barring Service',
        ARRAY['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
        ARRAY['DBS'],
        ARRAY['PASSPORT', 'VISA', 'RIGHT_TO_WORK'],
        'The Disclosure and Barring Service covers England and Wales only.',
        TRUE
      ),
      (
        'ciw_wales', 'wales', 'ciw', 'DBS',
        'Disclosure and Barring Service',
        ARRAY['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
        ARRAY['DBS'],
        ARRAY['PASSPORT', 'VISA', 'RIGHT_TO_WORK'],
        'Wales uses the same DBS scheme as England, under CIW inspection.',
        FALSE
      ),
      (
        'pvg_scotland', 'scotland', 'care-inspectorate', 'PVG',
        'Protecting Vulnerable Groups (Disclosure Scotland)',
        ARRAY['basic', 'standard', 'advanced', 'advanced_with_barring'],
        ARRAY['PVG', 'DISCLOSURE_SCOTLAND'],
        ARRAY['PASSPORT', 'VISA', 'RIGHT_TO_WORK'],
        'Scotland uses the PVG scheme rather than DBS. A DBS is not accepted here.',
        FALSE
      ),
      (
        'accessni_northern_ireland', 'northern_ireland', 'rqia', 'AccessNI',
        'AccessNI',
        ARRAY['basic', 'standard', 'enhanced', 'enhanced_with_barred'],
        ARRAY['ACCESSNI'],
        ARRAY['PASSPORT', 'VISA', 'RIGHT_TO_WORK'],
        'Northern Ireland uses AccessNI, operated on behalf of the Department of Health.',
        FALSE
      );
  END IF;
END $$;

-- The foreign keys are added after the seed so the ALTER can be re-run against
-- a database where the column exists but the constraint does not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_vetting_scheme_fkey'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_vetting_scheme_fkey
      FOREIGN KEY (vetting_scheme) REFERENCES vetting_schemes(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_profiles_vetting_scheme_fkey'
  ) THEN
    ALTER TABLE staff_profiles
      ADD CONSTRAINT staff_profiles_vetting_scheme_fkey
      FOREIGN KEY (vetting_scheme) REFERENCES vetting_schemes(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_vetting_scheme
  ON staff_profiles(vetting_scheme)
  WHERE vetting_scheme IS NOT NULL;
