import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { resolveLocation, isLocationTrackingEnabled, getWorkerLocationDecision } from '../homecare/homecare.repository';
import { getRoomCheckBoard } from './mobile.roomChecks';

const router = Router();
router.use(authenticate);

/**
 * Whether this SecureVisit check-in may record a position.
 *
 * The same two gates as a care-visit check-in, in the same order, reusing
 * `resolveLocation` so there is one implementation of the rule rather than two
 * that can drift. Imported from the homecare repository on purpose: the
 * alternative was a second copy of this logic in the mobile module, and the
 * whole failure mode being fixed here was two code paths disagreeing about
 * whether location was allowed.
 */
async function resolveMobileCheckInLocation(
  organizationId: string,
  userId: string,
  input: { latitude?: number; longitude?: number; accuracy_meters?: number },
) {
  const [trackingEnabled, decision] = await Promise.all([
    isLocationTrackingEnabled(organizationId),
    getWorkerLocationDecision(userId),
  ]);
  return resolveLocation(trackingEnabled, decision, input);
}

// Check-in
//
// This endpoint used to be a way around everything the homecare location
// controls are for. It stored a position on every call, consulted neither the
// organisation switch nor the worker's own decision, and had no retention rule
// — so a provider who had switched location off, or a worker who had declined,
// could still be located through this page, and the position sat in
// mobile_check_ins with nothing that would ever remove it.
//
// It now goes through the same resolution as a care-visit check-in, in the same
// order: organisation first, because it is the outer control, then the
// worker's own decision, and only then are coordinates required. That ordering
// is the point — a worker who declined checks in with no position rather than
// being refused, because losing the ability to start a shift over a privacy
// choice would make the choice meaningless.
//
// The check-in is recorded either way. What the worker loses is the position,
// and with it the "Verified" badge: the record is kept, the coordinates are not,
// and the reason is stored on the row so a manager can tell a refusal from a
// device that failed to get a fix.
router.post('/check-in', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const { latitude, longitude, accuracy } = req.body;
  const location = await resolveMobileCheckInLocation(user.organizationId, user.userId, {
    latitude,
    longitude,
    accuracy_meters: accuracy,
  });
  const result = await pool.query(
    `INSERT INTO mobile_check_ins (user_id, organization_id, latitude, longitude, accuracy, location_capture_skip_reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [user.userId, user.organizationId, location.lat, location.lon, location.accuracy, location.skipReason]
  );
  res.status(201).json({
    ...result.rows[0],
    location_capture_skipped: location.skipped,
    location_capture_skip_reason: location.skipReason,
  });
}));

router.get('/check-ins', asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const result = await pool.query(
    `SELECT * FROM mobile_check_ins WHERE user_id = $1 ORDER BY checked_in_at DESC LIMIT 20`,
    [user.userId]
  );
  res.json(result.rows);
}));

// Offline roster
router.get('/my-roster', asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const sp = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [user.userId]);
  const staffId = sp.rows[0]?.id;
  const result = await pool.query(
    `SELECT sh.id, sh.start_time::date as date, sh.start_time::time as start_time, sh.end_time::time as end_time,
            sh.shift_type, l.name as location_name, COALESCE(su.first_name || ' ' || su.last_name, '') as person_name
     FROM shifts sh
     JOIN locations l ON l.id = sh.location_id
     JOIN shift_assignments sa ON sa.shift_id = sh.id
     LEFT JOIN people su ON sh.person_id = su.id
     WHERE sa.staff_id = $1 AND sh.start_time >= CURRENT_DATE
       AND sh.start_time < CURRENT_DATE + INTERVAL '7 days'
     ORDER BY sh.start_time`,
    [staffId]
  );
  res.json(result.rows);
}));

/**
 * The signed-in carer's own shifts, with the state of each one's handover.
 *
 * `/my-roster` answers "what am I working this week" and only looks forward, which
 * is the wrong window for a handover: the shift whose handover is due is the one
 * that has just *ended*, so it is behind the roster's `CURRENT_DATE` filter. This
 * looks both ways, defaults to the week either side, and carries the handover state
 * so the phone can show which shifts still owe one instead of making the carer open
 * each shift to find out.
 *
 * The handover fields are joined, not counted per row by the caller: one query per
 * screen beats one per shift, and a carer on a slow connection opens this once.
 *
 * Since 18 October 2026 each row also carries **this carer's own attendance** — the
 * first clock-on, the last clock-off, and whether the two count them as on duty. The
 * phone is where a shift is clocked on, so the list has to say which shift is open
 * rather than making the carer open each one to find out. Offsets, not a single
 * "latest event": a worker who steps out and comes back has several intervals, and
 * the counts are order-independent, which is the same rule the attendance endpoint
 * applies.
 */
/**
 * The rooms that should have a check today, and which of them have one.
 *
 * The overdue nudge (`room_check.overdue`) tells a worker that 12 at Ash Grove has
 * no check; until this endpoint the only place to answer it was the web page, so the
 * nudge was a reminder to do something later rather than a thing they could finish
 * where they were standing. The board is the same rooms the sweep derives, with the
 * day's check attached where somebody has recorded one — so the list both shows what
 * is outstanding and remembers what has been done.
 *
 * A non-supported-living provider gets `applicable: false` and an empty board rather
 * than a 403: the phone asks on behalf of every service type and hides the card.
 */
router.get('/room-checks/today', asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const board = await getRoomCheckBoard(user.organizationId!, user.userId);
  res.json(board);
}));

router.get('/my-shifts', asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const { from, to } = req.query as { from?: string; to?: string };
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !dayPattern.test(from)) || (to && !dayPattern.test(to))) {
    throw new AppError(400, 'from and to must use YYYY-MM-DD');
  }

  const sp = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [user.userId]);
  const staffId = sp.rows[0]?.id;
  // No staff profile is not an error worth a 403 here: the empty list is the honest
  // answer, and the same shape the carer's other list endpoints return.
  if (!staffId) { res.json([]); return; }

  const result = await pool.query(
    `SELECT s.id, s.location_id, l.name AS location_name, s.shift_type, s.status,
            s.start_time, s.end_time, s.actual_start_at, s.actual_end_at,
            mine.clocked_on_at, mine.clocked_off_at, mine.clock_on_count, mine.clock_off_count,
            h.id AS handover_id, h.version AS handover_version,
            h.recorded_at AS handover_recorded_at, h.what_happened,
            COALESCE(NULLIF(TRIM(spa.first_name || ' ' || spa.last_name), ''), ua.email) AS handover_author_name,
            (SELECT COUNT(*)::int FROM shift_handover_acknowledgements a WHERE a.handover_id = h.id) AS acknowledgement_count,
            EXISTS (
              SELECT 1 FROM shift_handover_acknowledgements a
               WHERE a.handover_id = h.id AND a.user_id = $2
            ) AS viewer_acknowledged,
            (h.id IS NOT NULL AND h.author_id = $2) AS viewer_is_author,
            (h.id IS NULL AND s.end_time < CURRENT_TIMESTAMP) AS handover_due
       FROM shifts s
       JOIN locations l ON l.id = s.location_id
       JOIN shift_assignments sa ON sa.shift_id = s.id
       LEFT JOIN shift_handovers h ON h.shift_id = s.id AND h.organization_id = l.organization_id
       LEFT JOIN staff_profiles spa ON spa.user_id = h.author_id
       LEFT JOIN users ua ON ua.id = h.author_id
       -- This carer's own attendance for this shift, in one scan rather than four
       -- correlated subqueries. The counts answer "on duty now"; the offsets are what
       -- the row prints.
       LEFT JOIN LATERAL (
         SELECT MIN(e.recorded_at) FILTER (WHERE e.event = 'clock_on') AS clocked_on_at,
                MAX(e.recorded_at) FILTER (WHERE e.event = 'clock_off') AS clocked_off_at,
                COUNT(*) FILTER (WHERE e.event = 'clock_on')::int AS clock_on_count,
                COUNT(*) FILTER (WHERE e.event = 'clock_off')::int AS clock_off_count
           FROM shift_attendance_events e
          WHERE e.shift_id = s.id AND e.user_id = $2
       ) mine ON TRUE
      WHERE sa.staff_id = $1
        AND l.organization_id = $3
        AND sa.status <> 'rejected'
        AND s.status <> 'cancelled'
        AND s.start_time::date <= COALESCE($5::date, CURRENT_DATE + 7)
        AND s.end_time::date >= COALESCE($4::date, CURRENT_DATE - 7)
      ORDER BY s.start_time DESC
      LIMIT 100`,
    [staffId, user.userId, user.organizationId, from || null, to || null]
  );

  res.json(result.rows.map((row: any) => ({
    id: row.id,
    location_id: row.location_id,
    location_name: row.location_name,
    shift_type: row.shift_type,
    status: row.status,
    start_time: row.start_time,
    end_time: row.end_time,
    actual_start_at: row.actual_start_at,
    actual_end_at: row.actual_end_at,
    clocked_on_at: row.clocked_on_at,
    clocked_off_at: row.clocked_off_at,
    // Counted, not "the latest event was a clock-on": an offline replay can land out
    // of order, and a worker who stepped out has more than one interval.
    on_duty: row.clock_on_count > row.clock_off_count,
    handover_due: row.handover_due,
    handover: row.handover_id ? {
      id: row.handover_id,
      version: row.handover_version,
      author_name: row.handover_author_name || 'Former user',
      recorded_at: row.handover_recorded_at,
      what_happened: row.what_happened,
      acknowledgement_count: row.acknowledgement_count,
      viewer_acknowledged: row.viewer_acknowledged,
      viewer_is_author: row.viewer_is_author,
    } : null,
  })));
}));

// Voice notes via daily notes endpoint
router.post('/notes', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const { person_id, content, shift, category, note_date } = req.body;
  if (!person_id || !content) throw new AppError(400, 'Resident and note content required');

  // Verify person belongs to org
  const suCheck = await pool.query('SELECT 1 FROM people WHERE id = $1 AND organization_id = $2', [person_id, user.organizationId]);
  if (suCheck.rows.length === 0) throw new AppError(404, 'Person not found');

  const sp = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [user.userId]);
  const staffId = sp.rows[0]?.id;

  const result = await pool.query(
    `INSERT INTO daily_notes (person_id, author_id, note_date, shift, category, content)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [person_id, user.userId, note_date || new Date().toISOString().split('T')[0], shift || 'day', category || 'wellbeing', content]
  );
  res.status(201).json(result.rows[0]);
}));

export default router;
