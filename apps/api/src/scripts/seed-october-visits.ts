// October 2026 visit data for Clean Care LTD by default.
//
//   npm run seed:october-visits
//   npm run seed:october-visits -- --dry-run   # report, write nothing
//
// ## Which database this writes to
//
// The target is resolved from DATABASE_URL and printed, password removed,
// before anything is written — so a run is never a surprise about where it
// landed. A write to anything other than the local dev database must be
// confirmed by naming it:
//
//   SEED_CONFIRM_TARGET=<host>:<port>/<db> npm run seed:october-visits
//
// Note that localhost is not the test for "local": production is reached over
// an SSH tunnel on localhost:55432, so the whole connection target is compared,
// not just the hostname. Overridable per run:
//
//   SEED_ORG_NAME   organisation to seed  (default: Clean Care LTD)
//   SEED_YEAR       rota year            (default: 2026)
//   SEED_MONTH      rota month, 1-12     (default: 10)
//
// ## What this creates
//
// Every weekday in October, four calls a day, rostered across all seven people
// and every member of staff in the organisation. Each call is either:
//
//   finished  `completed`, with check-in/check-out, travel, mileage, notes and
//             an approved timesheet; or
//   open      `scheduled`, for staff to work as the month runs.
//
// ## Why closure is decided by the clock
//
// A visit on the 28th cannot have been completed, and seeding it as though it
// had would put check-in timestamps in the future, which then makes every report
// that sums worked minutes disagree with the calendar. So a call is closed only
// once its scheduled end is in the past — which on the 3rd means the morning
// calls are done and the evening ones are still open, rather than the whole day
// flipping to complete at midnight. That is what "open for completion" means:
// the remaining days are genuinely unworked, and closing them is the point.
//
// ## Idempotency
//
// Every row carries a `marker` in visit_notes, and the run deletes only rows
// bearing this script's own marker before inserting. It never touches visits
// belonging to other seeds — in particular the Play reviewer's 'Reviewer
// sample —' visits, which share this organisation. Deleting by marker rather
// than by date range is what keeps those safe.
//
// ## Addresses
//
// Locations are real places in the Cardiff / Rhondda / Porth area, with
// postcodes and coordinates checked against ONS-derived postcode data rather
// than typed from memory:
//
//   CF10 1EP  Cathays, Cardiff       51.475764, -3.179217
//   CF43 3AA  Tylorstown valley      51.647511, -3.432926
//   CF39 0HU  Porth                  51.622485, -3.408489
//   CF44 0PY  Aberdare, Rhondda      51.716416, -3.439620
//
// Porth's district is CF39, not CF43 — CF43 is the Tylorstown/Treorchy part of
// the valley and CF44 is Aberdare. Getting that wrong is easy and the address
// still looks plausible, which is exactly why they are written down here.

import { Client } from 'pg';
import dotenv from 'dotenv';
import { resolveSeedTarget, reportTarget, requireWriteConsent, requireOrg } from './seedTarget';

// This script opens its own pg client rather than importing the shared pool, so
// it has to load .env the way src/shared/database does — otherwise DATABASE_URL
// is only present when the caller exports it, and the script fails in a way
// that looks like a missing database rather than a missing env file.
dotenv.config();

const target = resolveSeedTarget();
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });

const ORG_NAME = target.orgName;
const MARKER = 'seed-october-visits';
const YEAR = target.year;
const MONTH = target.month;

// There is deliberately no FIRST_CLOSED_DAY constant. Closure is decided by the
// clock rather than by a day number — a call is closed only once it has actually
// finished — so pinning it to "the 1st to the 3rd" would mark this evening's
// call as done before it had happened.

const DRY_RUN = process.argv.includes('--dry-run');

