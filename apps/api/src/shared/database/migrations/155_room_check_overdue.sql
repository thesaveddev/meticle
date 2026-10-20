-- Room check overdue — the last event type in the supported-living blueprint §9.9.
--
-- A room check is a daily safety and cleanliness record for an occupied room. The
-- module could record one but could not notice one that never happened: there is no
-- schedule row to be "due", only checks that exist. The missing thing is a
-- comparison between the rooms a provider actually has people in and the checks
-- recorded for today, and then a way to say it once.
--
-- A nudge table rather than a marker column, because the state being nudged about
-- is not a row: it is the *absence* of a room check for a (location, room, day).
-- There is nothing to stamp, so the sweep records what it has said instead. The
-- primary key is the whole one-shot contract: a second run on the same day inserts
-- nothing, so a fifteen- or thirty-minute tick cannot become a stream of alerts
-- about the same empty room.
--
-- `check_date` is the provider's own day — the sweep runs with the tenant's session
-- timezone (migration 149), so `CURRENT_DATE` here means "today" where the room is,
-- not "today" in UTC.
CREATE TABLE IF NOT EXISTS room_check_nudges (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  check_date DATE NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, location_id, room_number, check_date)
);

-- The sweep's own read: which rooms it has already spoken about today.
CREATE INDEX IF NOT EXISTS idx_room_check_nudges_org_date
  ON room_check_nudges (organization_id, check_date);

-- Tenant isolation, the same shape as the supported-living tables in migration 152.
-- The sweep runs with the synthetic SYSTEM_ACTOR (ORG_ADMIN) inside a tenant context,
-- so the org comparison is what keeps one provider out of another's nudges.
ALTER TABLE room_check_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_check_nudges FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON room_check_nudges;
CREATE POLICY tenant_isolation ON room_check_nudges
  FOR ALL USING (org_check(organization_id));
