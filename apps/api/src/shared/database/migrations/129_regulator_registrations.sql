-- Which body regulates a service, and our registration number with them.
--
-- The gap: there was nowhere to record a provider's registration at all, for
-- any regulator. The field people assumed existed — "DBS" — is the
-- England-and-Wales background check, not a registration. So this is not a Wales
-- problem; it is a missing capability that a Wales-shaped gap statement would
-- have described badly.
--
-- regulators is a reference table, not tenant data: four rows that never change,
-- holding no personal data, so it carries no RLS policy and is readable by the
-- app role. Seeded from the same registry the API validates against
-- (apps/api/src/modules/compliance/regulators.ts), and a test asserts the two
-- agree, the same way migration 128 is guarded.
--
-- This table holds the four SERVICE regulators only. Social Care Wales and the
-- Northern Ireland Social Care Council register individuals rather than
-- services, and they are deliberately absent rather than present-and-flagged:
-- keeping them out means the foreign key below makes it structurally impossible
-- to record a service registration against a workforce body, which is the mistake
-- Wales most invites. They are documented in the TypeScript registry so the
-- distinction is still explainable on screen, and a test asserts none of them
-- reach this table. Which roles require registration is T2-18.
--
-- regulator_registrations is one row per regulator per organisation, not a
-- column, because a national operator is genuinely registered with more than
-- one: an English provider that also runs a service in Wales holds a CQC number
-- and a CIW number at once, and a single column would lose one of them on save.
-- The unique pair means re-submitting the same regulator's number updates rather
-- than duplicating.
--
-- verified_at is nullable and distinct from created_at on purpose. "We hold a
-- number" and "we checked that number against the regulator's register this
-- month" are different claims, and an inspection asks the second one. MeticleCare
-- does not verify registrations automatically; the column exists so a manager can
-- record having done it, and so an empty value is visibly empty rather than
-- quietly implied.
--
-- ON DELETE CASCADE from organizations: registrations belong to the organisation
-- and mean nothing without it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regulators'
  ) THEN
    CREATE TABLE regulators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      -- The nations whose services this regulator inspects.
      nations TEXT[] NOT NULL,
      -- Always 'service'. Present rather than inferred so the table can carry a
      -- workforce body later without a migration, but the value is constrained.
      role TEXT NOT NULL DEFAULT 'service' CHECK (role = 'service'),
      description TEXT NOT NULL,
      registration_label TEXT NOT NULL,
      register_url TEXT NOT NULL,
      -- A published example of the numbering, where one is verified. NULL means
      -- "not verified", and is never used to reject a value.
      format_hint TEXT,
      -- The vetting_scheme whose regulator this is, tying the two registries
      -- together so a nation's check and its regulator cannot drift apart.
      vetting_scheme TEXT NOT NULL REFERENCES vetting_schemes(id) ON DELETE RESTRICT,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- CIW's format is verified from gov.wales (22 December 2022). CQC and RQIA
    -- publish registers whose numbering we have not confirmed, so their
    -- format_hint is NULL rather than a guess: a wrong pattern would reject a
    -- real registration number, which is worse than offering no hint.
    INSERT INTO regulators
      (id, name, nations, role, description, registration_label, register_url, format_hint, vetting_scheme, note)
    VALUES
      (
        'cqc', 'Care Quality Commission', ARRAY['england'], 'service',
        'Registers and inspects health and adult social care services in England.',
        'CQC registration number', 'https://www.cqc.org.uk/',
        NULL, 'dbs_england_wales',
        'The regulator for England. Providers are registered with the CQC, not with Social Care England, which has no registration role.'
      ),
      (
        'ciw', 'Care Inspectorate Wales', ARRAY['wales'], 'service',
        'Registers and inspects social care and childcare services in Wales.',
        'CIW registration number', 'https://www.careinspectorate.wales/register-provide-service',
        'Newer numbers are 11 characters and begin CYM, e.g. CYM00002456. Older numbers begin W and are 10 or 12 characters, and may contain a forward slash which must be kept.',
        'ciw_wales',
        'CIW registers services in Wales under the Regulation and Inspection of Social Care (Wales) Act 2016. This is not the same as a Social Care Wales number: Social Care Wales registers individuals in the workforce, not services.'
      ),
      (
        'care-inspectorate', 'Care Inspectorate', ARRAY['scotland'], 'service',
        'Registers and inspects care homes and other social care services in Scotland.',
        'Care Inspectorate registration number', 'https://www.careinspectorate.com/',
        NULL, 'pvg_scotland',
        'Scottish background checks are PVG records, run by Disclosure Scotland, not DBS. See the vetting registry.'
      ),
      (
        'rqia', 'Regulation and Quality Improvement Authority', ARRAY['northern_ireland'], 'service',
        'Registers and inspects health and social care services in Northern Ireland.',
        'RQIA registration number', 'https://www.rqia.org.uk/register/',
        NULL, 'accessni_northern_ireland',
        'Established under the Health and Personal Care Services (Quality Improvement and Regulation) (Northern Ireland) Order 2003. Northern Irish background checks are AccessNI, not DBS.'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regulator_registrations'
  ) THEN
    CREATE TABLE regulator_registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      -- A foreign key to a table that holds only service regulators, so a
      -- workforce body cannot be recorded here even by a bad insert.
      regulator_id TEXT NOT NULL REFERENCES regulators(id) ON DELETE RESTRICT,
      registration_number TEXT NOT NULL,
      -- When a manager last checked the number against the regulator's public
      -- register. NULL is honest: we do not verify registrations for you.
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- One row per regulator. Re-submitting a number updates it rather than
      -- accumulating duplicates for the same regulator.
      UNIQUE (organization_id, regulator_id),
      -- Guard against an empty or whitespace-only "registration number" that
      -- reads as compliance on a dashboard.
      CHECK (length(btrim(registration_number)) > 0)
    );

    CREATE INDEX idx_regulator_registrations_org
      ON regulator_registrations(organization_id);
  END IF;
END $$;
