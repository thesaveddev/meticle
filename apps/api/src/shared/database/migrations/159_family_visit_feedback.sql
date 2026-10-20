-- Family visit feedback — the table 103 declared and no database ever got.
--
-- 103_family_visit_feedback.sql is on disk and absent from setup.ts's registered
-- list, so it has never run anywhere. The runner refuses an unapplied migration
-- whose version sits below the highest applied one (it would be a backfill on live
-- data), which means the fix is not "register 103" — that would stop the API from
-- starting. It is the same repair 151 made for 102's column: restate it at a
-- version that can still run, and leave 103 on disk as the historical record.
--
-- Until now the consequence was invisible: `/family-feedback` (manager list) and
-- the public `/api/family-feedback/:token` were mounted and every call was a 500 on
-- a missing relation. The family's visit rating, captured in code and emailed to
-- managers, could not be stored.
--
-- The shape is 103's, unchanged, so the repository and controller need no edit.
-- Tenant isolation is added, which 103 did not have: the table holds one provider's
-- families' opinions about their own residents.
CREATE TABLE IF NOT EXISTS family_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES homecare_visits(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  family_member_name VARCHAR(255) NOT NULL,
  family_member_email VARCHAR(255),
  relationship VARCHAR(100),
  access_token VARCHAR(255) NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- The ratings a family member gives, all optional except overall.
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  care_quality_rating INTEGER CHECK (care_quality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  would_recommend BOOLEAN,
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The manager's list is per organisation, newest first.
CREATE INDEX IF NOT EXISTS idx_family_feedback_org ON family_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_family_feedback_visit ON family_feedback(visit_id);
CREATE INDEX IF NOT EXISTS idx_family_feedback_person ON family_feedback(person_id);
-- The token lookup: only an unsubmitted token inside its window resolves.
CREATE INDEX IF NOT EXISTS idx_family_feedback_token ON family_feedback(access_token) WHERE submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_family_feedback_submitted ON family_feedback(organization_id, submitted_at DESC) WHERE submitted_at IS NOT NULL;

ALTER TABLE family_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_feedback FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON family_feedback;
CREATE POLICY tenant_isolation ON family_feedback
  FOR ALL USING (org_check(organization_id));
