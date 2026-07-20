import { Request, Response } from 'express';
import pool, { transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { AuditRepository } from '../audit/audit.repository';
import { requireLeaveInOrg, requireSameOrgForStaff } from '../../shared/database/tenant';
import { logWarn } from '../../shared/utils/logger';
import { logDelegationAction } from '../delegations/delegation.audit';

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
    const { name, color, days_allowed, hours_allowed, duration_type } = req.body;
    const result = await pool.query(
      `INSERT INTO leave_types (organization_id, name, color, days_allowed, hours_allowed, duration_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, name, color || '#0F4C81', days_allowed || 0, hours_allowed || 0, duration_type || 'days']
    );
    res.status(201).json(result.rows[0]);
  }

  static async updateLeaveType(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, color, days_allowed, hours_allowed, duration_type } = req.body;
    const result = await pool.query(
      `UPDATE leave_types SET name = COALESCE($1, name), color = COALESCE($2, color),
       days_allowed = COALESCE($3, days_allowed), hours_allowed = COALESCE($4, hours_allowed),
       duration_type = COALESCE($5, duration_type) WHERE id = $6 AND organization_id = $7 RETURNING *`,
      [name, color, days_allowed, hours_allowed, duration_type, id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Leave type not found');
    res.json(result.rows[0]);
  }

  static async deleteLeaveType(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM leave_types WHERE id = $1 AND organization_id = $2 RETURNING id', [id, user.organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Leave type not found');
    res.json({ message: 'Deleted' });
  }

  static async getMyLeaveRequests(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name, lt.color as leave_type_color,
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
    let sql = `SELECT lr.*, lt.name as leave_type_name, lt.color as leave_type_color,
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
    const { leave_type_id, start_date, end_date, reason, hours_requested, duration_type } = req.body;

    const profile = await pool.query(
      'SELECT id, contracted_hours_weekly, first_name, last_name FROM staff_profiles WHERE user_id = $1',
      [userId]
    );
    if (profile.rows.length === 0) throw new AppError(404, 'Staff profile not found');
    const staffId = profile.rows[0].id;
    const contractedHours = parseFloat(profile.rows[0].contracted_hours_weekly) || 37.5;

    if (new Date(end_date) < new Date(start_date)) {
      throw new AppError(400, 'End date must be after start date');
    }

    const actualDurationType = duration_type || 'days';
    if (actualDurationType === 'hours') {
      if (!hours_requested || hours_requested <= 0) {
        throw new AppError(400, 'Hours requested is required for hourly leave');
      }
      const overlapping = await pool.query(
        `SELECT id FROM leave_requests
         WHERE staff_id = $1 AND status IN ('pending', 'approved')
         AND start_date = $2`,
        [staffId, start_date]
      );
      if (overlapping.rows.length > 0) {
        throw new AppError(409, 'You already have a leave request for this date');
      }
      if (hours_requested > contractedHours / 5) {
        throw new AppError(400, `Cannot request more than ${contractedHours / 5} hours in a single day (your daily contracted hours)`);
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

    const userRole = req.user!.role;

    // Determine reviewer and notification target
    let defaultReviewerId: string | null = null;
    let notifyUserId: string | null = null;

    if (userRole === 'MANAGER' || userRole === 'ORG_ADMIN') {
      // Find a different ORG_ADMIN to review
      const adminResult = await pool.query(
        `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND id != $2 LIMIT 1`,
        [req.user!.organizationId, userId]
      );
      defaultReviewerId = adminResult.rows[0]?.id || null;
      notifyUserId = defaultReviewerId;
      // Fallback: notify any ORG_ADMIN if no different admin found
      if (!notifyUserId) {
        const anyAdmin = await pool.query(
          `SELECT id FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' LIMIT 1`,
          [req.user!.organizationId]
        );
        notifyUserId = anyAdmin.rows[0]?.id || null;
      }
    }

    // For staff: notify their location manager, fallback to any ORG_ADMIN
    if (userRole !== 'MANAGER' && userRole !== 'ORG_ADMIN') {
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
          [req.user!.organizationId]
        );
        notifyUserId = adminRes.rows[0]?.id || null;
      }
    }

    const result = await pool.query(
      `INSERT INTO leave_requests (staff_id, leave_type_id, start_date, end_date, reason, hours_requested, duration_type, reviewed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [staffId, leave_type_id, start_date, end_date, reason, hours_requested || null, actualDurationType, defaultReviewerId]
    );

    const staffName = `${profile.rows[0]?.first_name || ''} ${profile.rows[0]?.last_name || ''}`.trim();
    const leaveTypeRes = await pool.query('SELECT name FROM leave_types WHERE id = $1', [leave_type_id]);
    const leaveTypeName = leaveTypeRes.rows[0]?.name || 'Leave';
    const startDate = new Date(start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDate = new Date(end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    if (notifyUserId) {
      NotificationsController.createNotification(
        notifyUserId,
        'Leave Request',
        `${staffName || 'A staff member'} has requested ${leaveTypeName} from ${startDate} to ${endDate}.`,
        'info'
      ).catch(logWarn('leave request notification'));
      const adminUserRes = await pool.query('SELECT u.email, sp.first_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.id = $1', [notifyUserId]);
      if (adminUserRes.rows[0]?.email) {
        EmailService.sendLeaveRequestedEmail(
          adminUserRes.rows[0].email,
          adminUserRes.rows[0].first_name || 'Manager',
          staffName || 'A staff member',
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
      const updateResult = await client.query(
        `UPDATE leave_requests SET status = $1, notes = COALESCE($2, notes),
         reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $4 RETURNING *`,
        [status, notes, reviewerId, id]
      );

      if (status === 'approved') {
        const leave = updateResult.rows[0];
        const startYear = new Date(leave.start_date).getFullYear();
        if (leave.duration_type === 'hours') {
          await client.query(
            `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, days_taken, hours_allocated, hours_taken)
             VALUES ($1, $2, $3, 0, 0, 0, $4)
             ON CONFLICT (staff_id, leave_type_id, year)
             DO UPDATE SET hours_taken = leave_balances.hours_taken + $4`,
            [leave.staff_id, leave.leave_type_id, startYear, leave.hours_requested]
          );
        } else {
          const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86400000) + 1;
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
      } else if (status === 'rejected' || status === 'cancelled') {
        const leave = updateResult.rows[0];
        const startYear = new Date(leave.start_date).getFullYear();
        // Reverse any balance increment from a prior approval
        if (leave.hours_requested && leave.duration_type === 'hours') {
          await client.query(
            `UPDATE leave_balances SET hours_taken = GREATEST(0, leave_balances.hours_taken - $1)
             WHERE staff_id = $2 AND leave_type_id = $3 AND year = $4`,
            [leave.hours_requested, leave.staff_id, leave.leave_type_id, startYear]
          );
        } else {
          const days = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86400000) + 1;
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
        const startDate = new Date(leave.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const endDate = new Date(leave.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
    if (leave.rows[0].status !== 'pending') {
      throw new AppError(400, 'Can only cancel pending requests');
    }

    const result = await pool.query(
      "UPDATE leave_requests SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [id]
    );

    // Clear is_on_leave if the request had been approved previously
    if (result.rows[0]) {
      await pool.query(
        'UPDATE staff_profiles SET is_on_leave = FALSE, on_leave_until = NULL WHERE id = $1 AND is_on_leave = TRUE',
        [result.rows[0].staff_id]
      );
    }

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
    const result = await pool.query(
      `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, hours_allocated)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (staff_id, leave_type_id, year)
       DO UPDATE SET days_allocated = EXCLUDED.days_allocated,
                     hours_allocated = EXCLUDED.hours_allocated
       RETURNING *`,
      [staffId, leave_type_id, year || new Date().getFullYear(), days_allocated || 0, hours_allocated || 0]
    );
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
    const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).toISOString().split('T')[0];

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
    const start = new Date(firstDay);
    const end = new Date(lastDay);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayReqs = approved.rows.filter((r: any) => {
        const startStr = typeof r.start_date === 'string' ? r.start_date : r.start_date.toISOString().split('T')[0];
        const endStr = typeof r.end_date === 'string' ? r.end_date : r.end_date.toISOString().split('T')[0];
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
    res.json(dates);
  }
}
