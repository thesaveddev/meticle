/**
 * Room check overdue — the last open event type in the supported-living blueprint
 * §9.9, and the one §10 routes to the support worker and the manager.
 *
 * A room check is a daily record of an occupied room's cleanliness and safety. The
 * module could store one, list one and edit one, and it could not answer the
 * question the record exists for: *which rooms were not checked today?* Nothing
 * computed it, because the state is the absence of a row rather than a row in a
 * state — so this sweep derives the expectation and reports the gap.
 *
 * **What "due" means, and why it is derived rather than configured.** The rooms a
 * provider has to check are the rooms people are living in: `people.room_number` at
 * an active person's location. A room the provider does not use cannot be overdue,
 * and asking a manager to maintain a second list of rooms would create a list that
 * disagrees with the residents' own records. So the expectation is "every occupied
 * room in a supported-living service, every day", and a room is overdue when the
 * provider's own day has reached `ROOM_CHECK_DUE_HOUR` and no `room_checks` row
 * exists for that room and that day.
 *
 * Five decisions, each of which is a way this could have become noise:
 *
 *  * **A due hour, not midnight.** Rooms are checked during the working day. A
 *    sweep at 09:00 reporting every room as overdue would be reporting the truth
 *    about a day that has not finished, and would train people to ignore it. After
 *    18:00 local time the day's opportunity has passed.
 *  * **Only supported living.** `organizations.service_types` is the product's own
 *    answer to "is this a service with rooms", and a domiciliary provider has none
 *    to check. The check is on the organisation, not on the person's record.
 *  * **One nudge per room per day.** The state is an absence, so there is nothing to
 *    stamp; `room_check_nudges` (migration 155) records what has been said. A
 *    thirty-minute tick is then safe, which is what makes the nudge arrive promptly
 *    rather than once a night.
 *  * **The roster is the audience and the manager keeps the alert.** The support
 *    workers on shift at that location can record the check; the Mission Control
 *    alert is the manager-facing copy, so a room nobody was rostered to check is
 *    still visible to somebody. With nobody rostered the event is still raised, with
 *    an empty audience — the alert is the point of that run.
 *  * **Discovery on the superuser pool, work inside a tenant context.** The app role
 *    is subject to RLS and a background job has no request, so discovery reads with
 *    `migrateQuery` and every provider's work runs in `runWithOrgContext`, where the
 *    session date and hour are the provider's own (migration 149).
 *  * **A room is the normalised room (migration 156).** The resident's room and the
 *    checked room are free text typed on two screens, so an exact comparison missed
 *    checks that had been recorded (reporting a room overdue that was done) and could
 *    count one physical room twice. Both sides now compare on a stored generated
 *    column, which no writer can forget to fill in.
 */
import { migrateQuery, query } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { runWithOrgContext } from '../events/events.org-context';
import { publishRoomCheckOverdueEvent, RoomCheckRecipient, roomCheckNudgeKey } from './room-check.events';

/** The local hour after which a room with no check counts as overdue. */
export const ROOM_CHECK_DUE_HOUR = 18;

/** A ceiling on one organisation's work in a single run. */
const MAX_ROOMS_PER_ORG = 200;

interface DueRoomRow {
  location_id: string;
  location_name: string;
  room_number: string;
}

export interface RoomCheckOverdueSweepResult {
  /** Organisations the sweep visited. */
  orgs: number;
  /** Events raised, one per room per day. */
  published: number;
  /** Organisations whose sweep threw; the run continues for the others. */
  failed: number;
}

/**
 * Whether the provider's day has reached the hour a room check is due by.
 *
 * Exported and pure so the rule can be asserted at any hour of the day: the
 * integration tests cannot choose the wall clock, and a gate that can only be
 * tested by waiting until the evening is a gate nobody tests.
 */
export function hasReachedDueHour(localHour: number, dueHour: number): boolean {
  return localHour >= dueHour;
}

/**
 * Rooms occupied by an active person with no check recorded today.
 *
 * The comparison is on `room_number_normalized` (migration 156) on both sides, because
 * the resident's room and the checked room are free text typed on two screens: exact
 * equality made "12 ", "Room 12" and "012" three different rooms from the room the
 * resident lives in, so a room somebody checked was reported overdue and one physical
 * room spelled two ways could be reported twice. A generated column is what makes this
 * unforgettable rather than a rule this query has to remember.
 *
 * A room is the *normalised* room, so the expectation is grouped by it and the label a
 * person reads is one of the spellings in that group (`MIN`, which is deterministic).
 * Without the group, two residents in room 12 who wrote it differently are two rooms
 * to this query and two nudges to the staff.
 */
const DUE_ROOMS_SQL = `
  SELECT MIN(p.room_number) AS room_number,
         l.id   AS location_id,
         l.name AS location_name
    FROM people p
    JOIN locations l ON l.id = p.location_id
   WHERE p.status = 'active'
     AND p.room_number_normalized IS NOT NULL
     AND p.room_number_normalized <> ''
     AND l.organization_id = $1
     AND NOT EXISTS (
       SELECT 1
         FROM room_checks rc
        WHERE rc.organization_id = $1
          AND rc.room_number_normalized = p.room_number_normalized
          AND rc.check_date = CURRENT_DATE
          AND (
            rc.location_id = p.location_id
            -- A check recorded from the resident's own profile has no placement of
            -- its own when the profile did not carry one; the room it names is the
            -- room that resident sleeps in. Counting it is the difference between
            -- noticing a missing check and nagging about one somebody already did,
            -- and a nudge that is sometimes wrong is one people learn to ignore.
            OR rc.location_id IS NULL
          )
     )
   GROUP BY p.room_number_normalized, l.id, l.name
   ORDER BY l.name, MIN(p.room_number)
   LIMIT $2`;

