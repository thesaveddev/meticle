import { Request, Response } from 'express';
import pool, { transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { AuditRepository } from '../audit/audit.repository';
import { requireLeaveInOrg, requireSameOrgForStaff } from '../../shared/database/tenant';
import { logWarn } from '../../shared/utils/logger';
import { logDelegationAction } from '../delegations/delegation.audit';
import { publishDomainEvent } from '../events/events.outbox';

export class LeaveController {
  static async getLeaveTypes(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      'SELECT * FROM leave_types WHERE organization_id = $1 ORDER BY name',
      [orgId]
    );
    if (result.rows.length === 0) {
      const { OrgRepository } = await import('../orgs/org.repository');
      await OrgRepository.seedDefaultLeaveTypes(orgId!);
      const retry = await pool.query(
        'SELECT * FROM leave_types WHERE organization_id = $1 ORDER BY name',
        [orgId]
      );
      res.json(retry.rows);
      return;
    }
    res.json(result.rows);
  }

  static async createLeaveType(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { name, color, days_allowed, hours_allowed, duration_type, is_paid, requires_approval } = req.body;
    await LeaveController.assertLeaveTotalsMatch(orgId!, {
      days_allowed: days_allowed ?? 0,
      hours_allowed: hours_allowed ?? 0,
      duration_type: duration_type || 'days',
    });
    const result = await pool.query(
      `INSERT INTO leave_types (organization_id, name, color, days_allowed, hours_allowed, duration_type, is_paid, requires_approval)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orgId, name, color || '#0F4C81', days_allowed || 0, hours_allowed || 0, duration_type || 'days', is_paid ?? true, requires_approval ?? true]
    );
    res.status(201).json(result.rows[0]);
  }

  static async updateLeaveType(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, color, days_allowed, hours_allowed, duration_type, is_paid, requires_approval } = req.body;
    const current = await pool.query('SELECT * FROM leave_types WHERE id = $1 AND organization_id = $2', [id, user.organizationId]);
    if (current.rows.length === 0) throw new AppError(404, 'Leave type not found');
    await LeaveController.assertLeaveTotalsMatch(user.organizationId!, {
      days_allowed: days_allowed ?? current.rows[0].days_allowed,
      hours_allowed: hours_allowed ?? current.rows[0].hours_allowed,
      duration_type: duration_type ?? current.rows[0].duration_type,
    }, id);
    const result = await pool.query(
      `UPDATE leave_types SET name = COALESCE($1, name), color = COALESCE($2, color),
       days_allowed = COALESCE($3, days_allowed), hours_allowed = COALESCE($4, hours_allowed),
       duration_type = COALESCE($5, duration_type),
       is_paid = COALESCE($6, is_paid), requires_approval = COALESCE($7, requires_approval)
       WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [name, color, days_allowed, hours_allowed, duration_type, is_paid, requires_approval, id, user.organizationId]
    );
    res.json(result.rows[0]);
  }

  static async deleteLeaveType(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM leave_types WHERE id = $1 AND organization_id = $2 RETURNING id', [id, user.organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Leave type not found');
    res.json({ message: 'Deleted' });
  }

  /**
   * Enforce that the combined allowance of all leave types (days x default
   * hours per day, or hours directly) exactly equals the organisation's total
   * leave allowance (base_leave_hours). Runs on create/update of a leave type
   * so the org can never drift out of balance.
   */
  private static async assertLeaveTotalsMatch(
    orgId: string,
    incoming: { days_allowed: number; hours_allowed: number; duration_type: string },
    excludeId?: string
  ) {
    const orgRes = await pool.query(
      'SELECT base_leave_hours, default_hours_per_leave_day FROM organizations WHERE id = $1', [orgId]
    );
    const base = parseFloat(orgRes.rows[0]?.base_leave_hours) || 240;
    const hpd = parseFloat(orgRes.rows[0]?.default_hours_per_leave_day) || 7.5;
    const typesRes = await pool.query(
      `SELECT days_allowed, hours_allowed, duration_type FROM leave_types WHERE organization_id = $1${excludeId ? ' AND id <> $2' : ''}`,
      excludeId ? [orgId, excludeId] : [orgId]
    );
    let total = typesRes.rows.reduce((sum: number, t: any) => sum + LeaveController.typeHours(t, hpd), 0);
    total += LeaveController.typeHours(incoming, hpd);
    if (Math.abs(total - base) > 0.01) {
      const remaining = LeaveController.round(base - total);
      throw new AppError(
        400,
        `Leave type allowances total ${LeaveController.round(total)}h but the organisation leave allowance is ${LeaveController.round(base)}h. ` +
        `Adjust the allowances so the total matches (currently ${remaining >= 0 ? `${remaining}h remaining` : `${Math.abs(remaining)}h over`}).`
      );
    }
  }

  private static typeHours(t: { days_allowed?: number; hours_allowed?: number; duration_type?: string }, hpd: number) {
    if (t?.duration_type === 'hours') return Number(t.hours_allowed) || 0;
    return (Number(t.days_allowed) || 0) * hpd;
  }

  private static round(n: number) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Normalise a DATE value (JS Date from pg, or 'YYYY-MM-DD' string) to a
   * plain 'YYYY-MM-DD' string using local getters so day counts and year
   * lookups are stable across timezones.
   */
  private static ymd(d: any): string {
    if (typeof d === 'string') return d.slice(0, 10);
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return String(d);
  }

  /**
   * Inclusive day count for a request. Dates are parsed as local YYYY-MM-DD
   * (rather than UTC midnight) so the count is stable across timezones.
   */
  private static durationDays(leave: { start_date: any; end_date: any }) {
    const start = new Date(`${LeaveController.ymd(leave.start_date)}T00:00:00`);
    const end = new Date(`${LeaveController.ymd(leave.end_date)}T00:00:00`);
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  /**
   * Reject leave for a location that has hit its max-staff-on-leave-at-once
   * limit (locations.max_staff_on_leave). A null/zero limit means unlimited.
   */
  private static async assertLocationLeaveCapacity(staffId: string, startDate: string, endDate: string) {
    const loc = await pool.query(
      `SELECT l.id, l.name, l.max_staff_on_leave
       FROM staff_profiles sp
       JOIN locations l ON sp.location_id = l.id
       WHERE sp.id = $1`,
      [staffId]
    );
    const max = loc.rows[0]?.max_staff_on_leave;
    if (!max || max <= 0) return;
    const count = await pool.query(
      `SELECT COUNT(DISTINCT lr.staff_id)::int AS cnt
       FROM leave_requests lr
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       WHERE sp.location_id = $1
         AND lr.status = 'approved'
         AND lr.start_date <= $2
         AND lr.end_date >= $3`,
      [loc.rows[0].id, endDate, startDate]
    );
    if (count.rows[0].cnt >= max) {
      throw new AppError(409, `Location "${loc.rows[0].name}" has a maximum of ${max} staff on leave at the same time, which is already reached for these dates`);
    }
  }

  /** Increment a staff member's balance after a request is approved. */
  private static async applyApprovedBalance(client: any, leave: any) {
    const startYear = new Date(`${LeaveController.ymd(leave.start_date)}T00:00:00`).getFullYear();
    if (leave.duration_type === 'hours') {
      await client.query(
        `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
         VALUES ($1, $2, $3, 0, 0, 0, $4)
         ON CONFLICT (staff_id, leave_type_id, year)
         DO UPDATE SET hours_taken = leave_balances.hours_taken + $4`,
        [leave.staff_id, leave.leave_type_id, startYear, leave.hours_requested]
      );
    } else {
      const days = LeaveController.durationDays(leave);
      await client.query(
        `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
         VALUES ($1, $2, $3, 0, $4, 0, 0)
         ON CONFLICT (staff_id, leave_type_id, year)
         DO UPDATE SET days_taken = leave_balances.days_taken + $4`,
        [leave.staff_id, leave.leave_type_id, startYear, days]
      );
    }
    await client.query(
      'UPDATE staff_profiles SET is_on_leave = TRUE, on_leave_until = $1 WHERE id = $2',
      [leave.end_date, leave.staff_id]
    );
  }

  /** Reverse a previously-applied balance increment (reject / cancel). */
  private static async reverseApprovedBalance(client: any, leave: any) {
    const startYear = new Date(`${LeaveController.ymd(leave.start_date)}T00:00:00`).getFullYear();
    if (leave.hours_requested && leave.duration_type === 'hours') {
      await client.query(
        `UPDATE leave_balances SET hours_taken = GREATEST(0, leave_balances.hours_taken - $1)
         WHERE staff_id = $2 AND leave_type_id = $3 AND year = $4`,
        [leave.hours_requested, leave.staff_id, leave.leave_type_id, startYear]
      );
    } else {
      const days = LeaveController.durationDays(leave);
      await client.query(
        `UPDATE leave_balances SET days_taken = GREATEST(0, leave_balances.days_taken - $1)
         WHERE staff_id = $2 AND leave_type_id = $3 AND year = $4`,
        [days, leave.staff_id, leave.leave_type_id, startYear]
      );
    }
    await client.query(
      'UPDATE staff_profiles SET is_on_leave = FALSE, on_leave_until = NULL WHERE id = $1',
      [leave.staff_id]
    );
  }

  static async getMyLeaveRequests(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT TO_CHAR(lr.start_date, 'YYYY-MM-DD') as start_date,
              TO_CHAR(lr.end_date, 'YYYY-MM-DD') as end_date,
              lr.id, lr.staff_id, lr.leave_type_id, lr.hours_requested,
              lr.duration_type, lr.status, lr.reason, lr.notes,
              lr.reviewed_by, lr.reviewed_at, lr.created_at, lr.updated_at,
              lt.name as leave_type_name, lt.color as leave_type_color,
              lt.duration_type as leave_duration_type,
              sp.first_name, sp.last_name,
              ru.email as reviewer_email,
              rsp.first_name as reviewer_first_name, rsp.last_name as reviewer_last_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       LEFT JOIN users ru ON lr.reviewed_by = ru.id
       LEFT JOIN staff_profiles rsp ON ru.id = rsp.user_id
       WHERE sp.user_id = $1
       ORDER BY lr.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  }

  static async getAllLeaveRequests(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { status, staff_id, location_id, start_date, end_date } = req.query;
    let sql = `SELECT TO_CHAR(lr.start_date, 'YYYY-MM-DD') as start_date,
              TO_CHAR(lr.end_date, 'YYYY-MM-DD') as end_date,
              lr.id, lr.staff_id, lr.leave_type_id, lr.hours_requested,
              lr.duration_type, lr.status, lr.reason, lr.notes,
              lr.reviewed_by, lr.reviewed_at, lr.created_at, lr.updated_at,
              lt.name as leave_type_name, lt.color as leave_type_color,
              lt.duration_type as leave_duration_type,
              sp.first_name, sp.last_name, u.email,
              sp.location_id as staff_location_id,
              ru.email as reviewer_email,
              rsp.first_name as reviewer_first_name, rsp.last_name as reviewer_last_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN users ru ON lr.reviewed_by = ru.id
       LEFT JOIN staff_profiles rsp ON ru.id = rsp.user_id
       WHERE u.organization_id = $1`
    const params: any[] = [orgId];
    let idx = 2;
    if (status) { sql += ` AND lr.status = $${idx++}`; params.push(status); }
    if (staff_id) { sql += ` AND lr.staff_id = $${idx++}`; params.push(staff_id); }
    if (location_id) { sql += ` AND sp.location_id = $${idx++}`; params.push(location_id); }
    if (start_date) { sql += ` AND lr.start_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` AND lr.end_date <= $${idx++}`; params.push(end_date); }
    sql += ' ORDER BY lr.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  }

  static async createLeaveRequest(req: Request, res: Response) {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const orgId = req.user!.organizationId;
    const { leave_type_id, start_date, end_date, reason, hours_requested, duration_type, staff_id } = req.body;

    // Resolve the staff member the leave is booked for. Admins/managers may
    // book on behalf of another staff member by passing staff_id.
    let profile: any;
    if (staff_id) {
      if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
        throw new AppError(403, 'Only managers and admins can submit leave for another staff member');
      }
      const target = await pool.query(
        `SELECT sp.id, sp.user_id, sp.contracted_hours_weekly, sp.first_name, sp.last_name,
                u.role, u.email
         FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         WHERE (sp.id = $1 OR sp.user_id = $1) AND u.organization_id = $2`,
        [staff_id, orgId]
      );
      if (target.rows.length === 0) throw new AppError(404, 'Staff member not found');
      profile = target.rows[0];
    } else {
      const own = await pool.query(
        'SELECT id, user_id, contracted_hours_weekly, first_name, last_name FROM staff_profiles WHERE user_id = $1',
        [userId]
      );
      if (own.rows.length === 0) throw new AppError(404, 'Staff profile not found');
      profile = own.rows[0];
    }
    const staffId = profile.id;
    const targetUserId = profile.user_id;
    const targetRole = staff_id ? profile.role : userRole;
    const targetEmail = profile.email || req.user!.email;
    const contractedHours = parseFloat(profile.contracted_hours_weekly) || 37.5;

    const leaveTypeRes = await pool.query(
      'SELECT name, requires_approval FROM leave_types WHERE id = $1 AND organization_id = $2',
      [leave_type_id, orgId]
    );
    if (leaveTypeRes.rows.length === 0) throw new AppError(404, 'Leave type not found');
    const leaveTypeName = leaveTypeRes.rows[0].name;
    const autoApprove = leaveTypeRes.rows[0].requires_approval === false;

    if (new Date(end_date) < new Date(start_date)) {
      throw new AppError(400, 'End date must be after start date');
    }

    const actualDurationType = duration_type || 'days';
    const rangeDays = LeaveController.durationDays({ start_date, end_date });
    if (actualDurationType === 'hours') {
      if (!hours_requested || hours_requested <= 0) {
        throw new AppError(400, 'Hours requested is required for hourly leave');
      }
      const overlapping = await pool.query(
        `SELECT id FROM leave_requests
         WHERE staff_id = $1 AND status IN ('pending', 'approved')
         AND start_date <= $2 AND end_date >= $3`,
        [staffId, end_date, start_date]
      );
      if (overlapping.rows.length > 0) {
        throw new AppError(409, 'You already have a leave request overlapping these dates');
      }
      const dailyCap = contractedHours / 5;
      const dailyHours = hours_requested / rangeDays;
      if (dailyHours > dailyCap + 0.01) {
        throw new AppError(400, `Cannot request more than ${dailyCap.toFixed(1)} hours per day (your daily contracted hours)`);
      }
    } else {
      const overlapping = await pool.query(
        `SELECT id FROM leave_requests
         WHERE staff_id = $1 AND status IN ('pending', 'approved')
         AND start_date <= $2 AND end_date >= $3`,
        [staffId, end_date, start_date]
      );
      if (overlapping.rows.length > 0) {
        throw new AppError(409, 'You already have a leave request overlapping these dates');
      }
    }

    // A location may cap how many staff can be on leave at the same time.
    await LeaveController.assertLocationLeaveCapacity(staffId, start_date, end_date);

    // Determine reviewer and notification target based on the target staff
    // member's role (not the creator's — a manager booking leave for a care
    // worker should route to the care worker's approver).
    let defaultReviewerId: string | null = null;
    let notifyUserId: string | null = null;
    if (targetRole === 'MANAGER' || targetRole === 'ORG_ADMIN') {
      // 1. Active delegation (deputy) takes precedence — the delegate reviews.
      const delegation = await pool.query(
        `SELECT delegate_manager_id FROM manager_delegations
         WHERE primary_manager_id = $1 AND is_active = true
           AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
         ORDER BY created_at DESC LIMIT 1`,
        [targetUserId]
      );
      defaultReviewerId = delegation.rows[0]?.delegate_manager_id || null;
      notifyUserId = defaultReviewerId;
      if (!notifyUserId) {
        // 2. A different ORG_ADMIN.
        const adminResult = await pool.query(
          `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND id != $2 LIMIT 1`,
          [orgId, targetUserId]
        );
        defaultReviewerId = adminResult.rows[0]?.id || null;
        notifyUserId = defaultReviewerId;
      }
      // 3. Fallback: any other manager or admin (never self) so top-level
      //    requests never deadlock. If none exist, the request is auto-approved below.
      if (!notifyUserId) {
        const peer = await pool.query(
          `SELECT id FROM users
           WHERE organization_id = $1 AND role IN ('ORG_ADMIN', 'MANAGER') AND id != $2
           ORDER BY CASE WHEN role = 'ORG_ADMIN' THEN 0 ELSE 1 END, created_at ASC
           LIMIT 1`,
          [orgId, targetUserId]
        );
        defaultReviewerId = peer.rows[0]?.id || null;
        notifyUserId = peer.rows[0]?.id || null;
      }
    } else {
      // For staff: notify their location manager, fallback to any ORG_ADMIN
      const locResult = await pool.query(
        `SELECT l.manager_id FROM staff_profiles sp LEFT JOIN locations l ON sp.location_id = l.id WHERE sp.id = $1`,
        [staffId]
      );
      const managerId = locResult.rows[0]?.manager_id || null;
      if (managerId) {
        // Check if manager has an active delegation — delegate handles the review
        const delegation = await pool.query(
          `SELECT delegate_manager_id FROM manager_delegations
           WHERE primary_manager_id = $1 AND is_active = true
             AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
           ORDER BY created_at DESC LIMIT 1`,
          [managerId]
        );
        notifyUserId = delegation.rows[0]?.delegate_manager_id || managerId;
      } else {
        const adminRes = await pool.query(
          `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' LIMIT 1`,
          [orgId]
        );
        notifyUserId = adminRes.rows[0]?.id || null;
      }
    }

    // A manager must never be the approver of leave they booked themselves
    // (e.g. a location manager booking leave for a staff member in their own
    // location). Route to any ORG_ADMIN instead; if none exists the creator is
    // the worker's designated approver and the request is not their own leave,
    // so it stays assigned to them (avoids a stuck pending request).
    if (notifyUserId === userId) {
      const adminRes = await pool.query(
        `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND id != $2 LIMIT 1`,
        [orgId, userId]
      );
      if (adminRes.rows[0]) {
        defaultReviewerId = adminRes.rows[0].id;
        notifyUserId = defaultReviewerId;
      } else {
        defaultReviewerId = userId;
      }
    }

    const result = await pool.query(
      `INSERT INTO leave_requests (staff_id, leave_type_id, start_date, end_date, reason, hours_requested, duration_type, reviewed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [staffId, leave_type_id, start_date, end_date, reason, hours_requested || null, actualDurationType, defaultReviewerId]
    );

    publishDomainEvent({
      organizationId: orgId!,
      eventName: 'leave.requested',
      aggregateType: 'leave_request',
      aggregateId: result.rows[0].id,
      correlationId: result.rows[0].id,
      payload: {
        id: result.rows[0].id,
        staff_id: staffId,
        staff_user_id: targetUserId,
        leave_type_id,
        leave_type_name: leaveTypeName,
        start_date,
        end_date,
        hours_requested: hours_requested || null,
        duration_type: actualDurationType,
        requested_by: userId,
        reviewed_by: defaultReviewerId,
      },
    }).catch(logWarn('publish leave.requested'));

    const staffName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Staff';
    const startDate = new Date(`${start_date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDate = new Date(`${end_date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // A manager/admin booking leave on behalf of another staff member is the
    // approver — the request is approved immediately and the staff member is
    // told their leave has been booked and approved.
    if (staff_id) {
      await transaction(async (client) => {
        await client.query(
          `UPDATE leave_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1
           WHERE id = $2`,
          [userId, result.rows[0].id]
        );
        await LeaveController.applyApprovedBalance(client, result.rows[0]);
      });
      const approved = await pool.query('SELECT * FROM leave_requests WHERE id = $1', [result.rows[0].id]);
      const bookerRes = await pool.query(
        `SELECT sp.first_name, sp.last_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = $1`,
        [userId]
      );
      const bookerName = [bookerRes.rows[0]?.first_name, bookerRes.rows[0]?.last_name].filter(Boolean).join(' ') || 'Your manager';
      NotificationsController.createNotification(
        targetUserId, 'Leave Booked',
        `${bookerName} has booked ${leaveTypeName} leave for you from ${startDate} to ${endDate}.`,
        'success'
      ).catch(logWarn('leave booked notification'));
      EmailService.sendLeaveBookedEmail(targetEmail, staffName, bookerName, leaveTypeName, startDate, endDate).catch(logWarn('leave booked email'));
      AuditRepository.log({
        user_id: userId,
        action: 'APPROVE_LEAVE',
        entity_type: 'leave_request',
        entity_id: result.rows[0].id,
        old_data: { status: 'pending' },
        new_data: { status: 'approved', auto: true, reason: 'booked_by_manager' },
        ip_address: req.ip,
      }).catch(logWarn('audit booked leave'));
      res.status(201).json(approved.rows[0]);
      return;
    }

    if (autoApprove || ((targetRole === 'MANAGER' || targetRole === 'ORG_ADMIN') && !notifyUserId)) {
      // Auto-approve when the type needs no approval, or when a top-level
      // request has no deputy/different admin/peer approver available. Both
      // are audit-logged so the decision is traceable.
      await transaction(async (client) => {
        await client.query(
          `UPDATE leave_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [result.rows[0].id]
        );
        await LeaveController.applyApprovedBalance(client, result.rows[0]);
      });
      const approved = await pool.query('SELECT * FROM leave_requests WHERE id = $1', [result.rows[0].id]);
      const reasonMsg = autoApprove
        ? 'Your leave request has been approved.'
        : 'Your leave request has been approved automatically (no approver configured).';
      await NotificationsController.createNotification(
        targetUserId, 'Leave Approved',
        `Your ${leaveTypeName} leave from ${startDate} to ${endDate} ${reasonMsg}`, 'success'
      ).catch(logWarn('auto-approved leave notification'));
      EmailService.sendLeaveApprovedEmail(targetEmail, staffName, leaveTypeName, startDate, endDate).catch(logWarn('auto-approved leave email'));
      AuditRepository.log({
        user_id: userId,
        action: 'APPROVE_LEAVE',
        entity_type: 'leave_request',
        entity_id: result.rows[0].id,
        old_data: { status: 'pending' },
        new_data: { status: 'approved', auto: true, reason: autoApprove ? 'type_requires_no_approval' : 'no_alternative_approver' },
        ip_address: req.ip,
      }).catch(logWarn('audit auto-approved leave'));
      res.status(201).json(approved.rows[0]);
      return;
    }

    if (notifyUserId) {
      NotificationsController.createNotification(
        notifyUserId,
        'Leave Request',
        `${staffName} has requested ${leaveTypeName} from ${startDate} to ${endDate}.`,
        'info'
      ).catch(logWarn('leave request notification'));
      const adminUserRes = await pool.query('SELECT u.email, sp.first_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = $1', [notifyUserId]);
      if (adminUserRes.rows[0]?.email) {
        EmailService.sendLeaveRequestedEmail(
          adminUserRes.rows[0].email,
          adminUserRes.rows[0].first_name || 'Manager',
          staffName,
          leaveTypeName, startDate, endDate
        ).catch(logWarn('leave requested email'));
      }
    }

    res.status(201).json(result.rows[0]);
  }

  static async reviewLeaveRequest(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { status, notes } = req.body;
    const reviewerId = user.userId;

    if (!['approved', 'rejected'].includes(status)) {
      throw new AppError(400, 'Status must be approved or rejected');
    }

    // Prevent self-approval and verify org ownership
    const leaveReq = await pool.query(
      `SELECT lr.*, sp.user_id as requester_id FROM leave_requests lr
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE lr.id = $1 AND u.organization_id = $2`,
      [id, user.organizationId]
    );
    if (leaveReq.rows.length === 0) throw new AppError(404, 'Leave request not found');
    if (leaveReq.rows[0].requester_id === reviewerId) {
      throw new AppError(403, 'You cannot review your own leave request');
    }

    // Allow ORG_ADMIN or MANAGER directly; CARE_WORKER must be an active delegate
    if (user.role === 'CARE_WORKER') {
      const isDelegate = await pool.query(
        `SELECT 1 FROM manager_delegations
         WHERE delegate_manager_id = $1 AND is_active = true
           AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [user.userId]
      );
      if (isDelegate.rows.length === 0) {
        throw new AppError(403, 'Only managers, admins, or active delegates can review leave requests');
      }
    }

    const result = await transaction(async (client) => {
      // Lock the row to prevent concurrent approvals of the same request
      const locked = await client.query(
        `SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (locked.rows.length === 0) throw new AppError(404, 'Leave request not found');
      if (locked.rows[0].status !== 'pending') throw new AppError(409, `Leave request already ${locked.rows[0].status}`);

      if (status === 'approved') {
        await LeaveController.assertLocationLeaveCapacity(
          locked.rows[0].staff_id,
          LeaveController.ymd(locked.rows[0].start_date),
          LeaveController.ymd(locked.rows[0].end_date)
        );
      }

      const updateResult = await client.query(
        `UPDATE leave_requests SET status = $1, notes = COALESCE($2, notes),
         reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $4 RETURNING *`,
        [status, notes, reviewerId, id]
      );

      if (status === 'approved') {
        await LeaveController.applyApprovedBalance(client, updateResult.rows[0]);
      }

      return updateResult;
    });

    // Send notifications for approve/reject
    try {
      const leave = result.rows[0];
      const staffUserRes = await pool.query(
        `SELECT u.id as user_id, u.email, sp.first_name, sp.last_name, lt.name as leave_type_name
         FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         JOIN leave_types lt ON lt.id = $1
         WHERE sp.id = $2`,
        [leave.leave_type_id, leave.staff_id]
      );
      const staffInfo = staffUserRes.rows[0];
      if (staffInfo) {
        const staffName = `${staffInfo.first_name || ''} ${staffInfo.last_name || ''}`.trim() || 'Staff';
        const startDate = new Date(`${LeaveController.ymd(leave.start_date)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const endDate = new Date(`${LeaveController.ymd(leave.end_date)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const leaveType = staffInfo.leave_type_name;

        if (status === 'approved') {
          await NotificationsController.createNotification(
            staffInfo.user_id, 'Leave Approved',
            `Your ${leaveType} leave from ${startDate} to ${endDate} has been approved.`, 'success'
          );
          EmailService.sendLeaveApprovedEmail(staffInfo.email, staffName, leaveType, startDate, endDate).catch(logWarn('leave approved email'));
        } else {
          await NotificationsController.createNotification(
            staffInfo.user_id, 'Leave Declined',
            `Your ${leaveType} leave from ${startDate} to ${endDate} has been declined.`, 'error'
          );
          EmailService.sendLeaveRejectedEmail(staffInfo.email, staffName, leaveType, startDate, endDate).catch(logWarn('leave rejected email'));
        }
      }
    } catch { /* notification non-critical */ }

    AuditRepository.log({
      user_id: reviewerId,
      action: status === 'approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      entity_type: 'leave_request',
      entity_id: id,
      old_data: { status: leaveReq.rows[0].status },
      new_data: { status, notes },
      ip_address: req.ip,
    }).catch(logWarn('audit review leave request'));

    logDelegationAction(
      reviewerId,
      status === 'approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      'leave_request',
      id,
      `Leave request ${status}`
    );

    res.json(result.rows[0]);
  }

  static async cancelLeaveRequest(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;

    const leave = await pool.query(
      `SELECT lr.* FROM leave_requests lr
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       WHERE lr.id = $1 AND sp.user_id = $2`,
      [id, userId]
    );
    if (leave.rows.length === 0) throw new AppError(404, 'Leave request not found');

    const request = leave.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const isFutureApproved = request.status === 'approved' && LeaveController.ymd(request.start_date) > today;
    if (request.status !== 'pending' && !isFutureApproved) {
      throw new AppError(400, `Can only cancel pending requests or future approved requests`);
    }

    const result = await transaction(async (client) => {
      const locked = await client.query(
        `SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (locked.rows.length === 0) throw new AppError(404, 'Leave request not found');
      if (locked.rows[0].status !== 'pending' && locked.rows[0].status !== 'approved') {
        throw new AppError(400, 'Only pending or approved requests can be cancelled');
      }
      if (locked.rows[0].status === 'approved') {
        const startStr = LeaveController.ymd(locked.rows[0].start_date);
        if (startStr <= today) throw new AppError(400, 'Approved leave that has already started cannot be cancelled');
        await LeaveController.reverseApprovedBalance(client, locked.rows[0]);
      } else {
        await client.query(
          'UPDATE staff_profiles SET is_on_leave = FALSE, on_leave_until = NULL WHERE id = $1 AND is_on_leave = TRUE',
          [locked.rows[0].staff_id]
        );
      }
      const updateResult = await client.query(
        "UPDATE leave_requests SET status = 'cancelled' WHERE id = $1 RETURNING *",
        [id]
      );
      return updateResult;
    });

    const cancelled = result.rows[0];

    // Notify the reviewer when a future approved request is withdrawn.
    if (cancelled.status === 'cancelled' && cancelled.reviewed_by) {
      const reviewer = await pool.query(
        `SELECT u.email, sp.first_name, sp.last_name
         FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
         WHERE u.id = $1`,
        [cancelled.reviewed_by]
      );
      if (reviewer.rows[0]?.email) {
        const reviewerName = `${reviewer.rows[0].first_name || ''} ${reviewer.rows[0].last_name || ''}`.trim() || 'Manager';
        const staffInfo = await pool.query(
          'SELECT first_name, last_name FROM staff_profiles WHERE id = $1',
          [cancelled.staff_id]
        );
        const staffName = `${staffInfo.rows[0]?.first_name || ''} ${staffInfo.rows[0]?.last_name || ''}`.trim() || 'Staff';
        const startDate = new Date(`${LeaveController.ymd(cancelled.start_date)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const endDate = new Date(`${LeaveController.ymd(cancelled.end_date)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        NotificationsController.createNotification(
          cancelled.reviewed_by, 'Leave Request Cancelled',
          `${staffName} cancelled their ${cancelled.duration_type === 'hours' ? 'hourly' : 'leave'} request from ${startDate} to ${endDate}.`,
          'info'
        ).catch(logWarn('leave cancelled notification'));
      }
    }

    AuditRepository.log({
      user_id: userId,
      action: 'CANCEL_LEAVE',
      entity_type: 'leave_request',
      entity_id: id,
      old_data: { status: request.status },
      new_data: { status: 'cancelled' },
      ip_address: req.ip,
    }).catch(logWarn('audit cancel leave request'));

    res.json(result.rows[0]);
  }

  static async getLeaveBalances(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name, lt.color as leave_type_color,
              lt.duration_type, lt.days_allowed as default_days_allowed,
              lt.hours_allowed as default_hours_allowed,
              GREATEST(lb.days_allocated, lt.days_allowed) as effective_days_allocated,
              GREATEST(lb.hours_allocated, lt.hours_allowed) as effective_hours_allocated,
              (GREATEST(lb.days_allocated, lt.days_allowed) - lb.days_taken) as days_remaining,
              (GREATEST(lb.hours_allocated, lt.hours_allowed) - lb.hours_taken) as hours_remaining
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       JOIN staff_profiles sp ON lb.staff_id = sp.id
       WHERE sp.user_id = $1
       ORDER BY lt.name`,
      [userId]
    );
    if (result.rows.length === 0) {
      const profile = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
      if (profile.rows.length === 0) {
        res.json([]);
        return;
      }
      const types = await pool.query(
        'SELECT * FROM leave_types WHERE organization_id = $1',
        [req.user!.organizationId]
      );
      for (const t of types.rows) {
        await pool.query(
          `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, hours_allocated)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [profile.rows[0].id, t.id, new Date().getFullYear(), t.days_allowed, t.hours_allowed]
        );
      }
    }
    const retry = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name, lt.color as leave_type_color,
              lt.duration_type, lt.days_allowed as default_days_allowed,
              lt.hours_allowed as default_hours_allowed,
              GREATEST(lb.days_allocated, lt.days_allowed) as effective_days_allocated,
              GREATEST(lb.hours_allocated, lt.hours_allowed) as effective_hours_allocated,
              (GREATEST(lb.days_allocated, lt.days_allowed) - lb.days_taken) as days_remaining,
              (GREATEST(lb.hours_allocated, lt.hours_allowed) - lb.hours_taken) as hours_remaining
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       JOIN staff_profiles sp ON lb.staff_id = sp.id
       WHERE sp.user_id = $1
       ORDER BY lt.name`,
      [userId]
    );
    res.json(retry.rows);
  }

  static async getStaffLeaveBalances(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const result = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name, lt.color as leave_type_color,
              lt.duration_type, lt.days_allowed as default_days_allowed,
              lt.hours_allowed as default_hours_allowed,
              GREATEST(lb.days_allocated, lt.days_allowed) as effective_days_allocated,
              GREATEST(lb.hours_allocated, lt.hours_allowed) as effective_hours_allocated,
              (GREATEST(lb.days_allocated, lt.days_allowed) - lb.days_taken) as days_remaining,
              (GREATEST(lb.hours_allocated, lt.hours_allowed) - lb.hours_taken) as hours_remaining
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.staff_id = $1
       ORDER BY lt.name`,
      [staffId]
    );
    res.json(result.rows);
  }

  static async getStaffLeaveRequests(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const result = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name, lt.color as leave_type_color,
               ru.email as reviewer_email,
               rsp.first_name as reviewer_first_name, rsp.last_name as reviewer_last_name
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        LEFT JOIN users ru ON lr.reviewed_by = ru.id
        LEFT JOIN staff_profiles rsp ON ru.id = rsp.user_id
       WHERE lr.staff_id = $1
       ORDER BY lr.created_at DESC`,
      [staffId]
    );
    res.json(result.rows);
  }

  static async updateStaffEntitlement(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const { leave_type_id, year, days_allocated, hours_allocated } = req.body;
    if (days_allocated == null && hours_allocated == null) {
      throw new AppError(400, 'Provide at least one of days_allocated or hours_allocated');
    }
    const targetYear = year || new Date().getFullYear();
    const existing = await pool.query(
      'SELECT id FROM leave_balances WHERE staff_id = $1 AND leave_type_id = $2 AND year = $3',
      [staffId, leave_type_id, targetYear]
    );
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE leave_balances
         SET days_allocated = COALESCE($1, days_allocated),
             hours_allocated = COALESCE($2, hours_allocated)
         WHERE id = $3
         RETURNING *`,
        [days_allocated ?? null, hours_allocated ?? null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, hours_allocated)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [staffId, leave_type_id, targetYear, days_allocated ?? 0, hours_allocated ?? 0]
      );
    }
    res.json(result.rows[0]);
  }

  static async getLocations(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      'SELECT * FROM locations WHERE organization_id = $1 ORDER BY name',
      [orgId]
    );
    res.json(result.rows);
  }

  static async getCalendarStats(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { month, year } = req.query;
    const m = parseInt(month as string) || new Date().getMonth() + 1;
    const y = parseInt(year as string) || new Date().getFullYear();
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${y}-${pad(m)}-01`;
    const lastDayNum = new Date(y, m, 0).getDate();
    const lastDay = `${y}-${pad(m)}-${pad(lastDayNum)}`;

    const approved = await pool.query(
      `SELECT lr.start_date, lr.end_date, lr.status, lr.staff_id
       FROM leave_requests lr
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1
         AND lr.start_date <= $3 AND lr.end_date >= $2
         AND lr.status IN ('approved', 'pending')`,
      [orgId, firstDay, lastDay]
    );

    const dates: any[] = [];
    for (let day = 1; day <= lastDayNum; day++) {
      const dateStr = `${y}-${pad(m)}-${pad(day)}`;
      const dayReqs = approved.rows.filter((r: any) => {
        const startStr = LeaveController.ymd(r.start_date);
        const endStr = LeaveController.ymd(r.end_date);
        return startStr <= dateStr && endStr >= dateStr;
      });
      dates.push({
        date: dateStr,
        approved_count: dayReqs.filter((r: any) => r.status === 'approved').length,
        pending_count: dayReqs.filter((r: any) => r.status === 'pending').length,
        total_count: dayReqs.length,
        staff_on_leave: new Set(dayReqs.filter((r: any) => r.status === 'approved').map((r: any) => r.staff_id)).size,
      });
    }
    // Distinct staff members on approved leave at any point during the month —
    // a single person off for 3 days counts as 1, not 3.
    const uniqueStaffOnLeave = new Set(
      approved.rows.filter((r: any) => r.status === 'approved').map((r: any) => r.staff_id)
    ).size;
    res.json({ dates, unique_staff_on_leave: uniqueStaffOnLeave });
  }

  /**
   * The leave requests that fall on a single calendar day, with staff names —
   * used by the calendar day popup so the popup always agrees with the day
   * cell summary (which comes from /leave/calendar-stats). Admins/managers see
   * every staff member in the org; staff only see their own requests.
   */
  static async getCalendarDay(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { date } = req.query;
    const dateStr = LeaveController.ymd(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new AppError(400, 'date must be in YYYY-MM-DD format');
    }
    const isTopLevel = req.user!.role === 'ORG_ADMIN' || req.user!.role === 'MANAGER';
    const params: any[] = [dateStr, dateStr];
    let orgClause = '';
    if (isTopLevel) {
      orgClause = `AND u.organization_id = $3`;
      params.push(orgId);
    } else {
      orgClause = `AND sp.user_id = $3`;
      params.push(req.user!.userId);
    }
    const result = await pool.query(
      `SELECT lr.id, lr.staff_id, lr.leave_type_id,
              TO_CHAR(lr.start_date, 'YYYY-MM-DD') as start_date,
              TO_CHAR(lr.end_date, 'YYYY-MM-DD') as end_date,
              lr.reason, lr.hours_requested, lr.duration_type, lr.status, lr.created_at,
              lt.name as leave_type_name, lt.color as leave_type_color,
              sp.first_name, sp.last_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN staff_profiles sp ON lr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE lr.start_date <= $1 AND lr.end_date >= $2
         AND lr.status IN ('approved', 'pending')
         ${orgClause}
       ORDER BY lr.status = 'pending' DESC, sp.first_name ASC`,
      params
    );
    res.json(result.rows);
  }
}
