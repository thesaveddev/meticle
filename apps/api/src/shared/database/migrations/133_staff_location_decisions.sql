-- Per-worker location decision: told, and agreed or declined.
--
-- Migration 127 records that a worker was *shown* the location notice. That was
-- deliberately not consent capture: it says so in the table comment, in the
-- endpoint, and in the notice itself, because MeticleCare is a processor and
-- cannot manufacture a lawful basis for an employer's monitoring.
--
-- This is the other half, and it is kept separate for that reason. It does not
-- claim to give the employer a lawful basis — only the employer can do that. It
-- records what *this worker* decided, and the software honours the decision
-- either way. That is a protective control, not a permission slip: a worker who
-- declines is not a worker who has consented to something, and a processor that
-- enforced a refusal does not need a legal basis to stop collecting.
--
-- One row per worker, not one per notice version. The worker's current position
-- is what collection has to consult, and a refusal has to survive a notice being
-- revised: a worker who declined v1.0 has not agreed to v1.1 simply because the
-- text moved. Re-deciding overwrites in place, and audit_logs keeps the history
-- — the same pattern as the organisation-level switch, where the current state
-- and the trail of how it got there are deliberately different stores.
--
-- organization_id is here, unlike on staff_data_notices, because unlike a
-- notice acknowledgement this row has two audiences. A worker reads their own
-- answer; the provider reads their workforce's answers, because "who has agreed
-- and who has not" is the evidence question this record exists to answer, and a
-- count cannot answer it.
CREATE TABLE IF NOT EXISTS staff_location_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  decision VARCHAR(16) NOT NULL CHECK (decision IN ('agreed', 'declined')),
  -- Which version of the notice the decision was made against, so "agreed" can
  -- be read as "agreed to *this* text" rather than to location in general.
  notice_key TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  -- The app version that recorded it, for the same reason as staff_data_notices.
  app_version TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_location_decisions_decision
  ON staff_location_decisions (decision);

CREATE INDEX IF NOT EXISTS idx_staff_location_decisions_org
  ON staff_location_decisions (organization_id);

-- Read: your own answer, or your organisation's answers if you manage it.
--
-- Split from the write policy on purpose. Writing is per user and only ever per
-- user — that is the part that has to be airtight, because a decision an
-- employer can enter on a worker's behalf is not the worker's decision. Reading
-- is broader, because a provider has a legitimate need to see the state of the
-- answers it depends on, and the live map needs to read a worker's decision to
-- decide whether to plot their position at all.
--
-- The role check reads the session setting the application already sets, rather
-- than a subquery on users, so the policy cannot recurse into another table
-- that carries its own RLS.
ALTER TABLE staff_location_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_location_decisions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_location_decisions_own ON staff_location_decisions;
CREATE POLICY staff_location_decisions_own ON staff_location_decisions
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

DROP POLICY IF EXISTS staff_location_decisions_manager_read ON staff_location_decisions;
CREATE POLICY staff_location_decisions_manager_read ON staff_location_decisions
  FOR SELECT USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );

-- Why a visit has no coordinates.
--
-- location_capture_skipped (migration 126) is a boolean, which answers "is
-- there a fix on this visit?" but not "why not?". A manager looking at a call
-- with no GPS cannot tell a device problem from a worker who declined, and an
-- inspector asking the same question gets the same non-answer. Recording the
-- reason turns the absence into evidence.
--
-- 'organisation_disabled' — the provider switched location off.
-- 'worker_declined'      — this worker has declined. Honoured, and not
--                           something a manager can override from here.
-- 'not_agreed'           — this worker has not been asked yet, or has not
--                           answered. Collection is off until they do.
ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS location_capture_skip_reason TEXT
  CHECK (location_capture_skip_reason IS NULL
      OR location_capture_skip_reason IN ('organisation_disabled', 'worker_declined', 'not_agreed'));
