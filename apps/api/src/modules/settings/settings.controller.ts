import { Request, Response } from 'express';
import pool, { transaction } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { AuditRepository } from '../audit/audit.repository';
import { upload } from '../../shared/middleware/upload.middleware';
import { logWarn } from '../../shared/utils/logger';

export class SettingsController {
  static async getOrgSettings(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      `SELECT leave_start_month, leave_calculation_type, default_hours_per_leave_day,
                base_leave_hours, base_contracted_hours, minimum_compliance_percent,
                overtime_requires_approval, force_mfa, regulator,
                compliance_digest_enabled, predictive_alerts_enabled,
                auto_evidence_pack_enabled, auto_evidence_pack_frequency,
                daily_shift_audit_enabled, daily_shift_audit_time,
                reorder_alert_enabled, late_med_alert_enabled, late_med_alert_delay_minutes
       FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Organization not found');
    res.json(result.rows[0]);
  }

  static async getMyTeams(req: Request, res: Response) {
    const userId = req.user!.userId;
    const result = await pool.query(
      `SELECT t.* FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE tm.user_id = $1`,
      [userId]
    );
    res.json(result.rows);
  }

  static async updateOrgSettings(req: Request, res: Response) {
    const user = req.user!;
    const orgId = user.organizationId;

    // MANAGERs may only change medication/alert related safety settings
    const managerAllowed = new Set(['daily_shift_audit_enabled', 'daily_shift_audit_time', 'reorder_alert_enabled', 'late_med_alert_enabled', 'late_med_alert_delay_minutes']);
    if (user.role === 'MANAGER') {
      const filtered: any = {};
      for (const k of Object.keys(req.body)) {
        if (managerAllowed.has(k)) filtered[k] = req.body[k];
      }
      if (Object.keys(filtered).length === 0) {
        throw new AppError(403, 'Managers can only update medication and alert related settings');
      }
      req.body = filtered;
    }

    const { leave_start_month, leave_calculation_type, default_hours_per_leave_day, base_leave_hours, base_contracted_hours, minimum_compliance_percent, overtime_requires_approval, force_mfa, regulator, compliance_digest_enabled, predictive_alerts_enabled, auto_evidence_pack_enabled, auto_evidence_pack_frequency, daily_shift_audit_enabled, daily_shift_audit_time, reorder_alert_enabled, late_med_alert_enabled, late_med_alert_delay_minutes } = req.body;
    const result = await pool.query(
      `UPDATE organizations SET
        leave_start_month = COALESCE($1, leave_start_month),
        leave_calculation_type = COALESCE($2, leave_calculation_type),
        default_hours_per_leave_day = COALESCE($3, default_hours_per_leave_day),
        base_leave_hours = COALESCE($4, base_leave_hours),
        base_contracted_hours = COALESCE($5, base_contracted_hours),
        minimum_compliance_percent = COALESCE($6, minimum_compliance_percent),
        overtime_requires_approval = COALESCE($7, overtime_requires_approval),
        force_mfa = COALESCE($8, force_mfa),
        regulator = COALESCE($9, regulator),
        compliance_digest_enabled = COALESCE($10, compliance_digest_enabled),
        predictive_alerts_enabled = COALESCE($11, predictive_alerts_enabled),
        auto_evidence_pack_enabled = COALESCE($12, auto_evidence_pack_enabled),
        auto_evidence_pack_frequency = COALESCE($13, auto_evidence_pack_frequency),
        daily_shift_audit_enabled = COALESCE($14, daily_shift_audit_enabled),
        daily_shift_audit_time = COALESCE($15::TIME, daily_shift_audit_time),
        reorder_alert_enabled = COALESCE($16, reorder_alert_enabled),
        late_med_alert_enabled = COALESCE($17, late_med_alert_enabled),
        late_med_alert_delay_minutes = COALESCE($18, late_med_alert_delay_minutes)
       WHERE id = $19 RETURNING *`,
      [leave_start_month, leave_calculation_type, default_hours_per_leave_day, base_leave_hours, base_contracted_hours, minimum_compliance_percent, overtime_requires_approval, force_mfa, regulator, compliance_digest_enabled, predictive_alerts_enabled, auto_evidence_pack_enabled, auto_evidence_pack_frequency, daily_shift_audit_enabled, daily_shift_audit_time || null, reorder_alert_enabled, late_med_alert_enabled, late_med_alert_delay_minutes, orgId]
    );

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_ORG_SETTINGS',
      entity_type: 'organization',
      entity_id: orgId,
      new_data: req.body,
      ip_address: req.ip,
    }).catch(logWarn('audit update org settings'));

    res.json(result.rows[0]);
  }

  static async getLocations(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      `SELECT l.*, u.email as manager_email,
              sp.first_name as manager_first_name, sp.last_name as manager_last_name
       FROM locations l
       LEFT JOIN users u ON l.manager_id = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE l.organization_id = $1
       ORDER BY l.name`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async createLocation(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { name, address, manager_id } = req.body;
    if (manager_id) {
      const user = await pool.query('SELECT role FROM users WHERE id = $1', [manager_id]);
      if (user.rows.length > 0 && user.rows[0].role !== 'MANAGER' && user.rows[0].role !== 'ORG_ADMIN') {
        throw new AppError(400, 'Location manager must have MANAGER or ORG_ADMIN role');
      }
    }
    const result = await pool.query(
      'INSERT INTO locations (organization_id, name, address, manager_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [orgId, name, address, manager_id || null]
    );
    res.status(201).json(result.rows[0]);
  }

  static async updateLocation(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, address, manager_id, minimum_staff_per_day, min_day_staff, min_night_staff, min_sleep_staff } = req.body;
    // Verify location belongs to org
    const locCheck = await pool.query('SELECT 1 FROM locations WHERE id = $1 AND organization_id = $2', [id, user.organizationId]);
    if (locCheck.rows.length === 0) throw new AppError(404, 'Location not found');
    if (manager_id) {
      const mUser = await pool.query('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [manager_id, user.organizationId]);
      if (mUser.rows.length > 0 && mUser.rows[0].role !== 'MANAGER' && mUser.rows[0].role !== 'ORG_ADMIN') {
        throw new AppError(400, 'Location manager must have MANAGER or ORG_ADMIN role');
      }
    }
    const result = await pool.query(
      `UPDATE locations SET name = COALESCE($1, name), address = COALESCE($2, address),
       manager_id = $3, minimum_staff_per_day = COALESCE($4, minimum_staff_per_day),
       min_day_staff = COALESCE($5, min_day_staff), min_night_staff = COALESCE($6, min_night_staff),
       min_sleep_staff = COALESCE($7, min_sleep_staff) WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [name, address, manager_id || null, minimum_staff_per_day, min_day_staff, min_night_staff, min_sleep_staff, id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Location not found');
    res.json(result.rows[0]);
  }

  static async deleteLocation(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM locations WHERE id = $1 AND organization_id = $2 RETURNING id', [id, user.organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Location not found');
    res.json({ message: 'Deleted' });
  }

