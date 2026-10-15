import { migrateQuery } from '../shared/database';

/**
 * The role the RLS suite impersonates.
 *
 * The suite needs a non-superuser to `SET ROLE` into: RLS is not enforced for a
 * superuser (and not for a table owner either), so without this role every
 * isolation assertion below would pass for the wrong reason. Granting that role
 * what it needs is a schema-wide operation — `GRANT ... ON ALL TABLES IN SCHEMA
 * public` takes a lock on every table, and so does any `ALTER TABLE ... ENABLE
 * ROW LEVEL SECURITY` — which is why it is created here, once, from
 * `test/global-setup.ts`, before a single worker exists.
 *
 * It used to be created in the suite's own `beforeAll`, and that put those locks
 * in the middle of the parallel run. Measured on 15 October 2026, with one
 * ordinary read transaction held open while the suite started: the sweep waited
 * 55 seconds for `qualifications` (218 samples of a pending AccessExclusiveLock),
 * took AccessExclusiveLock on users, people, locations, teams, invoices,
 * invitations, compliance_profiles and more while other suites were mid-flight,
 * and made their foreign-key checks queue behind it — `RowShareLock on users`
 * waited 141 times. In CI the same cycle resolved as a deadlock rather than a
 * stall (`40P01`: one session waiting for RowShareLock, the other for
 * AccessExclusiveLock) and killed an unrelated suite.
 *
 * Global setup has the whole database to itself, so the same statements cannot
 * meet anybody's transaction there. The suite now asserts this role exists
 * instead of creating it, which is the stricter arrangement anyway: a missing
 * prerequisite fails loudly and by name rather than quietly taking an exclusive
 * lock across the schema.
 */
export const RLS_TEST_ROLE = 'rls_test_role';

/** The role cannot log in and owns nothing; it exists only to be set into. */
export async function ensureRlsTestRole(): Promise<void> {
  const database = databaseName();
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(
      `Refusing to grant CONNECT using "${database}" as a database name: an interpolated GRANT needs a plain identifier.`
    );
  }

  // CREATE ROLE has no IF NOT EXISTS, so ask pg_roles first rather than
  // treating the duplicate-object error as success.
  await migrateQuery(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_TEST_ROLE}') THEN
        CREATE ROLE ${RLS_TEST_ROLE} NOLOGIN;
      END IF;
    END $$`);

  await migrateQuery(`GRANT CONNECT ON DATABASE ${database} TO ${RLS_TEST_ROLE}`);
  await migrateQuery(`GRANT USAGE ON SCHEMA public TO ${RLS_TEST_ROLE}`);
  await migrateQuery(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RLS_TEST_ROLE}`);
  await migrateQuery(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RLS_TEST_ROLE}`);
  // Tables created after this point (there are none in a test run — migrations
  // have finished by the time global setup calls this) would otherwise be
  // unreadable to the role.
  await migrateQuery(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RLS_TEST_ROLE}`
  );
}

/**
 * The database this process is connected to, for the CONNECT grant. Read from
 * the URL the process was handed rather than from a second connection, so it
 * names the same database the migrations just ran against.
 */
export function databaseName(): string {
  const url = process.env.DATABASE_URL ?? '';
  const match = /\/([^/?]+)(?:\?|$)/.exec(url);
  return match ? match[1] : 'meticle';
}
