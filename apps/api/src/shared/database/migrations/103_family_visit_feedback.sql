-- Family visit feedback: allows family members to rate and comment on completed visits
-- Token-based access, triggered after each completed call

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

  -- Feedback fields
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

CREATE INDEX IF NOT EXISTS idx_family_feedback_org ON family_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_family_feedback_visit ON family_feedback(visit_id);
CREATE INDEX IF NOT EXISTS idx_family_feedback_person ON family_feedback(person_id);
CREATE INDEX IF NOT EXISTS idx_family_feedback_token ON family_feedback(access_token) WHERE submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_family_feedback_submitted ON family_feedback(organization_id, submitted_at DESC) WHERE submitted_at IS NOT NULL;