  // === Location Certificates ===

  static async getLocationCertificates(req: Request, res: Response) {
    const user = req.user!;
    const { locationId } = req.params;
    const loc = await pool.query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, user.organizationId]);
    if (loc.rows.length === 0) throw new AppError(404, 'Location not found');
    const result = await pool.query(
      'SELECT * FROM location_certificates WHERE location_id = $1 ORDER BY expiry_date NULLS LAST, name',
      [locationId]
    );
    res.json(result.rows);
  }

  static async createLocationCertificate(req: Request, res: Response) {
    const user = req.user!;
    const { locationId } = req.params;
    const loc = await pool.query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, user.organizationId]);
    if (loc.rows.length === 0) throw new AppError(404, 'Location not found');
    const { name, certificate_type, issuing_body, certificate_number, issue_date, expiry_date, status, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO location_certificates (location_id, name, certificate_type, issuing_body, certificate_number, issue_date, expiry_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [locationId, name, certificate_type, issuing_body || null, certificate_number || null, issue_date || null, expiry_date || null, status || 'valid', notes || null]
    );
    res.status(201).json(result.rows[0]);
  }

  static async updateLocationCertificate(req: Request, res: Response) {
    const user = req.user!;
    const { locationId, certificateId } = req.params;
    const loc = await pool.query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, user.organizationId]);
    if (loc.rows.length === 0) throw new AppError(404, 'Location not found');
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const key of ['name', 'certificate_type', 'issuing_body', 'certificate_number', 'issue_date', 'expiry_date', 'status', 'notes']) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }
    if (fields.length === 0) throw new AppError(400, 'No fields to update');
    params.push(certificateId);
    params.push(locationId);
    const result = await pool.query(
      `UPDATE location_certificates SET ${fields.join(', ')} WHERE id = $${idx++} AND location_id = $${idx++} RETURNING *`,
      params
    );
    if (result.rows.length === 0) throw new AppError(404, 'Certificate not found');
    res.json(result.rows[0]);
  }

  static async deleteLocationCertificate(req: Request, res: Response) {
    const user = req.user!;
    const { locationId, certificateId } = req.params;
    const loc = await pool.query('SELECT id FROM locations WHERE id = $1 AND organization_id = $2', [locationId, user.organizationId]);
    if (loc.rows.length === 0) throw new AppError(404, 'Location not found');
    const result = await pool.query(
      'DELETE FROM location_certificates WHERE id = $1 AND location_id = $2 RETURNING id',
      [certificateId, locationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Certificate not found');
    res.json({ message: 'Deleted' });
  }

  static async getStaffList(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, sp.first_name, sp.last_name, sp.employment_type,
              sp.contracted_hours_weekly, sp.location_id,
              l.name as location_name,
              lb.leave_days_allocated, lb.leave_days_taken, lb.leave_hours_allocated, lb.leave_hours_taken
       FROM users u
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       LEFT JOIN locations l ON sp.location_id = l.id
       LEFT JOIN (
         SELECT staff_id,
           SUM(days_allocated) as leave_days_allocated,
           SUM(days_taken) as leave_days_taken,
           SUM(hours_allocated) as leave_hours_allocated,
           SUM(hours_taken) as leave_hours_taken
         FROM leave_balances
         WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
         GROUP BY staff_id
       ) lb ON lb.staff_id = sp.id
       WHERE u.organization_id = $1 AND u.status = 'active'
       ORDER BY sp.first_name, sp.last_name`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async getComplianceConfig(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      'SELECT * FROM compliance_config WHERE organization_id = $1 ORDER BY name',
      [orgId]
    );
    res.json(result.rows);
  }

  static async createComplianceConfig(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { name, description, category, is_mandatory, days_warning, days_overdue } = req.body;
    const result = await pool.query(
      `INSERT INTO compliance_config (organization_id, name, description, category, is_mandatory, days_warning, days_overdue)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, name, description, category || 'document', is_mandatory !== false, days_warning || 30, days_overdue || 0]
    );

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'CREATE_COMPLIANCE_CONFIG',
      entity_type: 'compliance_config',
      new_data: { name, description, category, is_mandatory },
      ip_address: req.ip,
    }).catch(logWarn('audit create compliance config'));

    res.status(201).json(result.rows[0]);
  }

  static async updateComplianceConfig(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, description, category, is_mandatory, days_warning, days_overdue } = req.body;
    const result = await pool.query(
      `UPDATE compliance_config SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        category = COALESCE($3, category), is_mandatory = COALESCE($4, is_mandatory),
        days_warning = COALESCE($5, days_warning), days_overdue = COALESCE($6, days_overdue)
       WHERE id = $7 AND organization_id = $8 RETURNING *`,
      [name, description, category, is_mandatory, days_warning, days_overdue, id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Compliance config not found');
    res.json(result.rows[0]);
  }

  static async deleteComplianceConfig(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM compliance_config WHERE id = $1 AND organization_id = $2 RETURNING id', [id, user.organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Compliance config not found');

    AuditRepository.log({
      user_id: user.userId,
      action: 'DELETE_COMPLIANCE_CONFIG',
      entity_type: 'compliance_config',
      entity_id: id,
      ip_address: req.ip,
    }).catch(logWarn('audit delete compliance config'));

    res.json({ message: 'Deleted' });
  }

  static async getManagerDelegations(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const isManager = req.user!.role === 'MANAGER';
    const result = await pool.query(
      `SELECT md.*,
              pu.email as primary_email, sp1.first_name as primary_first_name, sp1.last_name as primary_last_name,
              du.email as delegate_email, sp2.first_name as delegate_first_name, sp2.last_name as delegate_last_name
       FROM manager_delegations md
       JOIN users pu ON md.primary_manager_id = pu.id
       LEFT JOIN staff_profiles sp1 ON pu.id = sp1.user_id
       JOIN users du ON md.delegate_manager_id = du.id
       LEFT JOIN staff_profiles sp2 ON du.id = sp2.user_id
       WHERE md.organization_id = $1
         AND ($2::boolean = FALSE OR (md.is_active = TRUE AND (md.primary_manager_id = $3 OR md.delegate_manager_id = $3)))
       ORDER BY md.created_at DESC`,
      [orgId, isManager, userId]
    );
    res.json(result.rows);
  }

  static async expireDelegations() {
    try {
      await pool.query(
        `UPDATE manager_delegations SET is_active = FALSE WHERE is_active = TRUE AND ends_at IS NOT NULL AND ends_at < NOW()`
      );
    } catch { /* non-critical */ }
  }

  static async createManagerDelegation(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { primary_manager_id, delegate_manager_id, ends_at, starts_at } = req.body;

    if (!primary_manager_id || !delegate_manager_id) {
      throw new AppError(400, 'Primary manager and delegate manager are required');
    }
    if (primary_manager_id === delegate_manager_id) {
      throw new AppError(400, 'Primary manager and delegate manager must be different');
    }
    if (req.user!.role === 'MANAGER' && primary_manager_id !== req.user!.userId) {
      throw new AppError(403, 'Managers can only create delegations for themselves');
    }
    if (ends_at) {
      const parseDateOnly = (value: string, field: string) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) throw new AppError(400, `${field} must be a valid date`);
        return date;
      };
      const today = new Date();
      const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      const expiryDate = parseDateOnly(ends_at, 'Delegation expiry date');
      if (expiryDate < todayDate) {
        throw new AppError(400, 'Delegation expiry date cannot be in the past');
      }
      if (starts_at && expiryDate < parseDateOnly(starts_at, 'Leave start date')) {
        throw new AppError(400, 'Delegation expiry date cannot be earlier than the leave start date');
      }
    }

    const primary = await pool.query('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [primary_manager_id, orgId]);
    if (primary.rows.length === 0) throw new AppError(404, 'Primary manager not found');
    if (primary.rows[0].role !== 'MANAGER' && primary.rows[0].role !== 'ORG_ADMIN') {
      throw new AppError(400, 'Primary must be a manager or admin');
    }
    const delegate = await pool.query('SELECT role FROM users WHERE id = $1 AND organization_id = $2', [delegate_manager_id, orgId]);
    if (delegate.rows.length === 0) throw new AppError(404, 'Delegate not found');
    if (delegate.rows[0].role !== 'MANAGER' && delegate.rows[0].role !== 'ORG_ADMIN') {
      throw new AppError(400, 'Delegate must be a manager or admin');
    }

    const result = await transaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM manager_delegations
         WHERE organization_id = $1 AND primary_manager_id = $2 AND delegate_manager_id = $3 AND is_active = TRUE`,
        [orgId, primary_manager_id, delegate_manager_id]
      );
      if (existing.rows.length > 0) throw new AppError(409, 'An active delegation already exists between these managers');

      const insertResult = await client.query(
        `INSERT INTO manager_delegations (organization_id, primary_manager_id, delegate_manager_id, ends_at)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [orgId, primary_manager_id, delegate_manager_id, ends_at || null]
      );
      return insertResult;
    });

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'CREATE_DELEGATION',
      entity_type: 'manager_delegation',
      new_data: { primary_manager_id, delegate_manager_id, ends_at },
      ip_address: req.ip,
    }).catch(logWarn('audit create delegation'));

    // Notify the delegate
    const names = await pool.query(
      `SELECT pu.email, p.first_name AS p_first, p.last_name AS p_last,
              du.email AS delegate_email, d.first_name AS d_first, d.last_name AS d_last
       FROM users pu
       LEFT JOIN staff_profiles p ON pu.id = p.user_id
       JOIN users du ON du.id = $2
       LEFT JOIN staff_profiles d ON du.id = d.user_id
       WHERE pu.id = $1`,
      [primary_manager_id, delegate_manager_id]
    );
    if (names.rows[0]) {
      const primaryName = `${names.rows[0].p_first || ''} ${names.rows[0].p_last || ''}`.trim() || 'A manager';
      const delegateName = `${names.rows[0].d_first || ''} ${names.rows[0].d_last || ''}`.trim() || names.rows[0].delegate_email;
      const formattedEndsAt = ends_at ? new Date(ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
      NotificationsController.createNotification(
        delegate_manager_id,
        'Delegation Assigned',
        `${primaryName} has set you as their delegate${formattedEndsAt ? ` until ${formattedEndsAt}` : ''}.`,
        'info'
      ).catch(logWarn('delegation assigned notification'));
      await EmailService.sendDelegationAssignedEmail(names.rows[0].delegate_email, delegateName, primaryName, formattedEndsAt);
    }

    res.status(201).json(result.rows[0]);
  }

  static async updateManagerDelegation(req: Request, res: Response) {
    const { id } = req.params;
    const { primary_manager_id, delegate_manager_id, is_active, ends_at } = req.body;
    if (primary_manager_id && delegate_manager_id) {
      const existing = await pool.query(
        `SELECT id FROM manager_delegations
         WHERE organization_id = $1 AND primary_manager_id = $2 AND delegate_manager_id = $3 AND is_active = TRUE AND id != $4`,
        [req.user!.organizationId, primary_manager_id, delegate_manager_id, id]
      );
      if (existing.rows.length > 0) throw new AppError(409, 'An active delegation already exists between these managers');
    }
    const result = await pool.query(
      `UPDATE manager_delegations SET
        primary_manager_id = COALESCE($1, primary_manager_id),
        delegate_manager_id = COALESCE($2, delegate_manager_id),
        is_active = COALESCE($3, is_active),
        ends_at = COALESCE($4, ends_at)
       WHERE id = $5 RETURNING *`,
      [primary_manager_id, delegate_manager_id, is_active, ends_at, id]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Delegation not found');
    res.json(result.rows[0]);
  }

  static async deleteManagerDelegation(req: Request, res: Response) {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM manager_delegations
       WHERE id = $1
         AND organization_id = $2
         AND ($3::boolean = FALSE OR primary_manager_id = $4)
       RETURNING id`,
      [id, req.user!.organizationId, req.user!.role === 'MANAGER', req.user!.userId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Delegation not found');

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'DELETE_DELEGATION',
      entity_type: 'manager_delegation',
      entity_id: id,
      ip_address: req.ip,
    }).catch(logWarn('audit delete delegation'));

    res.json({ message: 'Deleted' });
  }

  static async calculateStaffEntitlement(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const org = await pool.query(
      `SELECT base_leave_hours, base_contracted_hours FROM organizations WHERE id = $1`,
      [orgId]
    );
    const baseLeaveHours = parseFloat(org.rows[0].base_leave_hours) || 240;
    const baseContractedHours = parseFloat(org.rows[0].base_contracted_hours) || 40;

    const staff = await pool.query(
      `SELECT sp.id as staff_id, sp.user_id, sp.contracted_hours_weekly,
              u.email, sp.first_name, sp.last_name
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`,
      [orgId]
    );

    const leaveTypes = await pool.query(
      'SELECT id, name, days_allowed, hours_allowed, duration_type FROM leave_types WHERE organization_id = $1',
      [orgId]
    );

    const results = [];
    for (const s of staff.rows) {
      const contractedHours = parseFloat(s.contracted_hours_weekly) || 37.5;
      const ratio = contractedHours / baseContractedHours;
      for (const lt of leaveTypes.rows) {
        const allocatedHours = Math.round((lt.hours_allowed || lt.days_allowed * 7.5) * ratio);
        const allocatedDays = lt.duration_type === 'days' ? Math.round((lt.days_allowed || 0) * ratio) : 0;
        await pool.query(
          `INSERT INTO leave_balances (staff_id, leave_type_id, year, days_allocated, hours_allocated)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (staff_id, leave_type_id, year)
           DO UPDATE SET days_allocated = EXCLUDED.days_allocated,
                         hours_allocated = EXCLUDED.hours_allocated`,
          [s.staff_id, lt.id, new Date().getFullYear(), allocatedDays, allocatedHours]
        );
        results.push({ staff: `${s.first_name} ${s.last_name}`, type: lt.name, days: allocatedDays, hours: allocatedHours });
      }
    }
    res.json({ message: 'Entitlements calculated', results });
  }

  static async getComplianceRecords(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const result = await pool.query(
      `SELECT cr.*, sp.first_name, sp.last_name,
              cc.name as requirement_name, cc.category as requirement_category,
              cc.days_warning
       FROM compliance_records cr
       JOIN staff_profiles sp ON cr.staff_id = sp.id
       JOIN compliance_config cc ON cr.requirement_id = cc.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1
       ORDER BY cc.name, sp.first_name`,
      [orgId]
    );
    res.json(result.rows);
  }

  // POST /settings/upload (generic file upload returning URL)
  static async uploadFile(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'No file provided');
    const fileUrl = '/files/private/' + req.file.filename;
    res.json({ url: fileUrl, originalName: req.file.originalname });
  }

  // POST /settings/compliance-records/:id/upload
  static uploadMiddleware = upload.single('file');

  static async uploadComplianceRecordFile(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    if (!req.file) throw new AppError(400, 'No file provided');
    const fileUrl = '/files/private/' + req.file.filename;
    // Verify record belongs to org via staff->user
    const result = await pool.query(
      `UPDATE compliance_records SET file_url = $1, last_checked_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND staff_id IN (
         SELECT sp.id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $3
       ) RETURNING *`,
      [fileUrl, id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Record not found');
    res.json(result.rows[0]);
  }

  static async updateComplianceRecord(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { status, issued_at, expires_at, notes, file_url } = req.body;
    const result = await pool.query(
      `UPDATE compliance_records SET
        status = COALESCE($1, status),
        issued_at = COALESCE($2, issued_at),
        expires_at = COALESCE($3, expires_at),
        notes = COALESCE($4, notes),
        file_url = COALESCE($5, file_url),
        last_checked_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND staff_id IN (
         SELECT sp.id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $7
       ) RETURNING *`,
      [status, issued_at, expires_at, notes, file_url, id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Record not found');
    res.json(result.rows[0]);
  }

  static async deleteComplianceRecord(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM compliance_records WHERE id = $1 AND staff_id IN (
        SELECT sp.id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $2
      ) RETURNING id`,
      [id, user.organizationId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Record not found');
    res.json({ message: 'Deleted' });
  }

  static async seedComplianceRecords(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const staff = await pool.query(
      `SELECT sp.id FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'`,
      [orgId]
    );
    const configs = await pool.query(
      'SELECT id, name FROM compliance_config WHERE organization_id = $1',
      [orgId]
    );
    let created = 0;
    for (const s of staff.rows) {
      for (const c of configs.rows) {
        await pool.query(
          `INSERT INTO compliance_records (staff_id, requirement_id, status)
           VALUES ($1, $2, 'incomplete')
           ON CONFLICT (staff_id, requirement_id) DO NOTHING`,
          [s.id, c.id]
        );
        created++;
      }
    }
    const result = await pool.query(
      `SELECT cr.*, sp.first_name, sp.last_name, cc.name as requirement_name
       FROM compliance_records cr
       JOIN staff_profiles sp ON cr.staff_id = sp.id
       JOIN compliance_config cc ON cr.requirement_id = cc.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1
       ORDER BY cc.name, sp.first_name`,
      [orgId]
    );
    res.json({ message: `Seeded ${created} records`, records: result.rows });
  }

  static async getComplianceProfiles(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const profiles = await pool.query(
      `SELECT cp.* FROM compliance_profiles cp WHERE cp.organization_id = $1 ORDER BY cp.name`,
      [orgId]
    );
    const result = [];
    for (const p of profiles.rows) {
      const reqs = await pool.query(
        `SELECT cc.id, cc.name, cc.category FROM compliance_profile_requirements cpr
         JOIN compliance_config cc ON cpr.requirement_id = cc.id
         WHERE cpr.profile_id = $1`,
        [p.id]
      );
      result.push({ ...p, requirements: reqs.rows });
    }
    res.json(result);
  }

  static async createComplianceProfile(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const { name, description, role_name, requirement_ids } = req.body;
    const profile = await pool.query(
      `INSERT INTO compliance_profiles (organization_id, name, description, role_name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, name, description || '', role_name]
    );
    if (requirement_ids?.length) {
      for (const rid of requirement_ids) {
        await pool.query(
          `INSERT INTO compliance_profile_requirements (profile_id, requirement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [profile.rows[0].id, rid]
        );
      }
    }
    res.status(201).json({ ...profile.rows[0], requirements: requirement_ids || [] });
  }

  static async updateComplianceProfile(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const { name, description, role_name, requirement_ids } = req.body;
    // Verify profile belongs to org
    const profileCheck = await pool.query('SELECT 1 FROM compliance_profiles WHERE id = $1 AND organization_id = $2', [id, user.organizationId]);
    if (profileCheck.rows.length === 0) throw new AppError(404, 'Profile not found');
    await pool.query(
      `UPDATE compliance_profiles SET name = COALESCE($1, name), description = COALESCE($2, description), role_name = COALESCE($3, role_name), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND organization_id = $5`,
      [name, description, role_name, id, user.organizationId]
    );
    if (requirement_ids) {
      await transaction(async (client) => {
        await client.query('DELETE FROM compliance_profile_requirements WHERE profile_id = $1', [id]);
        for (const rid of requirement_ids) {
          await client.query(
            'INSERT INTO compliance_profile_requirements (profile_id, requirement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, rid]
          );
        }
      });
    }
    const reqs = await pool.query(
      `SELECT cc.id, cc.name, cc.category FROM compliance_profile_requirements cpr
       JOIN compliance_config cc ON cpr.requirement_id = cc.id WHERE cpr.profile_id = $1`,
      [id]
    );
    const profile = await pool.query('SELECT * FROM compliance_profiles WHERE id = $1', [id]);
    res.json({ ...profile.rows[0], requirements: reqs.rows });
  }

  static async deleteComplianceProfile(req: Request, res: Response) {
    const user = req.user!;
    const { id } = req.params;
    const result = await pool.query('DELETE FROM compliance_profiles WHERE id = $1 AND organization_id = $2 RETURNING id', [id, user.organizationId]);
    if (result.rows.length === 0) throw new AppError(404, 'Profile not found');
    res.json({ message: 'Deleted' });
  }

  static async assignComplianceProfile(req: Request, res: Response) {
    const user = req.user!;
    const { profileId, staffId } = req.body;
    // Verify profile belongs to org
    const profileCheck = await pool.query('SELECT 1 FROM compliance_profiles WHERE id = $1 AND organization_id = $2', [profileId, user.organizationId]);
    if (profileCheck.rows.length === 0) throw new AppError(404, 'Profile not found');
    // Verify staff belongs to org
    const staffCheck = await pool.query(
      'SELECT 1 FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = $1 AND u.organization_id = $2',
      [staffId, user.organizationId]
    );
    if (staffCheck.rows.length === 0) throw new AppError(404, 'Staff not found');
    await pool.query('UPDATE staff_profiles SET compliance_profile_id = $1 WHERE id = $2', [profileId, staffId]);
    const requirements = await pool.query(
      `SELECT requirement_id FROM compliance_profile_requirements WHERE profile_id = $1`,
      [profileId]
    );
    await transaction(async (client) => {
      await client.query('UPDATE staff_profiles SET compliance_profile_id = $1 WHERE id = $2', [profileId, staffId]);
      for (const r of requirements.rows) {
        await client.query(
          'INSERT INTO compliance_records (staff_id, requirement_id, status) VALUES ($1, $2, $3) ON CONFLICT (staff_id, requirement_id) DO NOTHING',
          [staffId, r.requirement_id, 'incomplete']
        );
      }
    });
    res.json({ message: 'Profile assigned' });
  }

  static async autoAssignProfiles(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const profiles = await pool.query('SELECT id, role_name FROM compliance_profiles WHERE organization_id = $1', [orgId]);
    const staff = await pool.query(
      `SELECT sp.id AS staff_id, u.role FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE u.organization_id = $1 AND u.status = 'active'`,
      [orgId]
    );
    let assigned = 0;
    for (const s of staff.rows) {
      const match = profiles.rows.find((p: any) => p.role_name === s.role);
      if (match) {
        await pool.query('UPDATE staff_profiles SET compliance_profile_id = $1 WHERE id = $2', [match.id, s.staff_id]);
        const reqs = await pool.query('SELECT requirement_id FROM compliance_profile_requirements WHERE profile_id = $1', [match.id]);
        for (const r of reqs.rows) {
          await pool.query(
            `INSERT INTO compliance_records (staff_id, requirement_id, status) VALUES ($1, $2, 'incomplete') ON CONFLICT (staff_id, requirement_id) DO NOTHING`,
            [s.staff_id, r.requirement_id]
          );
        }
        assigned++;
      }
    }
    res.json({ message: `Auto-assigned ${assigned} staff members` });
  }
}
