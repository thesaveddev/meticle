// Verify the seeded October data the way the app reads it: through the
// request-scoped RLS context and the homecare repository's own listVisits.
// A raw SELECT would not prove the app can see these rows — RLS is per-request
// and the repository's query is the one the mobile app actually calls.
//
// Read-only, so it needs no confirmation — but it resolves the target the same
// way the seed does and prints it, so "verified" can never refer to a different
// database or month than the one that was seeded.
import pool, { requestDBStorage } from '../shared/database';
import { listVisits } from '../modules/homecare/homecare.repository';
import { resolveSeedTarget, reportTarget, requireOrg } from './seedTarget';

async function main() {
  const target = resolveSeedTarget();
  reportTarget(target, 'October visit verification');

  const client = await pool.connect();
  try {
    try {
      await client.query(`SELECT set_config('app.current_org_id', $1, false)`, ['']);
    } catch { /* set below with the real org */ }

    const orgId = await requireOrg(client, target.orgName);

    await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId]);
    await client.query(`SELECT set_config('app.current_user_id', $1, false)`,
      ['00000000-0000-0000-0000-000000000000']);
    await client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['ORG_ADMIN']);

    // Inside this scope every query resolves to the client that has the RLS
    // variables set, which is exactly what rlsMiddleware does per request.
    await requestDBStorage.run({ client }, async () => {
      const rows: any[] = await listVisits(orgId, { from: target.from, to: target.to });
    console.log(`listVisits(${target.from.slice(0, 7)}) via repository: ${rows.length} rows\n`);

    const byStatus: Record<string, number> = {};
    const byStaff: Record<string, number> = {};
    const byPerson: Record<string, number> = {};
    for (const v of rows) {
      byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
      const s = v.staff_name ?? v.assigned_staff_id ?? 'unassigned';
      byStaff[s] = (byStaff[s] ?? 0) + 1;
      const p = v.person_name ?? v.person_id ?? 'unknown';
      byPerson[p] = (byPerson[p] ?? 0) + 1;
    }
    console.log('by status:', byStatus);
    console.log('by staff:', byStaff);
    console.log('by person:', byPerson);

    const completed = rows.filter((v) => v.status === 'completed');
    console.log(`\ncompleted with both timestamps: ${
      completed.filter((v) => v.check_in_at && v.check_out_at).length}/${completed.length}`);
    console.log(`completed in the future: ${
      completed.filter((v) => new Date(v.check_in_at) > new Date()).length}`);
    console.log(`open visits with a check-in already: ${
      rows.filter((v) => v.status === 'scheduled' && v.check_in_at).length}`);

    console.log('\nfirst 3 rows:');
    for (const v of rows.slice(0, 3)) {
      console.log(' ', JSON.stringify({
        label: v.label, status: v.status, start: v.scheduled_start,
        person: v.person_name, staff: v.staff_name, location: v.location_name,
        check_in: v.check_in_at, check_out: v.check_out_at,
        mileage: v.actual_mileage_miles,
      }));
    }

    // Per-staff filter, the other path the app uses for "my visits".
    const staffRows = await listVisits(orgId, { from: target.from, to: target.to,
      staffId: rows.find((r) => r.assigned_staff_id)?.assigned_staff_id });
    console.log(`\nlistVisits filtered by one staff member: ${staffRows.length} rows`);
    });
  } finally {
    // Without this a failed org lookup leaves the client checked out and the
    // process hangs on the open pool instead of reporting the error.
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });