-- Retention for carer location, and evidence that it was applied.
--
-- The DPIA has said since version 1.0 that no retention period for carer
-- location had been decided, escalated it to the DPO, and told carers "ask
-- your employer". All three of those remain true of the *legal* position. What
-- was missing was the mechanism: a provider whose DPO sets a period had
-- nowhere to record it and nothing that would ever act on it, so the data
-- simply accumulated on the visit row for as long as the care record lived.
--
-- This migration supplies the mechanism and deliberately not the answer.
--
-- location_retention_days is NULL by default, and that is a decision rather
-- than a forgotten default. A shipped number becomes the policy of every
-- provider who never opens the setting, and picking one here would quietly
-- overturn a documented escalation to a DPO on their behalf — the same error
-- as version 1.0 of the DPIA asserting an unevidenced "recommended 8 years".
-- NULL means "this provider has not set a period", nothing is deleted
-- automatically, and the settings screen says so loudly rather than letting
-- the absence pass as a policy.
--
-- A provider sets their own period with PUT /homecare/settings/location-retention
-- (ORG_ADMIN), and the nightly job enforces it. The controller is the care
-- organisation, not MeticleCare: we are the processor that deletes on their
-- instruction and keeps the receipt.
--
-- The deletion itself has to reach three stores, because location is written
-- in three places and clearing only the obvious one is a purge that appears to
-- have worked:
--
--   1. homecare_visits.check_in_* / check_out_*  — the intended record
--   2. audit_logs.new_data                      — check_in/check_out rows carry
--      the coordinates in JSONB, so the visit columns are not the only copy
--   3. mobile_check_ins                         — a separate SecureVisit
--      check-in endpoint that stores its own position
--
-- Visit 2 was found by reading what the audit call actually passed, not what
-- the DPIA claimed it passed. It had a consequence beyond duplication: because
-- the audit row was built from the raw request body, an older app build that
-- still sends coordinates after a provider has switched collection off had
-- those coordinates written into the audit log — a copy the kill switch did
-- not reach and nothing ever deleted. The audit call now records the resolved
-- location, so a refused collection writes no position anywhere.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS location_retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS location_retention_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_retention_configured_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Ten years is the ceiling, not a recommendation — it exists so a typo cannot
-- set a period that silently outlives the provider. Deliberately no lower
-- bound: a provider may legitimately want a period shorter than a month, and
-- that is their judgement to make, not ours to second-guess.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_location_retention_days_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_location_retention_days_check
  CHECK (location_retention_days IS NULL OR (location_retention_days > 0 AND location_retention_days <= 3650));

-- Marks a visit whose position was removed on purpose.
--
-- Without it a purged visit is indistinguishable from one where the device
-- failed to get a fix, and a manager reading "No GPS" on a visit from eight
-- months ago would reasonably assume something went wrong that day. It is the
-- difference between a deletion and a malfunction, and that difference is the
-- whole reason to record it.
ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS location_purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_purged_run_id UUID;

CREATE INDEX IF NOT EXISTS idx_homecare_visits_location_purge
  ON homecare_visits (organization_id, location_purged_at)
  WHERE location_purged_at IS NULL;

-- The third store, and the one that had the least excuse.
--
-- SecureVisit check-ins wrote a position on every call with no reference to
-- location_tracking_enabled or to the worker's own decision, so a provider who
-- had switched collection off entirely still got a position recorded the
-- moment anyone used that page. latitude/longitude were NOT NULL, which meant
-- the only ways to honour a refusal there were to drop the attendance record
-- or to record the position anyway. Both are worse than the third option:
-- store the check-in, leave the position empty, and say why.
--
-- The same reasoning as the visit row, for the same reason. A worker who has
-- declined does not lose the ability to check in; they lose only the
-- verification, which was never a security control to begin with.
ALTER TABLE mobile_check_ins
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

ALTER TABLE mobile_check_ins
  ADD COLUMN IF NOT EXISTS location_capture_skip_reason TEXT
  CHECK (location_capture_skip_reason IS NULL
         OR location_capture_skip_reason IN ('organisation_disabled', 'worker_declined', 'not_agreed'));

-- The receipt.
--
-- A provider who has to evidence their retention policy needs more than the
-- policy: they need to show it was *enforced*, on a date, without a human
-- standing there. One row per run, including runs that deleted nothing —
-- a run that found zero is itself the evidence that the rule is holding, and
-- silently skipping those would make "we deleted 4,096 positions" impossible
-- to reconcile against "how many were there".
CREATE TABLE IF NOT EXISTS carer_location_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- 'scheduled'  — the nightly job, triggered_by is null
  -- 'manual'     — a manager pressed the button
  -- 'switch_off' — the provider turned collection off and chose to purge
  -- 'policy_set' — a one-off triggered by changing the policy, so a provider
  --   shortening their period is not left waiting for the next nightly run
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual', 'switch_off', 'policy_set')),
  -- Null when the run was a one-off purge with no standing policy behind it.
  retention_days INTEGER,
  -- Positions captured before this instant were eligible for removal. Kept so
  -- the run can be explained afterwards without re-deriving the arithmetic.
  cutoff TIMESTAMPTZ NOT NULL,
  visit_rows_updated INT NOT NULL DEFAULT 0,
  positions_removed INT NOT NULL DEFAULT 0,
  audit_rows_cleaned INT NOT NULL DEFAULT 0,
  mobile_check_ins_deleted INT NOT NULL DEFAULT 0,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carer_location_deletions_org
  ON carer_location_deletions (organization_id, started_at DESC);

-- Org-scoped evidence, manager-readable and manager-only.
--
-- Read-only to the application: the nightly job writes these through
-- migrateQuery, and there is no endpoint by which a client can write one. A
-- deletion receipt that a manager could edit would not be a receipt.
ALTER TABLE carer_location_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carer_location_deletions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carer_location_deletions_manager_read ON carer_location_deletions;
CREATE POLICY carer_location_deletions_manager_read ON carer_location_deletions
  FOR SELECT USING (
    NULLIF(current_setting('app.current_user_role', true), '') IN ('ORG_ADMIN', 'MANAGER')
    AND organization_id = NULLIF(current_setting('app.current_org_id', true), '')::UUID
  );
