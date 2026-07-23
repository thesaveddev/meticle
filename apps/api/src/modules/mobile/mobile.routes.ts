import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { asyncHandler } from '../../shared/middleware/asyncHandler';
import { UserRole } from '@caredesk/shared';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

const router = Router();
router.use(authenticate);

// Check-in
router.post('/check-in', requireRole(UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.CARE_WORKER), asyncHandler(async (req: any, res: any) => {
  const user = req.user!;
  const { latitude, longitude, accuracy } = req.body;
  if (!latitude || !longitude) throw new AppError(400, 'Location required');
  const result = await pool.query(
    `INSERT INTO mobile_check_ins (user_id, organization_id, latitude, longitude, accuracy)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user.userId, user.organizationId, latitude, longitude, accuracy || null]
  );
  res.status(201).json(result.rows[0]);
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
            sh.shift_type, l.name as location_name, COALESCE(su.first_name || ' ' || su.last_name, '') as service_user_name
     FROM shifts sh
     JOIN locations l ON l.id = sh.location_id
     JOIN shift_assignments sa ON sa.shift_id = sh.id
     LEFT JOIN service_users su ON sh.service_user_id = su.id
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
  const { service_user_id, content, shift, category, note_date } = req.body;
  if (!service_user_id || !content) throw new AppError(400, 'Resident and note content required');

  // Verify service user belongs to org
  const suCheck = await pool.query('SELECT 1 FROM service_users WHERE id = $1 AND organization_id = $2', [service_user_id, user.organizationId]);
  if (suCheck.rows.length === 0) throw new AppError(404, 'Service user not found');

  const sp = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [user.userId]);
  const staffId = sp.rows[0]?.id;

  const result = await pool.query(
    `INSERT INTO daily_notes (service_user_id, author_id, note_date, shift, category, content)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [service_user_id, user.userId, note_date || new Date().toISOString().split('T')[0], shift || 'day', category || 'wellbeing', content]
  );
  res.status(201).json(result.rows[0]);
}));

export default router;
