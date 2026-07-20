import { Request, Response } from 'express';
import pool from '../../shared/database';
import { SchedulingRepository } from './scheduling.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { requireLocationInOrg, requireShiftInOrg, requireSameOrgForStaff } from '../../shared/database/tenant';
import { logDelegationAction } from '../delegations/delegation.audit';

/** Check that a shift is not in the past. Throws if its end_time has passed. */
async function requireShiftNotPast(shiftId: string) {
  const shift = await SchedulingRepository.getShiftById(shiftId);
  if (!shift) throw new AppError(404, 'Shift not found');
  if (new Date(shift.end_time) < new Date()) {
    throw new AppError(400, 'Cannot modify a shift that has already ended');
  }
}

export class SchedulingController {
  static async createShift(req: Request, res: Response) {
    const user = req.user!;
    if (req.body.location_id) {
      await requireLocationInOrg(user, req.body.location_id);
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, req.body.location_id);
    }
    if (req.body.assigned_staff_ids?.length) {
      for (const sid of req.body.assigned_staff_ids) {
        await requireSameOrgForStaff(user, sid);
      }
    }
    const shift = await SchedulingRepository.createShift(req.body);
    logDelegationAction(user.userId, 'CREATE_SHIFT', 'shift', shift?.id, `Created shift`);
    res.status(201).json(shift);
  }

  static async getShifts(req: Request, res: Response) {
    const user = req.user!;
    const { startDate, endDate, location_id } = req.query;
    const effectiveLocationId = location_id as string | undefined;
    let managedIds: string[] | undefined;

    // If MANAGER, scope to their managed locations (unless they explicitly chose a non-managed location)
    if (user.role === 'MANAGER') {
      managedIds = await SchedulingRepository.getManagedLocationIds(user.userId, user.role, user.organizationId!);
      if (effectiveLocationId && !managedIds.includes(effectiveLocationId)) {
        // Viewing a non-managed location — scope to that single loc but read-only
        // Still filter to show it
      } else if (!effectiveLocationId) {
        // Default: show only managed locations
        // We'll pass managedIds to the query
      }
    }

    const shifts = await SchedulingRepository.getShifts({
      start_date: startDate,
      end_date: endDate,
      location_id: effectiveLocationId,
      organization_id: user.organizationId,
      managed_location_ids: managedIds,
    });
    // Batch fetch assignments — single query instead of N per shift
    const ids = shifts.map((s: any) => s.id);
    const byShift = await SchedulingRepository.getAssignmentsBatch(ids);
    res.json(shifts.map((s: any) => ({ ...s, assignments: byShift[s.id] || [] })));
  }

  static async getShift(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireShiftInOrg(user, id);
    const shift = await SchedulingRepository.getShiftById(id);
    if (!shift) throw new AppError(404, 'Shift not found');
    const assignments = await SchedulingRepository.getShiftAssignments(id);
    res.json({ ...shift, assignments });
  }

  static async updateShift(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireShiftInOrg(user, id);
    await requireShiftNotPast(id);
    if (req.body.location_id) {
      await requireLocationInOrg(user, req.body.location_id);
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, req.body.location_id);
    } else {
      // Check existing shift's location
      const existing = await SchedulingRepository.getShiftById(id);
      if (existing) {
        await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, existing.location_id);
      }
    }
    const shift = await SchedulingRepository.updateShift(id, req.body);
    if (!shift) throw new AppError(404, 'Shift not found');
    logDelegationAction(user.userId, 'UPDATE_SHIFT', 'shift', id, `Updated shift`);
    res.json(shift);
  }

  static async deleteShift(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    await requireShiftInOrg(user, id);
    await requireShiftNotPast(id);
    const shift = await SchedulingRepository.getShiftById(id);
    if (shift) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shift.location_id);
    }
    await SchedulingRepository.deleteShift(id);
    logDelegationAction(user.userId, 'DELETE_SHIFT', 'shift', id, `Deleted shift`);
    res.json({ message: 'Deleted' });
  }

  static async claimOpenShift(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.userId;
    const orgId = req.user!.organizationId!;
    const userRole = req.user!.role;
    await requireShiftNotPast(id);
    const staffProfile = await SchedulingRepository.getStaffIdByUserId(userId);
    if (!staffProfile) throw new AppError(404, 'Staff profile not found');
    if (!staffProfile.location_id) throw new AppError(403, 'You must have a work location assigned to claim a shift');
    const staffId = staffProfile.id;

    // If claimant is the manager of this location, auto-approve
    const shiftInfo = await SchedulingRepository.getShiftById(id);
    if (shiftInfo) {
      const locRes = await pool.query('SELECT manager_id FROM locations WHERE id = $1', [shiftInfo.location_id]);
      if (locRes.rows[0]?.manager_id === userId && (userRole === 'MANAGER' || userRole === 'ORG_ADMIN')) {
        const assignment = await SchedulingRepository.approveOvertimeClaim(id, staffId);
        res.json({ ...assignment, requires_approval: false, auto_approved: true });
        return;
      }
    }

    const assignment = await SchedulingRepository.claimOpenShift(id, staffId, orgId);

    if (assignment.requires_approval) {
      const locationName = shiftInfo ? (await pool.query('SELECT name FROM locations WHERE id = $1', [shiftInfo.location_id])).rows[0]?.name || 'Unknown' : 'Unknown';
      const date = new Date(shiftInfo.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const time = `${new Date(shiftInfo.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shiftInfo.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

      const staffName = `${staffProfile.first_name || ''} ${staffProfile.last_name || ''}`.trim() || 'A staff member';

      const managerIds = new Set<string>();
      if (shiftInfo) {
        const shiftLocRes = await pool.query(
          `SELECT l.manager_id FROM locations l JOIN shifts s ON s.location_id = l.id WHERE s.id = $1`,
          [id]
        );
        if (shiftLocRes.rows[0]?.manager_id) managerIds.add(shiftLocRes.rows[0].manager_id);
      }
      const staffLocRes = await pool.query(
        'SELECT location_id FROM staff_profiles WHERE id = $1',
        [staffId]
      );
      if (staffLocRes.rows[0]?.location_id) {
        const sLocRes = await pool.query('SELECT manager_id FROM locations WHERE id = $1', [staffLocRes.rows[0].location_id]);
        if (sLocRes.rows[0]?.manager_id) managerIds.add(sLocRes.rows[0].manager_id);
      }
      managerIds.delete(userId);

      const delegateIds = new Set<string>();
      for (const mgrId of managerIds) {
        const delRes = await pool.query(
          `SELECT delegate_manager_id FROM manager_delegations
           WHERE primary_manager_id = $1 AND is_active = true
             AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)`,
          [mgrId]
        );
        for (const d of delRes.rows) delegateIds.add(d.delegate_manager_id);
      }
      for (const id of [...managerIds, ...delegateIds]) {
        await NotificationsController.createNotification(id, 'Overtime Claim', `${staffName} has claimed a shift at ${locationName} on ${date} (${time}) and needs your approval.`, 'warning');
        const mgrEmailRes = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
        if (mgrEmailRes.rows[0]?.email) {
          await EmailService.sendOvertimeClaimedEmail(mgrEmailRes.rows[0].email, staffName, locationName, date, time);
        }
      }
    }

    res.status(201).json(assignment);
  }

  static async getPendingClaims(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId!;
    const managedIds = await SchedulingRepository.getManagedLocationIds(user.userId, user.role, orgId);
    const claims = await SchedulingRepository.getPendingClaims(orgId, managedIds);
    res.json(claims);
  }

  static async getApprovedClaims(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId!;
    const managedIds = await SchedulingRepository.getManagedLocationIds(user.userId, user.role, orgId);
    const claims = await SchedulingRepository.getApprovedOvertimeClaims(orgId, managedIds);
    res.json(claims);
  }

  static async revokeOvertimeClaim(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId, staffId } = req.params;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, staffId);
    await requireShiftNotPast(shiftId);
    const shiftInfo = await SchedulingRepository.getShiftById(shiftId);
    if (shiftInfo) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftInfo.location_id);
    }
    const result = await SchedulingRepository.revokeOvertimeClaim(shiftId, staffId);
    const locRes = await pool.query('SELECT name FROM locations WHERE id = $1', [shiftInfo.location_id]);
    const locationName = locRes.rows[0]?.name || 'Unknown';

    const staffUserRes = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
    if (staffUserRes.rows[0]) {
      const date = new Date(shiftInfo.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      await NotificationsController.createNotification(
        staffUserRes.rows[0].user_id,
        'Overtime Revoked',
        `Your approved overtime at ${locationName} on ${date} has been revoked by management.`,
        'error'
      );
    }
    logDelegationAction(user.userId, 'REVOKE_OVERTIME', 'shift', shiftId, `Revoked approved overtime for staff ${staffId}`);
    res.json(result);
  }

  static async swapOvertimeClaim(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId, staffId } = req.params;
    const { newStaffId } = req.body;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, staffId);
    await requireSameOrgForStaff(user, newStaffId);
    await requireShiftNotPast(shiftId);
    const shiftInfo = await SchedulingRepository.getShiftById(shiftId);
    if (shiftInfo) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftInfo.location_id);
    }
    const result = await SchedulingRepository.swapOvertimeClaim(shiftId, staffId, newStaffId);
    const locRes = await pool.query('SELECT name FROM locations WHERE id = $1', [shiftInfo.location_id]);
    const locationName = locRes.rows[0]?.name || 'Unknown';
    const date = new Date(shiftInfo.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    // Notify old staff
    const oldStaffUser = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
    if (oldStaffUser.rows[0]) {
      await NotificationsController.createNotification(oldStaffUser.rows[0].user_id, 'Overtime Swapped', `Your approved overtime at ${locationName} on ${date} has been reassigned to another staff member.`, 'info');
    }

    // Notify new staff
    const newStaffUser = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [newStaffId]);
    if (newStaffUser.rows[0]) {
      await NotificationsController.createNotification(newStaffUser.rows[0].user_id, 'Overtime Assigned', `You have been assigned an overtime shift at ${locationName} on ${date}.`, 'success');
    }

    res.json(result);
  }

  static async approveOvertimeClaim(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId, staffId } = req.params;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, staffId);
    await requireShiftNotPast(shiftId);
    const shiftInfo = await SchedulingRepository.getShiftById(shiftId);
    if (shiftInfo) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftInfo.location_id);
    }
    const result = await SchedulingRepository.approveOvertimeClaim(shiftId, staffId);
    const locRes = await pool.query('SELECT name FROM locations WHERE id = $1', [shiftInfo.location_id]);
    const locationName = locRes.rows[0]?.name || 'Unknown';
    const date = new Date(shiftInfo.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = `${new Date(shiftInfo.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shiftInfo.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const staffRes = await pool.query(
      'SELECT sp.first_name, sp.last_name, u.email FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1',
      [staffId]
    );
    const staffName = `${staffRes.rows[0]?.first_name || ''} ${staffRes.rows[0]?.last_name || ''}`.trim() || 'Staff member';
    const staffEmail = staffRes.rows[0]?.email;

    const staffUserRes = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
    if (staffUserRes.rows[0]) {
      await NotificationsController.createNotification(staffUserRes.rows[0].user_id, 'Overtime Approved', `Your overtime claim for ${locationName} on ${date} (${time}) has been approved.`, 'success');
    }
    if (staffEmail) {
      await EmailService.sendOvertimeApprovedEmail(staffEmail, staffName, locationName, date, time);
    }

    logDelegationAction(user.userId, 'APPROVE_OVERTIME', 'shift', shiftId, `Approved overtime claim for staff ${staffId}`);
    res.json(result);
  }

  static async rejectOvertimeClaim(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId, staffId } = req.params;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, staffId);
    await requireShiftNotPast(shiftId);
    const shiftInfo2 = await SchedulingRepository.getShiftById(shiftId);
    if (shiftInfo2) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftInfo2.location_id);
    }
    const result = await SchedulingRepository.rejectOvertimeClaim(shiftId, staffId);
    const locRes = await pool.query('SELECT name FROM locations WHERE id = $1', [shiftInfo2.location_id]);
    const locationName = locRes.rows[0]?.name || 'Unknown';
    const date = new Date(shiftInfo2.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const time = `${new Date(shiftInfo2.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shiftInfo2.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const staffUserRes = await pool.query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
    if (staffUserRes.rows[0]) {
      await NotificationsController.createNotification(staffUserRes.rows[0].user_id, 'Overtime Declined', `Your overtime claim for ${locationName} on ${date} (${time}) has been declined.`, 'error');
    }
    const staffRes = await pool.query(
      'SELECT sp.first_name, sp.last_name, u.email FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1',
      [staffId]
    );
    const staffName = `${staffRes.rows[0]?.first_name || ''} ${staffRes.rows[0]?.last_name || ''}`.trim() || 'Staff member';
    const staffEmail = staffRes.rows[0]?.email;
    if (staffEmail) {
      await EmailService.sendOvertimeRejectedEmail(staffEmail, staffName, locationName, date, time);
    }

    logDelegationAction(user.userId, 'REJECT_OVERTIME', 'shift', shiftId, `Rejected overtime claim for staff ${staffId}`);
    res.json(result);
  }

  static async assignStaff(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { staffId } = req.body;
    await requireShiftInOrg(user, id);
    await requireShiftNotPast(id);
    await requireSameOrgForStaff(user, staffId);
    const staffLocRes = await pool.query('SELECT location_id FROM staff_profiles WHERE id = $1', [staffId]);
    if (!staffLocRes.rows[0]?.location_id) throw new AppError(403, 'Staff must have a work location assigned before they can be assigned to shifts');
    const shiftForLoc = await SchedulingRepository.getShiftById(id);
    if (shiftForLoc) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftForLoc.location_id);
    }
    const assignment = await SchedulingRepository.assignStaff(id, staffId);
    logDelegationAction(user.userId, 'ASSIGN_STAFF', 'shift', id, `Assigned staff ${staffId}`);
    res.status(201).json(assignment);
  }

  static async unassignStaff(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId, staffId } = req.params;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, staffId);
    await requireShiftNotPast(shiftId);
    const shiftForLoc2 = await SchedulingRepository.getShiftById(shiftId);
    if (shiftForLoc2) {
      await SchedulingRepository.requireCanEditLocation(user.userId, user.role, user.organizationId!, shiftForLoc2.location_id);
    }
    const result = await SchedulingRepository.unassignStaff(shiftId, staffId);
    if (!result) throw new AppError(404, 'Assignment not found');
    logDelegationAction(user.userId, 'UNASSIGN_STAFF', 'shift', shiftId, `Unassigned staff ${staffId}`);
    res.json({ message: 'Unassigned' });
  }

  static async getStaffList(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    if (startDate && endDate) {
      const staff = await SchedulingRepository.getAvailableStaff(orgId, startDate, endDate);
      res.json(staff);
    } else {
      const staff = await SchedulingRepository.getStaffList(orgId);
      res.json(staff);
    }
  }

  static async getOpenShifts(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const locationId = req.query.location_id as string | undefined;
    const shifts = await SchedulingRepository.getOpenShifts(orgId, locationId);
    const byShift = await SchedulingRepository.getAssignmentsBatch(shifts.map((s: any) => s.id));
    res.json(shifts.map((s: any) => ({ ...s, assignments: byShift[s.id] || [] })));
  }

  static async getMyClaims(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const profile = await SchedulingRepository.getStaffIdByUserId(req.user!.userId);
    if (!profile) { res.json([]); return; }
    const claims = await SchedulingRepository.getMyClaims(orgId, profile.id);
    res.json(claims);
  }

  static async createTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const template = await SchedulingRepository.createTemplate({ ...req.body, organization_id: orgId });
    res.status(201).json(template);
  }

  static async getTemplates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const templates = await SchedulingRepository.getTemplates(orgId);
    res.json(templates);
  }

  static async getMyShifts(req: Request, res: Response) {
    const userId = req.user!.userId;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      res.json([]);
      return;
    }
    const shifts = await SchedulingRepository.getMyShifts(userId, startDate, endDate);
    res.json(shifts);
  }

  static async getMinStaffCounts(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const counts = await SchedulingRepository.getMinStaffCounts(orgId);
    res.json(counts);
  }

  static async getUnclaimedOpenShifts(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const shifts = await SchedulingRepository.getUnclaimedOpenShifts(orgId);
    res.json(shifts);
  }

  // --- Shift Swaps ---

  static async getStaffShifts(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) { res.json([]); return; }
    const staffProf = await pool.query(
      'SELECT sp.id, sp.location_id, u.organization_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1',
      [staffId]
    );
    if (staffProf.rows.length === 0) throw new AppError(404, 'Staff not found');
    if (staffProf.rows[0].organization_id !== user.organizationId) throw new AppError(403, 'Staff not in your organization');
    const shifts = await SchedulingRepository.getStaffShifts(staffId, startDate, endDate);
    res.json(shifts);
  }

  static async requestSwap(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId } = req.params;
    const { toStaffId, toShiftId, reason } = req.body;
    await requireShiftInOrg(user, shiftId);
    await requireSameOrgForStaff(user, toStaffId);
    await requireShiftNotPast(shiftId);

    const profile = await SchedulingRepository.getStaffIdByUserId(user.userId);
    if (!profile) throw new AppError(404, 'Staff profile not found');

    // Verify from_staff is assigned to this shift
    const assignment = await pool.query(
      'SELECT id FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2',
      [shiftId, profile.id]
    );
    if (assignment.rows.length === 0) throw new AppError(403, 'You are not assigned to this shift');

    const shiftInfo = await SchedulingRepository.getShiftById(shiftId);
    const toProfile = await pool.query('SELECT location_id, user_id, first_name, last_name FROM staff_profiles WHERE id = $1', [toStaffId]);
    // Enforce same location: both must have a location and share the same one
    const fromLoc = profile.location_id;
    const toLoc = toProfile.rows[0]?.location_id;
    if (fromLoc && toLoc && fromLoc !== toLoc) {
      throw new AppError(403, 'Shift swaps are only allowed between staff at the same location');
    }

    // If toShiftId provided, verify to_staff is assigned to that shift
    if (toShiftId) {
      const toAssign = await pool.query(
        'SELECT id FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2',
        [toShiftId, toStaffId]
      );
      if (toAssign.rows.length === 0) throw new AppError(400, 'Target staff is not assigned to the selected shift');
    }

    const swap = await SchedulingRepository.createSwapRequest(profile.id, toStaffId, shiftId, toShiftId, reason);

    const shiftDate = new Date(shiftInfo.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const shiftTime = `${new Date(shiftInfo.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shiftInfo.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    const requesterName = `${profile.first_name} ${profile.last_name}`.trim();

    // In-app notification to target staff
    if (toProfile.rows[0]?.user_id) {
      try {
        await NotificationsController.createNotification(
          toProfile.rows[0].user_id,
          'Shift Swap Request',
          `${requesterName} has requested to swap their shift with you on ${shiftDate} (${shiftTime}).`,
          'info'
        );
      } catch { /* notification is non-critical */ }
    }

    // Email to target staff
    const toStaffEmailRes = await pool.query('SELECT u.email FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1', [toStaffId]);
    if (toStaffEmailRes.rows[0]?.email) {
      try {
        await EmailService.sendSwapRequestedEmail(
          toStaffEmailRes.rows[0].email,
          `${toProfile.rows[0]?.first_name || ''} ${toProfile.rows[0]?.last_name || ''}`.trim(),
          requesterName,
          shiftDate,
          shiftTime
        );
      } catch { /* email non-critical */ }
    }

    // Notify location manager
    if (shiftInfo.location_id) {
      const locRes = await pool.query('SELECT manager_id, name FROM locations WHERE id = $1', [shiftInfo.location_id]);
      if (locRes.rows[0]?.manager_id && locRes.rows[0].manager_id !== user.userId) {
        try {
          await NotificationsController.createNotification(
            locRes.rows[0].manager_id,
            'Shift Swap Requested',
            `${requesterName} has requested a shift swap at ${locRes.rows[0].name} on ${shiftDate} (${shiftTime}).`,
            'info'
          );
        } catch { /* notification is non-critical */ }
      }
    }

    res.status(201).json(swap);
  }

  static async respondToSwap(req: Request, res: Response) {
    const user = req.user!;
    const { swapId } = req.params;
    const { accepted } = req.body;

    // Verify the responding user is the to_staff_id
    const swapCheck = await pool.query(
      `SELECT sw.*, fp.first_name as from_first_name, fp.last_name as from_last_name,
              fp.user_id as from_user_id, uf.email as from_email,
              tp.user_id as to_user_id, tp.first_name as to_first_name, tp.last_name as to_last_name
       FROM shift_swaps sw
       JOIN staff_profiles fp ON sw.from_staff_id = fp.id
       JOIN users uf ON fp.user_id = uf.id
       JOIN staff_profiles tp ON sw.to_staff_id = tp.id
       WHERE sw.id = $1`,
      [swapId]
    );
    if (swapCheck.rows.length === 0) throw new AppError(404, 'Swap request not found');
    if (swapCheck.rows[0].to_user_id !== user.userId) {
      throw new AppError(403, 'You are not the intended recipient of this swap request');
    }

    const result = await SchedulingRepository.respondToSwapRequest(swapId, accepted);

    const shiftInfo = await pool.query(
      `SELECT s.*, l.name as location_name, l.manager_id FROM shifts s LEFT JOIN locations l ON s.location_id = l.id WHERE s.id = $1`,
      [swapCheck.rows[0].shift_id]
    );
    const shiftDate = shiftInfo.rows[0]?.start_time
      ? new Date(shiftInfo.rows[0].start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const shiftTime = shiftInfo.rows[0]?.start_time
      ? `${new Date(shiftInfo.rows[0].start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shiftInfo.rows[0].end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    const locationName = shiftInfo.rows[0]?.location_name || '';
    const accepterName = `${swapCheck.rows[0].to_first_name || ''} ${swapCheck.rows[0].to_last_name || ''}`.trim();
    const requesterName = `${swapCheck.rows[0].from_first_name || ''} ${swapCheck.rows[0].from_last_name || ''}`.trim();

    // If two-way swap, also get target shift details
    let toShiftDate = '', toShiftTime = '', toShiftLocation = '';
    if (swapCheck.rows[0].to_shift_id) {
      const toShiftInfo = await pool.query(
        `SELECT s.*, l.name as location_name FROM shifts s LEFT JOIN locations l ON s.location_id = l.id WHERE s.id = $1`,
        [swapCheck.rows[0].to_shift_id]
      );
      if (toShiftInfo.rows[0]) {
        toShiftDate = new Date(toShiftInfo.rows[0].start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        toShiftTime = `${new Date(toShiftInfo.rows[0].start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${new Date(toShiftInfo.rows[0].end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        toShiftLocation = toShiftInfo.rows[0].location_name || '';
      }
    }

    const swapDetail = toShiftDate
      ? `${requesterName}'s shift: ${shiftDate} (${shiftTime}) at ${locationName}. ${accepterName}'s shift: ${toShiftDate} (${toShiftTime}) at ${toShiftLocation}.`
      : `${shiftDate} (${shiftTime}) at ${locationName}.`;

    // In-app notification to requester
    if (swapCheck.rows[0].from_user_id) {
      try {
        await NotificationsController.createNotification(
          swapCheck.rows[0].from_user_id,
          accepted ? 'Swap Request Accepted' : 'Swap Request Declined',
          accepted
            ? `${accepterName} has accepted your shift swap. ${swapDetail}`
            : `${accepterName} has declined your shift swap for ${shiftDate} (${shiftTime}).`,
          accepted ? 'success' : 'error'
        );
      } catch { /* notification is non-critical */ }
    }

    // Email to requester
    if (swapCheck.rows[0].from_email) {
      try {
        if (accepted) {
          await EmailService.sendSwapAcceptedEmail(
            swapCheck.rows[0].from_email,
            requesterName,
            accepterName,
            shiftDate,
            shiftTime,
            locationName,
            toShiftDate,
            toShiftTime,
            toShiftLocation
          );
        } else {
          await EmailService.sendSwapDeclinedEmail(
            swapCheck.rows[0].from_email,
            requesterName,
            accepterName,
            shiftDate,
            shiftTime
          );
        }
      } catch { /* email non-critical */ }
    }

    // Notify location manager (fall back to ORG_ADMIN if no manager set)
    let managerId = shiftInfo.rows[0]?.manager_id || null;
    if (!managerId) {
      const orgAdminRes = await pool.query(
        "SELECT id FROM users WHERE organization_id = (SELECT organization_id FROM users WHERE id = $1) AND role = 'ORG_ADMIN' LIMIT 1",
        [user.userId]
      );
      if (orgAdminRes.rows[0]) managerId = orgAdminRes.rows[0].id;
    }
    if (managerId && managerId !== user.userId && managerId !== swapCheck.rows[0].from_user_id) {
      try {
        await NotificationsController.createNotification(
          managerId,
          accepted ? 'Shift Swapped' : 'Swap Declined',
          accepted
            ? `${accepterName} has accepted a shift swap from ${requesterName}. ${swapDetail}`
            : `${accepterName} has declined a shift swap from ${requesterName} at ${locationName} on ${shiftDate} (${shiftTime}).`,
          accepted ? 'info' : 'warning'
        );
      } catch { /* notification is non-critical */ }
      if (accepted) {
        try {
          const managerEmailRes = await pool.query('SELECT email FROM users WHERE id = $1', [managerId]);
          const managerNameRes = await pool.query("SELECT first_name, last_name FROM staff_profiles WHERE user_id = $1", [managerId]);
          const managerName = managerNameRes.rows[0] ? `${managerNameRes.rows[0].first_name} ${managerNameRes.rows[0].last_name}`.trim() : 'Manager';
          if (managerEmailRes.rows[0]?.email) {
            await EmailService.sendSwapAcceptedToManagerEmail(
              managerEmailRes.rows[0].email,
              managerName,
              accepterName,
              requesterName,
              locationName || 'the location',
              shiftDate,
              shiftTime,
              toShiftDate,
              toShiftTime,
              toShiftLocation
            );
          }
        } catch { /* email non-critical */ }
      }
    }

    res.json(result);
  }

  static async getMySwapRequests(req: Request, res: Response) {
    const user = req.user!;
    const profile = await SchedulingRepository.getStaffIdByUserId(user.userId);
    if (!profile) { res.json([]); return; }
    const swaps = await SchedulingRepository.getSwapRequestsForStaff(profile.id);
    res.json(swaps);
  }

  static async getEligibleSwapStaff(req: Request, res: Response) {
    const user = req.user!;
    const { shiftId } = req.params;
    await requireShiftInOrg(user, shiftId);
    const staff = await SchedulingRepository.getEligibleSwapStaff(shiftId, user.organizationId!);
    res.json(staff);
  }

  static async getLastShiftDate(req: Request, res: Response) {
    const user = req.user!;
    const { location_id } = req.query;
    const lastDate = await SchedulingRepository.getLastShiftDate(user.organizationId!, location_id as string | undefined);
    res.json({ lastDate });
  }

  static async sendToAgency(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { agency_id, agency_cost, agency_contact_name, agency_contact_phone } = req.body;
    await requireShiftInOrg(user, id);
    if (!agency_id) throw new AppError(400, 'Agency ID is required');
    const shift = await SchedulingRepository.sendToAgency(id, user.organizationId!, {
      agency_id, agency_cost, agency_contact_name, agency_contact_phone
    });
    if (!shift) throw new AppError(404, 'Shift not found');
    res.json(shift);
  }

  static async updateAgencyCoverage(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { covered } = req.body;
    if (typeof covered !== 'boolean') throw new AppError(400, 'covered must be a boolean');
    await requireShiftInOrg(user, id);
    const shift = await SchedulingRepository.updateAgencyCoverage(id, user.organizationId!, covered);
    if (!shift) throw new AppError(404, 'Shift not found');
    res.json(shift);
  }
}
