// Collapse duplicate care packages to one per person, without losing visits.
//
//   npm run seed:dedupe-packages
//   npm run seed:dedupe-packages -- --dry-run   # report, write nothing
//
// ## Why this is not a simple DELETE
//
// Clean Care LTD on production carries 188 package rows for 12 people — 13 to
// 18 near-identical copies each, all created within a few seconds of one
// another on 2025-08-09 by a package seed that ran in a loop. Every one of
// them is referenced by an existing visit, and homecare_visits_package_id_fkey
// is ON DELETE CASCADE. So deleting the duplicates outright would cascade away
// 176 of the 524 existing visits along with their timesheets. That is data
// loss dressed up as a cleanup.
//
// Instead each person's visits are first moved onto their oldest package; only
// then are the duplicates deleted, and by that point they are unreferenced so
// the cascade has nothing to take. Visit count before and after is asserted to
// be identical, and the whole thing runs in one transaction so a failure
// anywhere leaves production exactly as it was.
//
// ## Scope
//
// One organisation at a time (SEED_ORG_NAME, default 'Clean Care LTD') and only
// packages belonging to that org. Every other org on the server, including
// DreakCare Supported Living, is untouched.

import { Client } from 'pg';
import dotenv from 'dotenv';
import { resolveSeedTarget, reportTarget, requireWriteConsent, requireOrg } from './seedTarget';

dotenv.config();

const target = resolveSeedTarget();
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
const DRY_RUN = process.argv.includes('--dry-run');

/** One statement per step so the dry run can report the same numbers as the
 *  real run rather than guessing at them. */
async function countVisits(orgId: string): Promise<number> {
  const r = await client.query(
    `SELECT count(*)::int AS n FROM homecare_visits WHERE organization_id = $1`, [orgId]);
  return r.rows[0].n;
}

async function main() {
  reportTarget(target, 'Care package dedupe');
  requireWriteConsent(target, DRY_RUN);

  await client.connect();
  await client.query(`SELECT set_config('app.current_user_id', $1, false)`,
    ['00000000-0000-0000-0000-000000000000']);
  await client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['SUPER_ADMIN']);

  const orgId = await requireOrg(client, target.orgName);
  await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId]);

  const before = await countVisits(orgId);
  const dupes = (await client.query(
    `SELECT g.person_id, count(*) AS n
       FROM homecare_packages g
      WHERE g.organization_id = $1
      GROUP BY g.person_id HAVING count(*) > 1
      ORDER BY n DESC`, [orgId])).rows;
  const totalPackages = (await client.query(
    `SELECT count(*)::int AS n FROM homecare_packages WHERE organization_id = $1`,
    [orgId])).rows[0].n;
  const peopleCount = (await client.query(
    `SELECT count(*)::int AS n FROM people WHERE organization_id = $1`, [orgId])).rows[0].n;

  console.log(`\n  people: ${peopleCount}  packages: ${totalPackages}  visits: ${before}`);
  if (!dupes.length) {
    console.log('  No duplicate packages — nothing to do.');
    await client.end();
    return;
  }
  const toDelete = dupes.reduce((n: number, d: any) => n + (d.n - 1), 0);
  console.log(`  ${dupes.length} person(s) have duplicates; ${toDelete} row(s) would be removed.`);

  // Visits attached to a package that is not the keeper, and the keeper itself.
  const repoint = (await client.query(
    `WITH keeper AS (
       SELECT DISTINCT ON (person_id) id, person_id
         FROM homecare_packages
        WHERE organization_id = $1
        ORDER BY person_id, created_at ASC, id ASC
     )
     SELECT count(*)::int AS n
       FROM homecare_visits v
      WHERE v.organization_id = $1
        AND EXISTS (SELECT 1 FROM homecare_packages g
                     WHERE g.id = v.package_id
                       AND g.id <> (SELECT k.id FROM keeper k WHERE k.person_id = g.person_id))`,
    [orgId])).rows[0].n;
  console.log(`  visits to repoint onto the oldest package: ${repoint}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing was written. Re-run without --dry-run to apply.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    // 1. Move visits onto each person's oldest package. After this, no visit
    //    references a duplicate, so step 2's cascade deletes nothing.
    const moved = await client.query(
      `WITH keeper AS (
         SELECT DISTINCT ON (person_id) id, person_id
           FROM homecare_packages
          WHERE organization_id = $1
          ORDER BY person_id, created_at ASC, id ASC
       )
       UPDATE homecare_visits v
          SET package_id = k.id
         FROM homecare_packages g, keeper k
        WHERE v.organization_id = $1
          AND g.id = v.package_id
          AND k.person_id = g.person_id
          AND v.package_id <> k.id`,
      [orgId]);
    console.log(`\n  repointed ${moved.rowCount} visit(s) onto the oldest package`);

    // 2. Every visit now points at its person's oldest package, so the duplicates
    //    are unreferenced and the cascade has nothing to take. Guarded so this
    //    can never cascade into anything even if step 1 is ever changed.
    //    Three tables hold a package_id — visits, visit plans and client billing
    //    lines — and the first has ON DELETE CASCADE, so all three are checked
    //    rather than just the one this script touches.
    const deleted = await client.query(
      `WITH keeper AS (
         SELECT DISTINCT ON (person_id) id, person_id
           FROM homecare_packages
          WHERE organization_id = $1
          ORDER BY person_id, created_at ASC, id ASC
       )
       DELETE FROM homecare_packages g
        WHERE g.organization_id = $1
          AND NOT EXISTS (SELECT 1 FROM keeper k
                           WHERE k.person_id = g.person_id AND k.id = g.id)
          AND NOT EXISTS (SELECT 1 FROM homecare_visits v WHERE v.package_id = g.id)
          AND NOT EXISTS (SELECT 1 FROM homecare_visit_plans vp WHERE vp.package_id = g.id)
          AND NOT EXISTS (SELECT 1 FROM homecare_client_billing_lines bl WHERE bl.package_id = g.id)`,
      [orgId]);
    console.log(`  deleted ${deleted.rowCount} duplicate package(s)`);

    const after = await countVisits(orgId);
    const remaining = (await client.query(
      `SELECT count(*)::int AS n FROM homecare_packages WHERE organization_id = $1`,
      [orgId])).rows[0].n;

    // The whole point of repointing first: this must not move.
    if (after !== before) {
      throw new Error(
        `Visit count changed from ${before} to ${after}. Rolling back — the dedupe ` +
        'must not remove any visit.');
    }
    await client.query('COMMIT');
    console.log(`\n  visits before ${before} → after ${after} (unchanged, as required)`);
    console.log(`  packages ${totalPackages} → ${remaining}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});