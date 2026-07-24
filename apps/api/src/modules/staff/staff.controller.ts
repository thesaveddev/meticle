import { Request, Response } from 'express';
import pool, { transaction } from '../../shared/database';
import { StaffRepository } from './staff.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { EmailService } from '../../shared/utils/email.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { PermissionsController } from '../permissions/permissions.controller';
import { requireSameOrgForStaff, requireDepartmentInOrg } from '../../shared/database/tenant';
import { AuditRepository } from '../audit/audit.repository';
import { UserRole } from '@meticle/shared';
import crypto from 'crypto';
import { logWarn } from '../../shared/utils/logger';

export class StaffController {
  static async createProfile(req: Request, res: Response) {
    const user = req.user!;
    // Verify user belongs to same org
    if (req.body.user_id) {
      const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [req.body.user_id, user.organizationId]);
      if (userCheck.rows.length === 0) throw new AppError(400, 'User not found in your organization');
    }
    const profile = await StaffRepository.createProfile(req.body);
    res.status(201).json(profile);
  }

  static async getProfile(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;
    const profile = await StaffRepository.getProfileByUserId(userId);
    if (!profile) throw new AppError(404, 'Profile not found');
    // Verify user belongs to same org
    const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (userCheck.rows.length === 0) throw new AppError(404, 'Profile not found');
    res.json(profile);
  }

  static async addQualification(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const { name, issueDate, expiryDate } = req.body;
    const result = await StaffRepository.addQualification(staffId, name, issueDate, expiryDate);
    res.status(201).json(result.rows[0]);
  }

  static async savePreferences(req: Request, res: Response) {
    const { userId } = req.user!;
    const result = await StaffRepository.savePreferences(userId, req.body);
    res.json(result.rows[0]);
  }

  static async updateUserRole(req: Request, res: Response) {
    const { userId } = req.params;
    const { role } = req.body;
    const orgId = req.user!.organizationId;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    if (requesterRole !== 'ORG_ADMIN') {
      throw new AppError(403, 'Only organization admins can change roles');
    }

    if (userId === requesterId) {
      throw new AppError(400, 'You cannot change your own role');
    }

    const user = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    const oldRole = user.rows[0].role;
    const result = await transaction(async (client) => {
      const updateResult = await client.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role, status', [role, userId]);
      await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
      return updateResult;
    });

    // Re-seed default permissions for the new role (fire-and-forget)
    PermissionsController.setDefaultPermissions(userId, role).catch(logWarn('setDefaultPermissions'));

    // Auto-assign compliance profile based on new role
    const profile = await pool.query(
      'SELECT cp.id FROM compliance_profiles cp WHERE cp.organization_id = $1 AND cp.role_name = $2 LIMIT 1',
      [orgId, role]
    );
    if (profile.rows.length > 0) {
      const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
      if (staff.rows.length > 0) {
        await pool.query('UPDATE staff_profiles SET compliance_profile_id = $1 WHERE id = $2', [profile.rows[0].id, staff.rows[0].id]);
        const reqs = await pool.query('SELECT requirement_id FROM compliance_profile_requirements WHERE profile_id = $1', [profile.rows[0].id]);
        for (const r of reqs.rows) {
          await pool.query(
            `INSERT INTO compliance_records (staff_id, requirement_id, status) VALUES ($1, $2, 'incomplete') ON CONFLICT (staff_id, requirement_id) DO NOTHING`,
            [staff.rows[0].id, r.requirement_id]
          );
        }
      }
    }

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_USER_ROLE',
      entity_type: 'user',
      entity_id: userId,
      old_data: { role: oldRole },
      new_data: { role },
      ip_address: req.ip,
    }).catch(logWarn('userRoleAuditLog'));

    res.json(result.rows[0]);
  }

  static async updateUserStatus(req: Request, res: Response) {
    const { userId } = req.params;
    const { status } = req.body;
    const orgId = req.user!.organizationId;

    const user = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    const result = await pool.query('UPDATE users SET status = $1 WHERE id = $2 RETURNING id, email, role, status', [status, userId]);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_USER_STATUS',
      entity_type: 'user',
      entity_id: userId,
      old_data: { status: user.rows[0].status },
      new_data: { status },
      ip_address: req.ip,
    }).catch(logWarn('userStatusAuditLog'));

    res.json(result.rows[0]);
  }

  static async deleteUser(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;

    const user = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['deactivated', userId]);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'DELETE_USER',
      entity_type: 'user',
      entity_id: userId,
      old_data: user.rows[0],
      ip_address: req.ip,
    }).catch(logWarn('deleteUserAuditLog'));

    res.json({ message: 'User deactivated' });
  }

  static async selfDeactivate(req: Request, res: Response) {
    const userId = req.user!.userId;
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['deactivated', userId]);

    AuditRepository.log({
      user_id: userId,
      action: 'SELF_DEACTIVATE',
      entity_type: 'user',
      entity_id: userId,
      ip_address: req.ip,
    }).catch(logWarn('selfDeactivateAuditLog'));

    res.json({ message: 'Account deactivated' });
  }

  static async updateStaffProfile(req: Request, res: Response) {
    const { userId } = req.params;
    const { first_name, last_name, birth_date, phone, address, city, country, postal_code, profile_picture_url, location_id, employment_type, contracted_hours_weekly, max_hours_weekly } = req.body;
    const orgId = req.user!.organizationId;
    const requesterId = req.user!.userId;

    // Convert empty date string to null to avoid PostgreSQL errors
    const safeBirthDate = birth_date && birth_date.trim() !== '' ? birth_date : null;

    const user = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');
    if (requesterId !== userId && req.user!.role !== UserRole.ORG_ADMIN) {
      throw new AppError(403, 'You can only update your own profile');
    }

    const result = await pool.query(
       `INSERT INTO staff_profiles (user_id, first_name, last_name, birth_date, phone, address, city, country, postal_code, profile_picture_url, location_id, employment_type, contracted_hours_weekly, max_hours_weekly)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (user_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          birth_date = EXCLUDED.birth_date,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          country = EXCLUDED.country,
          postal_code = EXCLUDED.postal_code,
          profile_picture_url = EXCLUDED.profile_picture_url,
          location_id = EXCLUDED.location_id,
          employment_type = EXCLUDED.employment_type,
          contracted_hours_weekly = EXCLUDED.contracted_hours_weekly,
          max_hours_weekly = EXCLUDED.max_hours_weekly
        RETURNING *`,
       [userId, first_name, last_name, safeBirthDate, phone, address, city, country, postal_code, profile_picture_url, location_id || null, employment_type || null, contracted_hours_weekly || null, max_hours_weekly || null]
    );

    // Notify the user if profile was changed by an admin/manager
    if (requesterId !== userId) {
      const requesterResult = await pool.query('SELECT role FROM users WHERE id = $1', [requesterId]);
      const requesterRole = requesterResult.rows[0]?.role;
      if (requesterRole === 'ORG_ADMIN' || requesterRole === 'MANAGER') {
        NotificationsController.createNotification(
          userId,
          'Profile Updated',
          'Your profile has been updated by an administrator.',
          'info'
        ).catch(logWarn('profileUpdatedNotification'));
      }
    }

    res.json(result.rows[0]);
  }

  static async forcePasswordReset(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    if (requesterRole !== 'ORG_ADMIN') {
      throw new AppError(403, 'Only admins can trigger password resets');
    }

    // Cannot reset own password
    if (userId === requesterId) {
      throw new AppError(400, 'Cannot trigger password reset on your own account');
    }

    const user = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    const target = user.rows[0];

    // Generate reset token (1 hour expiry)
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO verification_tokens (user_id, token, type, expires_at) VALUES ($1, $2, $3, $4)',
      [target.id, token, 'password_reset', new Date(Date.now() + 60 * 60 * 1000)]
    );

    // Set force_password_reset flag
    await pool.query('UPDATE users SET force_password_reset = TRUE WHERE id = $1', [target.id]);

    await EmailService.sendPasswordResetEmail(target.email, token);

    AuditRepository.log({
      user_id: requesterId,
      action: 'FORCE_PASSWORD_RESET',
      entity_type: 'user',
      entity_id: userId,
      ip_address: req.ip,
    }).catch(logWarn('forcePasswordResetAuditLog'));

    res.json({ message: 'Password reset email sent to user.' });
  }

  static async getStaffCompliance(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;

    // Verify user belongs to org
    const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (userCheck.rows.length === 0) throw new AppError(404, 'User not found');

    // Get staff profile id for this user
    const spResult = await pool.query(
      'SELECT id FROM staff_profiles WHERE user_id = $1',
      [userId]
    );
    if (spResult.rows.length === 0) throw new AppError(404, 'Staff profile not found');

    const staffId = spResult.rows[0].id;

    // Get all compliance requirements for this org
    const reqsResult = await pool.query(
      'SELECT id, name, description FROM compliance_config WHERE organization_id = $1',
      [orgId]
    );

    // Get compliance records for this staff member
    const recordsResult = await pool.query(
      'SELECT cr.id, cr.requirement_id, cr.status, cr.last_checked_at, cr.notes FROM compliance_records cr WHERE cr.staff_id = $1',
      [staffId]
    );

    const recordsMap = new Map(recordsResult.rows.map(r => [r.requirement_id, r]));

    const requirements = reqsResult.rows.map(req => {
      const record = recordsMap.get(req.id);
      return {
        id: record?.id || req.id,
        requirement_id: req.id,
        name: req.name,
        description: req.description,
        status: record?.status || 'incomplete',
        last_checked_at: record?.last_checked_at || null,
        notes: record?.notes || '',
      };
    });

    const total = requirements.length;
    const complete = requirements.filter(r => r.status === 'complete').length;

    res.json({
      compliance_rate: total > 0 ? Math.round((complete / total) * 100) : 0,
      total_requirements: total,
      completed: complete,
      requirements,
    });
  }

  static async updateDepartment(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    const { department_id } = req.body;
    // Verify staff belongs to org
    await requireSameOrgForStaff(user, staffId);
    // Verify department belongs to org
    if (department_id) {
      await requireDepartmentInOrg(user, department_id);
    }
    const result = await StaffRepository.updateDepartment(staffId, department_id || null);
    // Notify staff of department assignment
    const staff = await pool.query(
      'SELECT u.id, sp.first_name, sp.last_name FROM staff_profiles sp JOIN users u ON u.id = sp.user_id WHERE sp.id = $1',
      [staffId]
    );
    const userId = staff.rows[0]?.id;
    if (userId) {
      if (department_id) {
        const deptRes = await pool.query('SELECT name FROM departments WHERE id = $1', [department_id]);
        const deptName = deptRes.rows[0]?.name || 'a department';
        NotificationsController.createNotification(
          userId,
          'Department Assigned',
          `You have been assigned to ${deptName}.`,
          'info'
        ).catch(logWarn('departmentAssignmentNotification'));
      } else {
        NotificationsController.createNotification(
          userId,
          'Department Removed',
          'You have been removed from your department.',
          'info'
        ).catch(logWarn('departmentRemovalNotification'));
      }
    }

    AuditRepository.log({
      user_id: req.user!.userId,
      action: department_id ? 'ASSIGN_DEPARTMENT' : 'REMOVE_DEPARTMENT',
      entity_type: 'staff_profile',
      entity_id: staffId,
      new_data: { department_id: department_id || null },
      ip_address: req.ip,
    }).catch(logWarn('departmentAuditLog'));
    res.json(result.rows[0]);
  }

  static async getStaffByDepartment(req: Request, res: Response) {
    const user = req.user!;
    const { departmentId } = req.params;
    await requireDepartmentInOrg(user, departmentId);
    const staff = await StaffRepository.getStaffByDepartment(departmentId);
    res.json(staff);
  }

  static async addSkill(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    const { name } = req.body;
    await requireSameOrgForStaff(user, staffId);
    const result = await StaffRepository.addSkill(staffId, name);
    res.status(201).json(result.rows[0]);
  }

  static async getSkills(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const skills = await StaffRepository.getSkills(staffId);
    res.json(skills);
  }

  static async deleteSkill(req: Request, res: Response) {
    const user = req.user!;
    const { skillId } = req.params;
    // Verify skill's staff belongs to org
    const skillRows = await pool.query(
      'SELECT sp.id FROM skills s JOIN staff_profiles sp ON s.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE s.id = $1 AND u.organization_id = $2',
      [skillId, user.organizationId]
    );
    if (skillRows.rows.length === 0) throw new AppError(404, 'Skill not found');
    await StaffRepository.deleteSkill(skillId);
    res.json({ message: 'Skill deleted' });
  }

  static async addEmergencyContact(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const { name, relationship, phone } = req.body;
    const result = await StaffRepository.addEmergencyContact(staffId, name, relationship, phone);
    res.status(201).json(result.rows[0]);
  }

  static async getEmergencyContacts(req: Request, res: Response) {
    const user = req.user!;
    const { staffId } = req.params;
    await requireSameOrgForStaff(user, staffId);
    const contacts = await StaffRepository.getEmergencyContacts(staffId);
    res.json(contacts);
  }

  static async deleteEmergencyContact(req: Request, res: Response) {
    const user = req.user!;
    const { contactId } = req.params;
    // Verify contact's staff belongs to org
    const contactRows = await pool.query(
      'SELECT sp.id FROM staff_emergency_contacts c JOIN staff_profiles sp ON c.staff_id = sp.id JOIN users u ON sp.user_id = u.id WHERE c.id = $1 AND u.organization_id = $2',
      [contactId, user.organizationId]
    );
    if (contactRows.rows.length === 0) throw new AppError(404, 'Emergency contact not found');
    await StaffRepository.deleteEmergencyContact(contactId);
    res.json({ message: 'Emergency contact deleted' });
  }

  static async getOrgMembers(req: Request, res: Response) {
    const organizationId = req.user!.organizationId;

    if (!organizationId) {
      throw new AppError(403, 'User does not belong to an organization');
    }

    const [adminResult, staffResult, invitationsResult] = await Promise.all([
      pool.query(
       `SELECT u.id, u.email, u.role, u.status, sp.first_name, sp.last_name, sp.id as staff_id, sp.medication_competent, sp.employment_type,
           COALESCE(c.compliance_rate, 0)::int as compliance_rate
          FROM users u
          LEFT JOIN staff_profiles sp ON sp.user_id = u.id
          LEFT JOIN (
            SELECT cr.staff_id,
              ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0) as compliance_rate
            FROM compliance_records cr
            GROUP BY cr.staff_id
          ) c ON c.staff_id = sp.id
          WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN'`,
        [organizationId]
      ),
      pool.query(
       `SELECT u.id, u.email, u.role, sp.first_name, sp.last_name, u.status, sp.id as staff_id, sp.medication_competent, sp.employment_type,
           COALESCE(c.compliance_rate, 0)::int as compliance_rate
          FROM users u
          LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         LEFT JOIN (
           SELECT cr.staff_id,
             ROUND(COUNT(*) FILTER (WHERE cr.status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0) as compliance_rate
           FROM compliance_records cr
           GROUP BY cr.staff_id
         ) c ON c.staff_id = sp.id
         WHERE u.organization_id = $1 AND u.role != 'ORG_ADMIN'
         ORDER BY sp.first_name, sp.last_name`,
        [organizationId]
      ),
      pool.query(
        `SELECT id, email, role, status, created_at
         FROM invitations
         WHERE organization_id = $1 AND status = 'pending'
         ORDER BY created_at DESC`,
        [organizationId]
      ),
    ]);

    res.json({
      admin: adminResult.rows[0] || null,
      staff: staffResult.rows,
      invitations: invitationsResult.rows,
    });
  }
}
