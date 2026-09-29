import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@meticle/shared';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { resolveLocation, isLocationTrackingEnabled, getWorkerLocationDecision } from '../homecare/homecare.repository';

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
