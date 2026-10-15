-- The record a notification is about, when it is about one: a relative record path
-- (`micaRecordPath` in `@meticle/shared`) that the bell menu and the notifications
-- page navigate to.
--
-- A path rather than a URL, deliberately. The client pushes it with the router, so
-- the same row works on whatever origin the app is served from, and nothing has to
-- parse a host out of a stored string. Email is the one place that needs an absolute
-- address, and it composes that from the path at send time (`micaRecordUrl`), where
-- the public origin is actually known.
--
-- Nullable, and null is the common case: a notification about something with no page
-- (a billing event, a survey invitation) is not a record link, and a link that opens
-- the wrong place is worse than no link at all.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link VARCHAR(500);
