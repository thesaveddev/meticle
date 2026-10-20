-- Shift attendance and shift handover for supported living.
--
-- A supported-living shift is the unit of duty: a support worker is on site for
-- it, and the handover at its end is the artefact the next worker and an
-- inspector read. Neither existed. A shift could be scheduled, claimed and
-- approved with no record that anybody turned up, which left overtime and the
-- 11-hour rest rule resting on manager inference (mobile blueprint §9.1/§9.2).
--
-- Two shapes, deliberately different:
--   * attendance is an append-only event log. A worker steps out and returns
--     mid-shift, and an offline phone replays its clock-on late, so the log has
--     to hold more than one interval and cannot depend on arrival order. The
--     shift's own actual_start_at/actual_end_at are the rolled-up summary the
--     rota, timesheet and reports read.
--   * a handover is one current record per shift, amended by keeping every
--     version: the wording a colleague read and acknowledged must survive the
--     amendment that followed it.
--
-- shift_offline_actions mirrors homecare_offline_actions down to the uniqueness
-- of (organization_id, action_key). That constraint is the whole idempotency
-- contract: a replayed offline clock-on is the same clock-on, not a second one.

-- ── Attendance evidence on the shift itself ────────────────────────────────
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS clocked_on_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS clocked_off_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── Append-only attendance events ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event VARCHAR(20) NOT NULL CHECK (event IN ('clock_on', 'clock_off')),
  -- 'offline' means the action was queued on a device and replayed later, so the
  -- recorded_at is the device's clock and created_at is the server's receipt.
  -- The two are kept apart so an inspection can reconcile them (§11).
  source VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'offline')),
  recorded_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  accuracy_meters INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shift_attendance_shift ON shift_attendance_events(shift_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_shift_attendance_org_user ON shift_attendance_events(organization_id, user_id, recorded_at DESC);

-- ── The handover, its history and who acknowledged it ──────────────────────
CREATE TABLE IF NOT EXISTS shift_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  what_happened TEXT NOT NULL,
  outstanding TEXT,
  who_is_aware TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shift_id)
);

CREATE TABLE IF NOT EXISTS shift_handover_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  handover_id UUID NOT NULL REFERENCES shift_handovers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  what_happened TEXT NOT NULL,
  outstanding TEXT,
  who_is_aware TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'offline')),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (handover_id, version)
);
CREATE INDEX IF NOT EXISTS idx_shift_handover_revisions ON shift_handover_revisions(handover_id, version DESC);

CREATE TABLE IF NOT EXISTS shift_handover_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  handover_id UUID NOT NULL REFERENCES shift_handovers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  note TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- One acknowledgement per person: a second is the same acknowledgement, which
  -- is what makes a retry from a bad connection safe.
  UNIQUE (handover_id, user_id)
);

-- ── Offline action ledger (same contract as homecare_offline_actions) ──────
CREATE TABLE IF NOT EXISTS shift_offline_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_key VARCHAR(120) NOT NULL,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('clock-on', 'clock-off', 'handover')),
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'processed' CHECK (status IN ('processing', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  UNIQUE (organization_id, action_key)
);
CREATE INDEX IF NOT EXISTS idx_shift_offline_actions_shift ON shift_offline_actions(shift_id, created_at DESC);

-- ── Tenant isolation, same shape as the homecare operation tables ──────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'shift_attendance_events', 'shift_handovers', 'shift_handover_revisions',
    'shift_handover_acknowledgements', 'shift_offline_actions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (org_check(organization_id))', tbl);
  END LOOP;
END $$;