// ── Locations ───────────────────────────────────────────────────────────────
// Existing locations are reused by name where possible; new ones are created.
// `address` is a single free-text field on locations — people have no address
// columns at all, which is why care rounds are addressed via the location.
const LOCATIONS = [
  { key: 'cardiff', name: 'Cathays House', address: '14 Cathays Terrace, Cardiff CF10 1EP',
    lat: 51.475764, lon: -3.179217, minStaff: 2 },
  { key: 'tylorstown', name: 'Tylorstown House', address: '3 Pentwyn Road, Tylorstown, Treorchy CF43 3AA',
    lat: 51.647511, lon: -3.432926, minStaff: 2 },
  { key: 'porth', name: 'Porth House', address: '6 Llanwonno Road, Porth CF39 0HU',
    lat: 51.622485, lon: -3.408489, minStaff: 2 },
  { key: 'aberdare', name: 'Aberdare House', address: 'Sgorrd Fawr, Aberdare CF44 0PY',
    lat: 51.716416, lon: -3.439620, minStaff: 1 },
];

// ── Roster shape ────────────────────────────────────────────────────────────
// Four calls a day, spaced from 08:00. Each call runs 45 minutes unless the
// person's support level is one_to_one, which is 90.
const SLOTS = [
  { hour: 8, minute: 0, type: 'morning', label: 'Morning call' },
  { hour: 11, minute: 0, type: 'personal_care', label: 'Midday call' },
  { hour: 14, minute: 30, type: 'personal_care', label: 'Afternoon call' },
  { hour: 18, minute: 0, type: 'evening', label: 'Evening call' },
];

// `is_open` is the thing the reviewer guide and the app both key off: a visit
// that still needs doing. Past visits are closed, the rest stay open.
const OPEN_NOTE = 'Scheduled. Not yet completed.';
const CLOSED_NOTES = [
  'Settled and comfortable throughout. Ate well and took fluids.',
  'Personal care completed with support. Mood bright, no concerns.',
  'Medication prompted and taken. Hydration encouraged.',
  'Good morning. Ate most of breakfast and was in good spirits.',
];

const asUtc = (day: number, hour: number, minute: number) =>
  new Date(Date.UTC(YEAR, MONTH - 1, day, hour, minute, 0));

const note = (marker: string, body: string) => `[${marker}] ${body}`;

