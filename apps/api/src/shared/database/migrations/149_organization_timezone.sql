-- The provider's day, held per organisation instead of per deployment.
--
-- `CURRENT_DATE`, `NOW()::date` and `date_trunc('day', …)` resolve in the
-- session's `TimeZone` and nothing set it, so roughly forty queries that name a
-- day resolved it in UTC — the previous day for the first hour of every BST day,
-- which is the hour a night shift does its round and hands over. The first fix
-- set that timezone at the pool for the whole process, which makes the day
-- correct for every provider this product supports today (England, Wales,
-- Scotland, Northern Ireland, Ireland all share the offset and the DST rules)
-- and leaves a provider operating outside them dependent on a deploy-time
-- environment variable. A tenant's own clock is a per-tenant fact, so it belongs
-- on the tenant.
--
-- The value is a session GUC set on every connection a request checks out, from
-- `app_org_time_zone` below, which is what makes the ~forty query sites correct
-- without editing any of them.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/London';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND conname = 'organizations_timezone_format_check'
  ) THEN
    -- Shape only: every IANA zone name is letters, digits, `_`, `-`, `+` or `/`.
    -- Existence is checked where it can be checked properly — at write time
    -- against `pg_timezone_names` (the API), and at read time inside
    -- `app_org_time_zone`.
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_timezone_format_check
      CHECK (timezone ~ '^[A-Za-z0-9_+/-]{1,64}$');
  END IF;
END $$;

-- Resolve an organisation's timezone to a value this server can actually apply.
--
-- Returns NULL rather than raising for anything it cannot use, and that is the
-- whole point of it existing: `set_config('TimeZone', …)` with a name Postgres
-- does not recognise raises, and the statement it would raise in is the one that
-- sets the request's RLS context — so a bad timezone would not be a wrong day,
-- it would be a tenant unable to make any authenticated request at all. The
-- name is proven resolvable *here*, where the error can be caught, and an
-- unusable value falls back to the caller's default (the deploy-time one).
--
-- Validation is against this database's own tz database rather than a list in
-- the application, so the value that gets applied is one this server has.
CREATE OR REPLACE FUNCTION app_org_time_zone(org_id UUID) RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  SELECT timezone INTO candidate FROM organizations WHERE id = org_id;
  IF candidate IS NULL OR candidate !~ '^[A-Za-z0-9_+/-]{1,64}$' THEN
    RETURN NULL;
  END IF;
  -- Raises for a name this server cannot resolve, which is caught below.
  PERFORM NOW() AT TIME ZONE candidate;
  RETURN candidate;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON COLUMN organizations.timezone IS
  'IANA zone the session timezone is set from per request (migration 149), so CURRENT_DATE names the provider''s day. Validated against pg_timezone_names at write time; app_org_time_zone() falls back to the deploy default for anything unusable.';
