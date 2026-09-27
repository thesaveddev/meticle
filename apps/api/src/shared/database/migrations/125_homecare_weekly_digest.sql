-- Weekly manager summary.
--
-- Two changes, both additive.
--
-- 1. A fourth digest window. The CHECK on digest_type enumerated the three
--    daily windows by name, so 'weekly' has to be added explicitly or the
--    delivery row cannot be written at all.
--
-- 2. A schedule for it. The weekly window is Monday-only, which is enforced in
--    code (isWeeklyDigestDue) rather than here — a CHECK cannot see a weekday.
--
-- The weekly delivery is keyed on the Monday that *starts* the week being
-- reported, so the existing UNIQUE (user_id, digest_date, digest_type) gives
-- per-week de-duplication for free and a retry cannot double-send.
--
-- weekly_enabled defaults TRUE to match the three daily windows, which all
-- default to on. Managers can turn it off in their digest preferences; if it
-- should be opt-in instead, that is a one-line default change here.
ALTER TABLE homecare_digest_preferences
  ADD COLUMN IF NOT EXISTS weekly_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weekly_time TIME NOT NULL DEFAULT '07:30';

ALTER TABLE homecare_digest_deliveries
  DROP CONSTRAINT IF EXISTS homecare_digest_deliveries_digest_type_check;

ALTER TABLE homecare_digest_deliveries
  ADD CONSTRAINT homecare_digest_deliveries_digest_type_check
  CHECK (digest_type IN ('morning', 'midday', 'evening', 'weekly'));