async function main() {
  reportTarget(target, 'October visit seed');
  // Checked before connecting: a refused run should not open a session at all.
  requireWriteConsent(target, DRY_RUN);

  await client.connect();

  // RLS: every org-scoped table needs these set even for a read.
  await client.query(`SELECT set_config('app.current_user_id', $1, false)`,
    ['00000000-0000-0000-0000-000000000000']);
  await client.query(`SELECT set_config('app.current_user_role', $1, false)`, ['SUPER_ADMIN']);

  // Throws with the list of organisations if the name is wrong, rather than
  // printing "Nothing to do" and exiting 0.
  const orgId = await requireOrg(client, ORG_NAME);
  await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [orgId]);

  // ── Staff ────────────────────────────────────────────────────────────────
  // Every staff member in the org gets rostered. The leave flag is cleared when
  // it has expired, because a stale flag makes the app show someone as away
  // while the rota has them working a full month.
  const staff = (await client.query(
    `SELECT s.id, s.first_name, s.last_name, s.is_on_leave, s.on_leave_until,
            u.id AS user_id, u.role
       FROM staff_profiles s JOIN users u ON u.id = s.user_id
      WHERE u.organization_id = $1
      ORDER BY u.email`, [orgId])).rows;

  if (!staff.length) {
    console.error(
      `'${ORG_NAME}' has no staff accounts — there is nobody to roster visits to. ` +
        'Nothing was written.',
    );
    await client.end();
    process.exit(1);
  }

  const clearedLeave: string[] = [];
  for (const s of staff) {
    if (!s.is_on_leave) continue;
    const until = s.on_leave_until ? new Date(s.on_leave_until) : null;
    if (!until || until.getTime() < Date.now()) {
      if (!DRY_RUN) {
        await client.query(
          `UPDATE staff_profiles SET is_on_leave = FALSE, on_leave_until = NULL WHERE id = $1`, [s.id]);
      }
      clearedLeave.push(`${s.first_name} ${s.last_name}`);
    }
  }

  // ── People and packages ──────────────────────────────────────────────────
  const people = (await client.query(
    `SELECT p.id, p.first_name, p.last_name, p.support_level, p.room_number,
            p.location_id, p.status,
            pkg.id AS package_id, pkg.name AS package_name
       FROM people p
       LEFT JOIN LATERAL (
         SELECT g.id, g.name
           FROM homecare_packages g
          WHERE g.person_id = p.id AND g.organization_id = p.organization_id
          ORDER BY g.created_at ASC, g.id ASC
          LIMIT 1
       ) pkg ON TRUE
      WHERE p.organization_id = $1
      ORDER BY p.first_name`, [orgId])).rows;

  // A plain LEFT JOIN is wrong here. Production carries 13-18 duplicate package
  // rows per person from a repeated seed run in 2025, so joining packages
  // directly would return one row per package and put the same person on the
  // roster 18 times. LATERAL ... LIMIT 1 picks the oldest package per person and
  // keeps the roster one row per person.

  // package_id is NOT NULL on homecare_visits, so a person with no care package
  // cannot be given a visit at all. An active person without one is a gap in the
  // data rather than a reason to drop them off the rota, so the package is
  // created here — named for this seed, so it is identifiable and re-runnable.
  const createdPackages: string[] = [];
  for (const p of people.filter((x) => !x.package_id && x.status === 'active')) {
    const pkgName = `${MARKER} — Personal care — ${p.first_name}`;
    if (DRY_RUN) {
      createdPackages.push(pkgName);
      p.package_id = '00000000-0000-0000-0000-000000000000';
      p.package_name = pkgName;
      continue;
    }
    const r = await client.query(
      `INSERT INTO homecare_packages
         (organization_id, person_id, name, funding_type, weekly_hours,
          hourly_rate_pence, mileage_rate_pence, created_by)
       VALUES ($1,$2,$3,'local_authority',$4,1350,45,$5) RETURNING id`,
      [orgId, p.id, pkgName, p.support_level === 'one_to_one' ? 30 : 10, staff[0].user_id]);
    p.package_id = r.rows[0].id;
    p.package_name = pkgName;
    createdPackages.push(pkgName);
  }

  const needPackage = people.filter((p) => !p.package_id);
  const roster = people.filter((p) => p.package_id);

  // ── Locations: reuse by name, create otherwise ───────────────────────────
  const existing = (await client.query(
    `SELECT id, name, address, latitude, longitude FROM locations WHERE organization_id = $1`,
    [orgId])).rows;

  const locationIds: Record<string, string> = {};
  for (const spec of LOCATIONS) {
    const match = existing.find((l) => l.name === spec.name);
    if (match) {
      locationIds[spec.key] = match.id;
      if (!DRY_RUN) {
        await client.query(
          `UPDATE locations SET address = $1, latitude = $2, longitude = $3,
                  min_day_staff = $4, updated_at = NOW()
             WHERE id = $5`, [spec.address, spec.lat, spec.lon, spec.minStaff, match.id]);
      }
    } else {
      // A dry run still needs an id to report against, but must not insert one.
      locationIds[spec.key] = DRY_RUN
        ? '00000000-0000-0000-0000-000000000000'
        : (await client.query(
            `INSERT INTO locations (organization_id, name, address, latitude, longitude, min_day_staff)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [orgId, spec.name, spec.address, spec.lat, spec.lon, spec.minStaff])).rows[0].id;
    }
  }

  // Spread the people over the four locations. Deterministic, so re-running does
  // not shuffle who lives where.
  const peopleByLocation: Record<string, typeof roster> = {};
  for (const key of LOCATIONS.map((l) => l.key)) peopleByLocation[key] = [];
  roster.forEach((p, i) => {
    peopleByLocation[LOCATIONS[i % LOCATIONS.length].key].push(p);
  });

  // ── Remove this script's previous rows ───────────────────────────────────
  // By marker only. The Play reviewer's visits live in this same organisation
  // and are labelled 'Reviewer sample —'; a date-range delete would take them.
  // Timesheets cascade from the visit, so removing the visits is enough.
  //
  // The DELETE is guarded, not just the reporting: a dry run that deletes is not
  // a dry run, and this one re-runs against a live organisation.
  let removedVisits = 0;
  if (DRY_RUN) {
    const count = await client.query(
      `SELECT count(*)::int AS n FROM homecare_visits
        WHERE organization_id = $1 AND visit_notes LIKE $2`, [orgId, `%[${MARKER}]%`]);
    removedVisits = count.rows[0].n;
  } else {
    const removable = await client.query(
      `DELETE FROM homecare_visits
        WHERE organization_id = $1 AND visit_notes LIKE $2 RETURNING id`, [orgId, `%[${MARKER}]%`]);
    removedVisits = removable.rowCount ?? 0;
  }

  // ── Build the month ──────────────────────────────────────────────────────
  const createdBy = staff[0].user_id;
  const rows: any[] = [];
  const daysInMonth = new Date(Date.UTC(YEAR, MONTH, 0)).getUTCDate();

  // One counter for the whole month, used to pick the person and to pick the
  // staff member. Deriving both from `day + i` instead looks equivalent and is
  // not: (day + i) % 4 and (day + i) % 2 are the same parity, so every location
  // only ever drew the same person out of its own pair and half the roster was
  // never visited at all. A single counter with independent strides covers
  // everyone.
  let seq = 0;
  const now = Date.now();

  // Staff are picked with a stride coprime to the roster length. A fixed
  // stride of 3 looks fine and is not: with 9 staff, gcd(3, 9) = 3, so
  // (seq * 3) % 9 only ever yields 0, 3 and 6 — three staff working the whole
  // month while the other six never appear. This is the same trap as the
  // parity bug above, one factor up: the two-staff local roster hid it
  // because every stride is coprime to 2. Deriving the stride from the roster
  // size keeps every staff member in play for any roster.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const staffStrideValue = (() => {
    const s = staff.length;
    for (let k = 3; k < s; k++) if (gcd(k, s) === 1) return k;
    return 1;
  })();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(YEAR, MONTH - 1, day));
    const dow = date.getUTCDay();
    if (dow === 0) continue; // no Sunday calls in this seed

    for (const slot of SLOTS) {
      const person = roster[seq % roster.length];
      const carer = staff[(seq * staffStrideValue) % staff.length];
      seq++;

      const start = asUtc(day, slot.hour, slot.minute);
      const minutes = person.support_level === 'one_to_one' ? 90 : 45;
      const end = new Date(start.getTime() + minutes * 60_000);

      // Closed only if the call has actually finished. `day <= 3` would mark the
      // 18:00 call on the 3rd as done at 18:00 tonight, writing a check-in two
      // hours into the future — which then disagrees with every report that
      // compares worked time against the clock.
      const isPast = end.getTime() < now;

      const row: any = {
        package_id: person.package_id,
        person_id: person.id,
        assigned_staff_id: carer.id,
        visit_type: slot.type,
        label: `${slot.label} — ${person.first_name}`,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        status: isPast ? 'completed' : 'scheduled',
        check_in_at: null,
        check_out_at: null,
        actual_travel_minutes: null,
        actual_mileage_miles: null,
        mileage_status: 'not_submitted',
        visit_notes: isPast
          ? note(MARKER, CLOSED_NOTES[seq % CLOSED_NOTES.length])
          : note(MARKER, OPEN_NOTE),
        created_by: createdBy,
        // Timesheet inputs, applied only for closed visits.
        work_minutes: isPast ? minutes + 5 : 0,
        travel_minutes: isPast ? 12 + (seq % 4) * 3 : 0,
        mileage_miles: isPast ? Number((2.1 + (seq % 5) * 0.4).toFixed(1)) : 0,
      };

      if (isPast) {
        // Check in a couple of minutes early, out a few minutes before the end:
        // what actually happens on a round, and it keeps the
        // check_out_at >= check_in_at constraint satisfied.
        row.check_in_at = new Date(start.getTime() - 3 * 60_000).toISOString();
        row.check_out_at = new Date(end.getTime() - 5 * 60_000).toISOString();
        row.actual_travel_minutes = row.travel_minutes;
        row.actual_mileage_miles = row.mileage_miles;
        row.mileage_status = 'approved';
      }
      rows.push(row);
    }
  }

  if (DRY_RUN) {
    console.log(`DRY RUN — ${rows.length} visits would be created for ${ORG_NAME}.`);
    console.log(`  completed (calls already finished): ${rows.filter((r) => r.status === 'completed').length}`);
    console.log(`  open      (still to be worked):    ${rows.filter((r) => r.status === 'scheduled').length}`);
    console.log(`  would delete ${removedVisits} previously-seeded visit(s)`);
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    // The packages above are written before the transaction because they are
    // part of resolving the roster, not of the visit data itself. A failure
    // here leaves them behind, which is harmless and idempotent: the next run
    // finds the person already has a package.
    // Point people at their new location.
    for (const [key, list] of Object.entries(peopleByLocation)) {
      if (!list.length || !locationIds[key]) continue;
      await client.query(
        `UPDATE people SET location_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
        [locationIds[key], list.map((p) => p.id)]);
    }

    let timesheets = 0;
    for (const r of rows) {
      const ins = await client.query(
        `INSERT INTO homecare_visits
           (organization_id, package_id, person_id, assigned_staff_id, visit_type, label,
            scheduled_start, scheduled_end, status, check_in_at, check_out_at,
            actual_travel_minutes, actual_mileage_miles, mileage_status, visit_notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [orgId, r.package_id, r.person_id, r.assigned_staff_id, r.visit_type, r.label,
         r.scheduled_start, r.scheduled_end, r.status, r.check_in_at, r.check_out_at,
         r.actual_travel_minutes, r.actual_mileage_miles, r.mileage_status, r.visit_notes,
         r.created_by]);

      // A timesheet only for a completed visit — an open one has no hours yet.
      if (r.status === 'completed') {
        const hourly = 1350;
        const mileageRate = 45;
        const gross = Math.round((r.work_minutes / 60) * hourly + r.mileage_miles * mileageRate);
        await client.query(
          `INSERT INTO homecare_timesheets
             (organization_id, visit_id, staff_id, work_minutes, travel_minutes,
              paid_travel_minutes, mileage_miles, mileage_rate_pence, hourly_rate_pence,
              gross_pay_pence, status, submitted_at, approved_by, approved_at)
           VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,'approved',NOW(),$10,NOW())`,
          [orgId, ins.rows[0].id, r.assigned_staff_id, r.work_minutes, r.travel_minutes,
           r.mileage_miles, mileageRate, hourly, gross, createdBy]);
        timesheets++;
      }
    }
    await client.query('COMMIT');

    console.log(`Seeded ${ORG_NAME} (${target.from.slice(0, 7)}): ` +
      `${rows.length} visits, ${timesheets} timesheets.`);
    console.log(`  completed (calls already finished): ${rows.filter((r) => r.status === 'completed').length}`);
    console.log(`  open      (still to be worked):    ${rows.filter((r) => r.status === 'scheduled').length}`);
    console.log(`  re-ran over ${removedVisits} previously-seeded visit(s)`);
    if (clearedLeave.length) console.log(`  cleared stale leave: ${clearedLeave.join(', ')}`);
    if (createdPackages.length) {
      console.log(`  created ${createdPackages.length} care package(s):`);
      for (const n of createdPackages) console.log(`    ${n}`);
    }
    if (needPackage.length) {
      console.log(`  ${needPackage.length} person(s) still skipped, no care package:`);
      for (const p of needPackage) console.log(`    ${p.first_name} ${p.last_name} (status=${p.status})`);
    }
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