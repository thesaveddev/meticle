-- Evidence that each worker was shown the staff location notice.
--
-- The DPIA has always treated "carers are told what is collected" as a control.
-- It is only a control if there is a record that it happened, and on a shared
-- device or a new starter there is otherwise no way to show an inspector that
-- anyone was ever told anything.
--
-- The record is deliberately per (user, notice_version) rather than a single
-- "seen it" flag. Two reasons: a worker who joined last year has not seen a
-- notice written this year, and a notice that has been revised needs to be
-- re-acknowledged without pretending the old acceptance is still current.
--
-- This is not consent capture, and nothing here is called `consented`. A worker
-- tapping "I have read this" is acknowledging that they were informed.
-- MeticleCare is a processor and cannot give a worker a lawful basis for their
-- employer's monitoring; only the employer can do that, and the notice says so
-- rather than manufacturing an agreement the app has no standing to create.
--
-- No organization_id: a worker's employer relationship is not what this records.
-- RLS is per user rather than per tenant, because the row describes a notice
-- shown to one person on their own device, not an organisational record.
CREATE TABLE IF NOT EXISTS staff_data_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_key TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  notice_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The app version that showed it. If a notice is ever rendered differently in
  -- a build, this is how we tell which text a given worker actually read.
  app_version TEXT,
  UNIQUE (user_id, notice_key, notice_version)
);

CREATE INDEX IF NOT EXISTS idx_staff_data_notices_user
  ON staff_data_notices (user_id, notice_key);

ALTER TABLE staff_data_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_data_notices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_data_notices_own ON staff_data_notices;
CREATE POLICY staff_data_notices_own ON staff_data_notices
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);
