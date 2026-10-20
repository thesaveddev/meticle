/**
 * The phone's room-check board — the rooms a support worker can clear tonight.
 *
 * The overdue sweep (`room-checks/roomCheckOverdue.ts`) derives the rooms that should
 * have a check from the residents' own `room_number`, nudges the staff rostered at
 * that location, and files the manager's copy in Mission Control. Until now that was
 * where it stopped: the nudge said "12 at Ash Grove has no room check today" and the
 * only place to answer it was the web page, so a worker standing in the doorway with
 * a phone in their hand had to remember it for later. This is the same derivation,
 * read for the phone.
 *
 * Two deliberate choices:
 *
 *  * **The same rule, not a second interpretation of it.** The rooms are the
 *    residents' own rooms grouped by the same `room_number_normalized` column the
 *    sweep groups by, and the due hour and the "has the provider's clock passed it"
 *    test are the sweep's own exports (`ROOM_CHECK_DUE_HOUR`, `hasReachedDueHour`).
 *    The one difference is what this query is *for*: the sweep asks only for rooms
 *    without a check, where the phone asks for every room and its state. A phone that
 *    decided the matching rules for itself would eventually disagree with the nudge
 *    that sent the worker to the door, and a check screen that argues with its own
 *    notification is worse than none.
 *  * **Checked rooms stay on the board.** A list that empties as you work is
 *    satisfying but useless an hour later, when the worker wants to know whether room
 *    14 was done or whether they still owe it. Every room is returned, with its check
 *    when it has one, and the outstanding ones sort first.
 *
 * The board is scoped to the locations the worker is rostered at today when there are
 * any — those are the rooms they can actually walk to — and to the whole provider when
 * they are not rostered, because a worker covering a shift they were not assigned to
 * should still be able to clear a room rather than be told it is not theirs.
 */
import { query } from '../../shared/database';
import { hasReachedDueHour, ROOM_CHECK_DUE_HOUR } from '../room-checks/roomCheckOverdue';

/** One room on the board, with the day's check when somebody has recorded one. */
export interface MobileRoomCheckRow {
  room_number: string;
  /** The normalised room the check is matched on — what `POST` should be trusted against. */
  room_key: string;
  location_id: string;
  location_name: string;
  /** When the check happened; null means nobody has checked this room today. */
  checked_at: string | null;
  checked_by_name: string | null;
  status: string | null;
}

export interface MobileRoomCheckBoard {
  /** False for a provider that is not supported living: the phone hides the card. */
  applicable: boolean;
  /** The provider's own day, as the database resolves it (session timezone). */
  today: string;
  due_hour: number;
  /** Whether the provider's own clock has passed the due hour. */
  due: boolean;
  outstanding: number;
  rooms: MobileRoomCheckRow[];
}

const ROOMS_TODAY_SQL = `
  WITH rooms AS (
    SELECT MIN(p.room_number)          AS room_number,
           p.room_number_normalized    AS room_key,
           l.id                        AS location_id,
           l.name                      AS location_name
      FROM people p
      JOIN locations l ON l.id = p.location_id
     WHERE p.status = 'active'
       AND p.room_number_normalized IS NOT NULL
       AND p.room_number_normalized <> ''
       AND l.organization_id = $1
       AND ($2::uuid[] IS NULL OR l.id = ANY($2::uuid[]))
     GROUP BY p.room_number_normalized, l.id, l.name
  ),
  today_checks AS (
    SELECT rc.room_number_normalized AS room_key,
           rc.location_id,
           rc.status,
           rc.created_at,
           COALESCE(NULLIF(TRIM(sp.first_name || ' ' || sp.last_name), ''), '') AS checked_by_name
      FROM room_checks rc
      LEFT JOIN staff_profiles sp ON sp.id = rc.checked_by
     WHERE rc.organization_id = $1
       AND rc.check_date = CURRENT_DATE
  )
  SELECT r.room_number,
         r.room_key,
         r.location_id,
         r.location_name,
         c.created_at AS checked_at,
         c.checked_by_name,
         c.status
    FROM rooms r
    LEFT JOIN LATERAL (
      SELECT created_at, checked_by_name, status
        FROM today_checks c
       WHERE c.room_key = r.room_key
         -- A check with no location of its own was recorded against the resident's
         -- room and counts for the room it names, exactly as the sweep counts it.
         AND (c.location_id = r.location_id OR c.location_id IS NULL)
       ORDER BY c.created_at DESC
       LIMIT 1
    ) c ON TRUE
   ORDER BY (c.created_at IS NULL) DESC, r.location_name, r.room_number`;

/**
 * The worker's board: what needs doing at the rooms they can reach, and what has been
 * done. Read inside the request's tenant context, so `CURRENT_DATE` is the provider's
 * day rather than UTC's.
 */
export async function getRoomCheckBoard(
  organizationId: string,
  userId: string,
): Promise<MobileRoomCheckBoard> {
  const org = await query(
    `SELECT service_types @> ARRAY['supported_living']::TEXT[] AS supported,
            EXTRACT(HOUR FROM CURRENT_TIMESTAMP)::int  AS hour,
            CURRENT_DATE::text                          AS today
       FROM organizations
      WHERE id = $1`,
    [organizationId],
  );
  const info = org.rows[0];
  const dueHour = ROOM_CHECK_DUE_HOUR;
  const today: string = info?.today ?? '';
  if (!info?.supported) {
    return { applicable: false, today, due_hour: dueHour, due: false, outstanding: 0, rooms: [] };
  }

  const mine = await query(
    `SELECT DISTINCT s.location_id::text AS location_id
       FROM shift_assignments sa
       JOIN shifts s ON s.id = sa.shift_id AND s.status <> 'cancelled'
       JOIN staff_profiles sp ON sp.id = sa.staff_id
      WHERE sp.user_id = $1
        AND sa.status <> 'rejected'
        AND s.start_time::date <= CURRENT_DATE
        AND s.end_time::date >= CURRENT_DATE`,
    [userId],
  );
  const locationIds: string[] = mine.rows.map((row: { location_id: string }) => row.location_id);

  const rooms = await query(ROOMS_TODAY_SQL, [
    organizationId,
    locationIds.length > 0 ? locationIds : null,
  ]);

  const rows: MobileRoomCheckRow[] = rooms.rows.map((row: any) => ({
    room_number: row.room_number,
    room_key: row.room_key,
    location_id: row.location_id,
    location_name: row.location_name,
    checked_at: row.checked_at ? new Date(row.checked_at).toISOString() : null,
    checked_by_name: row.checked_at ? row.checked_by_name : null,
    status: row.checked_at ? row.status : null,
  }));

  return {
    applicable: true,
    today,
    due_hour: dueHour,
    due: hasReachedDueHour(Number(info.hour ?? 0), dueHour),
    outstanding: rows.filter(r => !r.checked_at).length,
    rooms: rows,
  };
}
