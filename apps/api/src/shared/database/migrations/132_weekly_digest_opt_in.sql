-- Weekly manager summary: make it opt-in.
--
-- Migration 125 added homecare_digest_preferences.weekly_enabled BOOLEAN NOT NULL
-- DEFAULT TRUE, to match the three daily windows. That default is wrong for a
-- new report. Managers who never asked for it start receiving an
-- organisation-wide performance email every Monday morning: unsolicited contact
-- about their staff's work, from a system they signed up to for something else.
--
-- This cannot be fixed by editing 125. That migration has already run in
-- production, and a changed DEFAULT only affects rows inserted afterwards. Every
-- existing preference row keeps its TRUE, and so does the column default the
-- application falls back to for a user with no preference row at all — the
-- COALESCE in runHomecareDigestEmails. A new migration is the only thing that
-- reaches both.
--
-- The backfill is safe precisely because nobody can have opted in yet: the digest
-- preferences PATCH only ever wrote the three daily columns, so until this
-- migration there was no code path anywhere that set weekly_enabled. Every TRUE
-- in the table is an accidental default, not a recorded choice, and there is no
-- opt-in to preserve.
--
-- weekly_time is deliberately untouched at 07:30. A manager who switches the
-- report on gets the send time they would have had, and only then.
ALTER TABLE homecare_digest_preferences
  ALTER COLUMN weekly_enabled SET DEFAULT FALSE;

UPDATE homecare_digest_preferences
  SET weekly_enabled = FALSE
  WHERE weekly_enabled;
