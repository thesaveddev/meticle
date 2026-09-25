-- Supervision records.
--
-- The CQC domiciliary compliance score has always reported a "supervisions"
-- rate, but it was computed from audit_logs rows with action = 'supervision'.
-- Nothing in the application ever wrote that action, so the rate was always
-- zero and the compliance page had to display "not tracked". This table is the
-- real record of a supervision, and the score now reads from it.
CREATE TABLE IF NOT EXISTS staff_supervisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- The member of staff who was supervised. A user rather than a person
  -- record: supervisions apply to the whole workforce, including staff who
  -- never hold a client allocation.
  staff_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supervisor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  supervised_at DATE NOT NULL DEFAULT CURRENT_DATE,
  supervision_type VARCHAR(20) NOT NULL DEFAULT 'individual'
    CHECK (supervision_type IN ('individual', 'group', 'remote', 'appraisal')),

  agenda TEXT,
  notes TEXT,
  actions TEXT,
  next_due_date DATE,

  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The compliance score counts distinct staff supervised in the last six
-- months, so this covers that lookup directly.
CREATE INDEX IF NOT EXISTS idx_staff_supervisions_org_recent
  ON staff_supervisions(organization_id, supervised_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_supervisions_staff
  ON staff_supervisions(staff_user_id, supervised_at DESC);
