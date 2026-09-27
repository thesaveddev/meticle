-- Per-organisation kill switch for carer location.
--
-- DPIA v1.1 §6 claimed an organisation "can disable the live map feature
-- per-location" and the claim was retracted in v1.1 as a control that does not
-- exist. This is that control, built to be exercised by a customer without a
-- code change, a deploy, or MeticleCare's involvement.
--
-- Scope is deliberately the strong one. "Off" means the coordinates are not
-- collected and not returned, not merely that the map is hidden — a customer
-- who switches this off because their workforce does not want to be tracked
-- would not be satisfied by an empty map over data we still hold. The one
-- casualty is GPS visit verification, which cannot exist without a fix; that is
-- a trade the organisation makes knowingly, so the UI states it before saving.
--
-- Defaults to TRUE so no existing customer loses functionality on upgrade.
--
-- The disabled_at / disabled_by pair is not decoration. "When did this provider
-- stop collecting, and who authorised it" is the first question of any
-- workforce-monitoring audit, and inferring it from a settings page would be
-- guesswork once the setting is changed more than once.
--
-- location_capture_skipped on the visit is what keeps the record honest. A
-- completed visit with no coordinates is otherwise indistinguishable from a
-- carer who denied the permission prompt or whose GPS could not get a fix, and
-- those three mean very different things to a manager reading a care record.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS location_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS location_tracking_disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_tracking_disabled_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE homecare_visits
  ADD COLUMN IF NOT EXISTS location_capture_skipped BOOLEAN NOT NULL DEFAULT FALSE;
