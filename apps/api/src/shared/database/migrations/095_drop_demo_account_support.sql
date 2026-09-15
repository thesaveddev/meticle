-- The public demo sandbox is gone: POST /api/demo/access, its read-only guard and
-- the UI that entered it have all been removed, so the flag they shared has no
-- reader or writer left.
--
-- An environment that used the sandbox may still hold the account it created,
-- and that account's password was hard-coded in the API source, so it is
-- deactivated before the flag that identified it is dropped.
UPDATE users SET status = 'deactivated'
WHERE email = 'demo@meticlecare.com' AND status <> 'deactivated';

DROP INDEX IF EXISTS idx_organizations_is_demo;
ALTER TABLE organizations DROP COLUMN IF EXISTS is_demo;
