-- Normalised room numbers — so the room-check sweep cannot miss a check or invent one.
--
-- The overdue sweep compares the room a resident sleeps in (`people.room_number`) with
-- the room a check was recorded against (`room_checks.room_number`). Both are free text
-- typed by two different people on two different screens, and the comparison was exact
-- text equality. "12 ", "Room 12", "room 12" and "012" are all the same room to the
-- person who typed them and were four different rooms to the query, which means:
--
--   * a check that *was* recorded does not clear the room, so the sweep declares a
--     room overdue that somebody already checked — the alert that teaches people to
--     ignore alerts;
--   * the same physical room, spelled two ways by two residents, is reported twice.
--
-- Neither failure is visible in the data. Nothing errors; the sweep is simply wrong
-- some of the time, which is why this is fixed in the database rather than by asking
-- people to type more carefully.
--
-- Two decisions:
--
--   * **A stored generated column, not a comparison expression.** Normalising in the
--     query would depend on every future caller remembering to do it, and the callers
--     here are a sweep in one file and a repository in another. A generated column
--     cannot be forgotten: whatever writes a room number, the normalised form is
--     maintained by the database, and the original is left exactly as typed for
--     display and for the residents' own records.
--   * **Deliberately conservative.** The normalisation folds case, surrounding and
--     internal whitespace, a leading "Room"/"Rm" label, and leading zeros — the ways
--     one room is written. It does *not* strip letters or suffixes, because folding
--     rooms that are genuinely different is how a check for room 12 would silently
--     clear room 12A, which is inventing a check. The folded form is used for matching
--     only: `room_number` still holds exactly what somebody typed, because it is the
--     label a resident and an inspector read.
--
-- `normalize_room_number` is IMMUTABLE (no clock, no settings, no table reads) and
-- STRICT (NULL in, NULL out), which is what lets it back the stored column.
CREATE OR REPLACE FUNCTION normalize_room_number(value TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(
           regexp_replace(
             regexp_replace(
               regexp_replace(btrim(value), '^(room|rm)[ .:#-]*', '', 'i'),
               '[[:space:]]+', '', 'g'),
             '^0+([0-9])', '\1'))
$$;

-- The resident's room, as typed, and the form the sweep compares on.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS room_number_normalized TEXT
  GENERATED ALWAYS AS (normalize_room_number(room_number)) STORED;

-- The room a check was recorded against, the same way round.
ALTER TABLE room_checks
  ADD COLUMN IF NOT EXISTS room_number_normalized TEXT
  GENERATED ALWAYS AS (normalize_room_number(room_number)) STORED;

-- The sweep's own reads: the rooms a provider has people in, and whether one of them
-- has a check today.
CREATE INDEX IF NOT EXISTS idx_people_room_normalized
  ON people (organization_id, location_id, room_number_normalized);

CREATE INDEX IF NOT EXISTS idx_room_checks_room_normalized
  ON room_checks (organization_id, room_number_normalized, check_date);
