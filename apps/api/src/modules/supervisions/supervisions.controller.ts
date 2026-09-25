import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { requireRole } from '../../shared/middleware/requireRole';
import { AuditRepository } from '../audit/audit.repository';
import { query } from '../../shared/database';
import { UserRole } from '@meticle/shared';

const SUPERVISION_MONTHS = 6;

function orgId(req: Request): string {
  const value = req.user?.organizationId;
  if (!value) throw new AppError(403, 'Organization context required');
  return value;
}

const SELECT_FIELDS = `SELECT s.id,
       s.staff_user_id,
       s.supervisor_user_id,
       s.supervised_at,
       s.supervision_type,
       s.agenda,
       s.notes,
       s.actions,
       s.next_due_date,
       s.created_at,
       CONCAT_WS(' ', sp.first_name, sp.last_name) AS staff_name,
       sp.first_name AS staff_first_name,
       sp.last_name AS staff_last_name,
       CONCAT_WS(' ', vp.first_name, vp.last_name) AS supervisor_name
  FROM staff_supervisions s
  JOIN users su ON su.id = s.staff_user_id
  LEFT JOIN staff_profiles sp ON sp.user_id = s.staff_user_id
  JOIN users vu ON vu.id = s.supervisor_user_id
  LEFT JOIN staff_profiles vp ON vp.user_id = s.supervisor_user_id`;

export class SupervisionController {
  /**
   * Everyone can read the log, but a care worker only ever sees their own
   * entries. Managers and compliance officers see the whole organisation.
   */
  static async list(req: Request, res: Response) {
    const oid = orgId(req);
    const uid = req.user!.userId;
    const isManager = [UserRole.ORG_ADMIN, UserRole.MANAGER, UserRole.COMPLIANCE_OFFICER].includes(req.user!.role);

    const staffUserId = typeof req.query.staff_user_id === 'string' ? req.query.staff_user_id : null;
    const limit = Math.min(parseInt((req.query.limit as string) || '100'), 200);

    const conditions = ['s.organization_id = $1'];
    const params: any[] = [oid];
    if (!isManager) {
      conditions.push('s.staff_user_id = $2');
      params.push(uid);
    } else if (staffUserId) {
      params.push(staffUserId);
      conditions.push(`s.staff_user_id = $${params.length}`);
    }
    params.push(limit);

    const result = await query(
      `${SELECT_FIELDS}
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.supervised_at DESC, s.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  }

  /** The six-month coverage figure the compliance score is built on. */
  static async summary(req: Request, res: Response) {
    const oid = orgId(req);
    const result = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE organization_id = $1 AND status = 'active') AS total,
         (SELECT COUNT(DISTINCT s.staff_user_id)::int
            FROM staff_supervisions s
            JOIN users u ON u.id = s.staff_user_id AND u.organization_id = $1
           WHERE s.organization_id = $1
             AND s.supervised_at >= CURRENT_DATE - INTERVAL '${SUPERVISION_MONTHS} months') AS done,
         (SELECT COUNT(*)::int FROM staff_supervisions s
           WHERE s.organization_id = $1
             AND s.supervised_at >= CURRENT_DATE - INTERVAL '${SUPERVISION_MONTHS} months') AS sessions`,
      [oid]
    );
    const total = result.rows[0]?.total || 0;
    const done = result.rows[0]?.done || 0;
    res.json({ total, done, sessions: result.rows[0]?.sessions || 0, rate: total > 0 ? Math.round((done / total) * 100) : 0 });
  }

  static async create(req: Request, res: Response) {
    const oid = orgId(req);
    const { staff_user_id, supervisor_user_id, supervised_at, supervision_type, agenda, notes, actions, next_due_date } = req.body;

    const target = await query(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [staff_user_id, oid]
    );
    if (!target.rows.length) throw new AppError(404, 'Staff member not found in your organisation');

    // A supervision cannot be recorded against someone outside the org, and a
    // supervisor cannot be the person being supervised.
    const supervisor = await query(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
      [supervisor_user_id, oid]
    );
    if (!supervisor.rows.length) throw new AppError(400, 'Supervisor must be a member of your organisation');
    if (supervisor_user_id === staff_user_id) throw new AppError(400, 'You cannot supervise yourself');

    const result = await query(
      `INSERT INTO staff_supervisions
         (organization_id, staff_user_id, supervisor_user_id, supervised_at, supervision_type, agenda, notes, actions, next_due_date, created_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), COALESCE($5, 'individual'), $6, $7, $8, $9, $10)
       RETURNING id`,
      [oid, staff_user_id, supervisor_user_id, supervised_at || null, supervision_type || null, agenda || null, notes || null, actions || null, next_due_date || null, req.user!.userId]
    );

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'create',
      entity_type: 'staff_supervision',
      entity_id: result.rows[0].id,
      ip_address: req.ip,
    }).catch(() => {});

    const created = await query(`${SELECT_FIELDS} WHERE s.id = $1`, [result.rows[0].id]);
    res.status(201).json(created.rows[0]);
  }

  static async remove(req: Request, res: Response) {
    const oid = orgId(req);
    const existing = await query(
      'SELECT id, created_by FROM staff_supervisions WHERE id = $1 AND organization_id = $2',
      [req.params.id, oid]
    );
    if (!existing.rows.length) throw new AppError(404, 'Supervision record not found');
    if (existing.rows[0].created_by !== req.user!.userId && req.user!.role !== UserRole.ORG_ADMIN) {
      throw new AppError(403, 'You can only remove supervision records you recorded');
    }

    await query('DELETE FROM staff_supervisions WHERE id = $1', [req.params.id]);
    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'delete',
      entity_type: 'staff_supervision',
      entity_id: req.params.id,
      ip_address: req.ip,
    }).catch(() => {});
    res.json({ deleted: true });
  }
}
