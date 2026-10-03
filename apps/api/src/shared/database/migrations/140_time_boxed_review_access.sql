-- 140: a time-boxed, opt-in override of the subscription gate.
--
-- ## The problem
--
-- Google Play review requires that a reviewer can actually use the app. The
-- seeded reviewer organisation is a synthetic tenant whose trial ended, so
-- every non-exempt route answers 403 BILLING_RESTRICTED and the reviewer lands
-- on a billing wall instead of the product.
--
-- ## Why not just extend the trial or set the status to 'active'
--
-- Both would be wrong, and in different ways:
--
--   * Setting `subscription_status = 'active'` fabricates a subscription the
--     tenant never bought. Stripe sync would then see an org whose state
--     disagrees with its Stripe customer, and the next webhook would overwrite
--     it — so the grant would evaporate at the worst moment, or worse, be
--     mistaken for a real paying customer by revenue reporting.
--   * Pushing `trial_ends_at` forward is indistinguishable from a genuine
--     trial extension and leaves no record that it was a review grant.
--
-- ## Why a separate column
--
-- The override is data, not a special case in the gate. `auth.middleware.ts`
-- reads this column and skips the gate only when it is set *and* in the
-- future. Every organisation where it is NULL behaves exactly as before, which
-- is the default for every row in the table and needs no backfill.
--
-- Two properties follow from that, and they are the point of the design:
--
--   * No billing code path can grant it. Every `UPDATE organizations` in the
--     repository names its columns explicitly — none of them lists this one —
--     so Stripe sync, the billing controller and the dunning scheduler cannot
--     set or clear it even by accident.
--   * It cannot match a real tenant. It is opt-in per organisation, set by a
--     script a human runs deliberately. Matching on an organisation *name*
--     instead would be the dangerous design here, since a paying customer can
--     be called anything at all.
--
-- ## The box
--
-- There is no way to grant this in perpetuity. `seed-play-reviewer.ts` refuses
-- to write an expiry further out than REVIEW_ACCESS_MAX_DAYS, so the grant has
-- to be re-armed deliberately. When the timestamp passes, the gate applies
-- again with no cleanup step and no code change: the check is a comparison
-- against NOW() on every request, not a one-off flag.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS review_access_expires_at TIMESTAMP WITH TIME ZONE;

-- Recorded alongside the grant so a row with access but no explanation is
-- visibly an accident rather than an undocumented decision.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS review_access_reason TEXT;

COMMENT ON COLUMN organizations.review_access_expires_at IS
  'When NULL (the default) the subscription gate applies normally. When set and in the future, the gate is skipped for this organisation. Time-boxed; see migration 140.';
COMMENT ON COLUMN organizations.review_access_reason IS
  'Why review_access_expires_at was set, e.g. Google Play reviewer access.';

-- The gate runs on every authenticated request, so this column is read on the
-- hot path for every tenant, including the overwhelming majority that are NULL.
CREATE INDEX IF NOT EXISTS idx_organizations_review_access
  ON organizations (review_access_expires_at)
  WHERE review_access_expires_at IS NOT NULL;

-- Defence in depth: the application's runtime role must not be able to grant
-- itself this access.
--
-- ## Why a trigger and not REVOKE
--
-- The obvious tool is `REVOKE UPDATE (review_access_expires_at) ... FROM
-- meticle_app`. It does not work here. Migration 004 grants UPDATE at the
-- *table* level (`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
-- public TO meticle_app`), and PostgreSQL privileges are additive: a column-level
-- REVOKE removes only the column-level ACL entry, while the table-level entry
-- still grants UPDATE over every column including the new ones. This was
-- measured rather than assumed — an UPDATE of these columns as `meticle_app`
-- succeeded after the REVOKE was applied.
--
-- The alternatives all have worse failure modes. Revoking table-level UPDATE
-- and re-granting per column would silently drop every column added to
-- `organizations` later, because a new column inherits the table grant and not
-- the hand-maintained column list. So the guard is a BEFORE UPDATE trigger,
-- which is evaluated per row against actual value changes and stays correct no
-- matter how the table is granted.
--
-- Only the two protected columns are guarded. Every other UPDATE — Stripe sync
-- moving subscription_status, the billing controller recording dunning state,
-- onboarding writing settings — still works for the application role.
--
-- SELECT is deliberately left alone. The gate reads review_access_expires_at on
-- every authenticated request, so removing read access would break the
-- middleware for every tenant, including the ones that must stay gated.
CREATE OR REPLACE FUNCTION guard_organizations_review_access() RETURNS trigger AS $guard$
DECLARE
  table_owner TEXT;
BEGIN
  -- Membership alone is the wrong test. In PostgreSQL a superuser is an
  -- implicit member of every role, so `pg_has_role(current_user, 'meticle_app',
  -- 'MEMBER')` is also true for the superuser behind DATABASE_MIGRATE_URL —
  -- which blocked the seed script on the first attempt at this trigger.
  --
  -- The rule that matches the actual topology: refuse only a role that inherits
  -- `meticle_app` and is neither a superuser nor the table's owner. That is the
  -- application role and nothing else. The migration role owns `organizations`,
  -- so it passes and can still arm the grant.
  SELECT pg_get_userbyid(c.relowner) INTO table_owner
    FROM pg_class c
   WHERE c.relname = 'organizations'
     AND c.relnamespace = 'public'::regnamespace;

  IF (NEW.review_access_expires_at IS DISTINCT FROM OLD.review_access_expires_at
      OR NEW.review_access_reason IS DISTINCT FROM OLD.review_access_reason)
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meticle_app')
     AND pg_has_role(current_user, 'meticle_app', 'MEMBER')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper)
     AND current_user IS DISTINCT FROM table_owner THEN
    RAISE EXCEPTION
      'review access columns may only be set by the review-access tooling, not by the application role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$guard$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_guard_review_access ON organizations;

CREATE TRIGGER organizations_guard_review_access
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION guard_organizations_review_access();