/**
 * The staff rostered at one location today — the people who can record the check.
 *
 * A shift overlaps today when it starts on or before today and ends on or after it,
 * which covers the night shift that began yesterday and the one that ends tomorrow.
 * A rejected assignment is not a roster: that person did not take the shift.
 */
async function rosteredToday(locationId: string): Promise<RoomCheckRecipient[]> {
  const result = await query(
    `SELECT DISTINCT sp.user_id, TRIM(sp.first_name || ' ' || sp.last_name) AS name
       FROM shift_assignments sa
       JOIN shifts s ON s.id = sa.shift_id AND s.status <> 'cancelled'
       JOIN staff_profiles sp ON sp.id = sa.staff_id
       JOIN users u ON u.id = sp.user_id AND u.status = 'active'
      WHERE s.location_id = $1
        AND sa.status <> 'rejected'
        AND s.start_time::date <= CURRENT_DATE
        AND s.end_time::date >= CURRENT_DATE
      ORDER BY name`,
    [locationId],
  );
  return result.rows as RoomCheckRecipient[];
}

/** Rooms the sweep has already spoken about on the provider's today. */
async function nudgedToday(orgId: string): Promise<Set<string>> {
  const result = await query(
    `SELECT location_id, room_number, check_date::text AS check_date
       FROM room_check_nudges
      WHERE organization_id = $1
        AND check_date = CURRENT_DATE`,
    [orgId],
  );
  const keys = new Set<string>();
  for (const row of result.rows) {
    keys.add(roomCheckNudgeKey(row.location_id, row.check_date, row.room_number));
  }
  return keys;
}

/**
 * Raise the events for one organisation, then record that they were raised.
 *
 * The ledger row is written *after* the event is recorded, never before: a crash
 * between the two nudges twice, which is the direction to fail in, where the other
 * order loses the nudge entirely. One room failing does not stop the rest.
 */
async function sweepOrg(orgId: string, dueHour: number): Promise<number> {
  // The provider's own hour, read from the database because the session timezone
  // inside `runWithOrgContext` is set from `organizations.timezone` (migration 149)
  // — the same clock `CURRENT_DATE` below is resolved on, so the day and the hour
  // cannot disagree.
  const hourRow = await query(`SELECT EXTRACT(HOUR FROM CURRENT_TIMESTAMP)::int AS hour`);
  if (!hasReachedDueHour(Number(hourRow.rows[0]?.hour ?? 0), dueHour)) return 0;

  const rooms = await query(DUE_ROOMS_SQL, [orgId, MAX_ROOMS_PER_ORG]);
  if (rooms.rows.length === 0) return 0;

  const todayRow = await query(`SELECT CURRENT_DATE::text AS today`);
  const today: string = todayRow.rows[0].today;
  const alreadyNudged = await nudgedToday(orgId);

  const audiences = new Map<string, RoomCheckRecipient[]>();
  let published = 0;

  for (const room of rooms.rows as DueRoomRow[]) {
    const key = roomCheckNudgeKey(room.location_id, today, room.room_number);
    if (alreadyNudged.has(key)) continue;

    try {
      let rostered = audiences.get(room.location_id);
      if (!rostered) {
        rostered = await rosteredToday(room.location_id);
        audiences.set(room.location_id, rostered);
      }

      await publishRoomCheckOverdueEvent({
        organizationId: orgId,
        locationId: room.location_id,
        locationName: room.location_name,
        roomNumber: room.room_number,
        checkDate: today,
        dueHour,
        rostered,
      });

      // The marker is the room's own absence-of-a-record key, not an event id: a
      // later run asks "have I told them about this room today?".
      await query(
        `INSERT INTO room_check_nudges (organization_id, location_id, room_number, check_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, location_id, room_number, check_date) DO NOTHING`,
        [orgId, room.location_id, room.room_number, today],
      );
      published += 1;
    } catch (err: any) {
      logger.error(
        { err: err?.message, orgId, locationId: room.location_id, room: room.room_number },
        'Could not raise room_check.overdue; the room stays unnotified for the next run',
      );
    }
  }

  return published;
}

/**
 * Sweep every supported-living organisation for rooms nobody has checked today.
 *
 * `dueHour` is a parameter rather than read from the clock so the rule can be
 * exercised at any time of day; production passes the constant. Discovery finds every
 * supported-living provider with an occupied room and the hour is then judged inside
 * each provider's own tenant context, so a sweep that runs at 23:00 UTC does not
 * start reporting a provider whose day is still in the afternoon.
 */
export async function runRoomCheckOverdueSweep(
  options: { dueHour?: number } = {},
): Promise<RoomCheckOverdueSweepResult> {
  const dueHour = Math.min(23, Math.max(0, Math.floor(options.dueHour ?? ROOM_CHECK_DUE_HOUR)));

  const orgs = await migrateQuery(
    `SELECT DISTINCT l.organization_id AS id
       FROM people p
       JOIN locations l ON l.id = p.location_id
       JOIN organizations o ON o.id = l.organization_id
      WHERE p.status = 'active'
        AND p.room_number_normalized IS NOT NULL
        AND p.room_number_normalized <> ''
        AND o.service_types @> ARRAY['supported_living']::TEXT[]`,
  );

  let published = 0;
  let failed = 0;
  let visited = 0;
  for (const org of orgs.rows) {
    visited += 1;
    try {
      published += await runWithOrgContext(org.id, () => sweepOrg(org.id, dueHour));
    } catch (err: any) {
      failed += 1;
      logger.error({ err: err?.message, orgId: org.id }, 'Room-check-overdue sweep failed for organisation');
    }
  }

  return { orgs: visited, published, failed };
}
