import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import pool, { query } from '../../shared/database';
import { AuditRepository } from '../audit/audit.repository';
import { EmailService } from '../../shared/utils/email.service';
import { sendPushToUser } from '../notifications/push.service';
import * as repo from './homecare.repository';

function orgId(req: Request): string {
  const value = req.user?.organizationId;
  if (!value) throw new AppError(403, 'Organization context required');
  return value;
}

function userId(req: Request): string {
  return req.user!.userId;
}

function audit(req: Request, action: string, entityType: string, entityId?: string, newData?: unknown) {
  AuditRepository.log({ user_id: userId(req), action, entity_type: entityType, entity_id: entityId, new_data: newData, ip_address: req.ip }).catch(() => {});
}

export class HomecareController {
  static async listPackages(req: Request, res: Response) {
    res.json(await repo.listPackages(orgId(req)));
  }

  static async createPackage(req: Request, res: Response) {
    const result = await repo.createPackage(orgId(req), userId(req), req.body);
    audit(req, 'create', 'homecare_package', result.id, req.body);
    res.status(201).json(result);
  }

  static async updatePackage(req: Request, res: Response) {
    const result = await repo.updatePackage(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_package', req.params.id, req.body);
    res.json(result);
  }

  static async listVisitPlans(req: Request, res: Response) {
    res.json(await repo.listVisitPlans(orgId(req), req.params.packageId));
  }

  static async listStaff(req: Request, res: Response) {
    res.json(await repo.listStaff(orgId(req)));
  }

  static async getStaffVisits(req: Request, res: Response) {
    const oid = orgId(req);
    const { staffId } = req.params;
    const from = req.query.from as string || new Date().toISOString();
    const to = req.query.to as string || new Date(Date.now() + 7 * 86400000).toISOString();
    const result = await query(
      `SELECT v.*, pe.first_name || ' ' || pe.last_name AS person_name, l.address AS person_address, p.name AS package_name
       FROM homecare_visits v
       JOIN people pe ON pe.id = v.person_id
       JOIN homecare_packages p ON p.id = v.package_id AND p.organization_id = v.organization_id
       LEFT JOIN locations l ON l.id = pe.location_id
       WHERE v.organization_id = $1 AND v.assigned_staff_id = $2 AND v.scheduled_start >= $3 AND v.scheduled_start <= $4 AND v.status IN ('scheduled', 'en_route')
       ORDER BY v.scheduled_start`,
      [oid, staffId, from, to]
    );
    res.json(result.rows);
  }

  static async createVisitPlan(req: Request, res: Response) {
    const result = await repo.createVisitPlan(orgId(req), { ...req.body, package_id: req.params.packageId });
    audit(req, 'create', 'homecare_visit_plan', result.id, req.body);
    res.status(201).json(result);
  }

  static async generateVisits(req: Request, res: Response) {
    const result = await repo.generateVisitsFromPlan(orgId(req), userId(req), req.params.planId, req.body.from, req.body.to);
    audit(req, 'generate', 'homecare_visit_plan', req.params.planId, { from: req.body.from, to: req.body.to, generated_count: result.generated_count });
    res.status(201).json(result);
  }

  static async listVisits(req: Request, res: Response) {
    res.json(await repo.listVisits(orgId(req), {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      staffId: req.query.staffId as string | undefined,
      status: req.query.status as string | undefined,
    }));
  }

  static async createVisit(req: Request, res: Response) {
    const result = await repo.createVisit(orgId(req), userId(req), req.body);
    audit(req, 'create', 'homecare_visit', result.id, req.body);

    // Notify assigned carer
    if (result.assigned_staff_id) {
      HomecareController.notifyCarerAssigned(orgId(req), result, result.assigned_staff_id).catch(() => {});
    }

    res.status(201).json(result);
  }

  static async updateVisit(req: Request, res: Response) {
    const result = await repo.updateVisit(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_visit', req.params.id, req.body);

    // Notify carer when reassigned
    if (req.body.assigned_staff_id) {
      HomecareController.notifyCarerAssigned(orgId(req), result, req.body.assigned_staff_id).catch(() => {});
    }

    // Send notifications for missed calls
    if (req.body.status === 'missed') {
      HomecareController.notifyMissedCall(orgId(req), result).catch(() => {});
    }
    // Send notification for completed calls
    if (req.body.status === 'completed') {
      HomecareController.notifyCallCompleted(orgId(req), result).catch(() => {});
    }

    res.json(result);
  }

  static async listExceptions(req: Request, res: Response) {
    res.json(await repo.listOpenExceptions(orgId(req)));
  }

  static async resolveException(req: Request, res: Response) {
    const result = await repo.resolveVisitException(orgId(req), req.params.id, userId(req), req.body);
    audit(req, 'resolve', 'homecare_visit_exception', req.params.id, req.body);
    res.json(result);
  }

  static async myVisits(req: Request, res: Response) {
    const staff = await import('../../shared/database').then(({ query }) => query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId(req)]));
    res.json(await repo.listVisits(orgId(req), {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      staffId: staff.rows[0]?.id || '__none__',
      status: req.query.status as string | undefined,
    }));
  }

  static async checkIn(req: Request, res: Response) {
    const result = await repo.checkIn(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'check_in', 'homecare_visit', req.params.id, { latitude: req.body.latitude, longitude: req.body.longitude, accuracy_meters: req.body.accuracy_meters });
    res.json(result);
  }

  static async checkOut(req: Request, res: Response) {
    const result = await repo.checkOut(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'check_out', 'homecare_visit', req.params.id, { actual_travel_minutes: req.body.actual_travel_minutes, actual_mileage_miles: req.body.actual_mileage_miles });
    res.json(result);
  }

  static async listCarePlans(req: Request, res: Response) {
    const personId = req.query.personId as string;
    if (!personId) throw new AppError(400, 'personId query parameter is required');
    res.json(await repo.listCarePlans(orgId(req), personId));
  }

  static async listTimesheets(req: Request, res: Response) {
    res.json(await repo.listTimesheets(orgId(req), req.query.status as string | undefined));
  }

  static async getMonthlyCarerTotals(req: Request, res: Response) {
    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to date parameters are required');
    res.json(await repo.getMonthlyCarerTotals(orgId(req), from, to));
  }

  static async updateTimesheet(req: Request, res: Response) {
    const result = await repo.updateTimesheet(orgId(req), req.params.id, userId(req), req.body);
    audit(req, req.body.status === 'approved' ? 'approve' : 'update', 'homecare_timesheet', req.params.id, req.body);
    res.json(result);
  }

  static async getMyAvailability(req: Request, res: Response) {
    const userId = req.user!.userId;
    const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
    if (!staff.rows[0]) throw new AppError(404, 'Staff profile not found');
    res.json(await repo.listAvailability(orgId(req), staff.rows[0].id));
  }

  static async listAvailability(req: Request, res: Response) {
    res.json(await repo.listAvailability(orgId(req), req.query.staffId as string | undefined));
  }

  static async createAvailability(req: Request, res: Response) {
    // Carers can only set their own availability
    const userRole = req.user!.role;
    if (userRole === 'CARE_WORKER') {
      const staff = await pool.query('SELECT id FROM staff_profiles WHERE user_id = $1', [req.user!.userId]);
      if (!staff.rows[0]) throw new AppError(404, 'Staff profile not found');
      req.body.staff_id = staff.rows[0].id;
    }
    const result = await repo.upsertAvailability(orgId(req), req.body);
    audit(req, 'create', 'homecare_availability', result.id, req.body);
    res.status(201).json(result);
  }

  static async deleteAvailability(req: Request, res: Response) {
    const result = await repo.deleteAvailability(orgId(req), req.params.id);
    audit(req, 'delete', 'homecare_availability', req.params.id);
    res.json(result);
  }

  static async createDisruption(req: Request, res: Response) {
    const result = await repo.createDisruption(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'create', 'homecare_visit_disruption', result.id, req.body);
    res.status(201).json(result);
  }

  static async listDisruptions(req: Request, res: Response) {
    res.json(await repo.listDisruptions(orgId(req), req.query.openOnly === 'true'));
  }

  static async resolveDisruption(req: Request, res: Response) {
    const result = await repo.resolveDisruption(orgId(req), userId(req), req.params.id);
    audit(req, 'resolve', 'homecare_visit_disruption', req.params.id);
    res.json(result);
  }

  static async listMileagePolicies(req: Request, res: Response) {
    res.json(await repo.listMileagePolicies(orgId(req)));
  }

  static async createMileagePolicy(req: Request, res: Response) {
    const result = await repo.createMileagePolicy(orgId(req), userId(req), req.body);
    audit(req, 'upsert', 'homecare_mileage_policy', result.id, req.body);
    res.status(201).json(result);
  }

  static async updateMileagePolicy(req: Request, res: Response) {
    const result = await repo.updateMileagePolicy(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_mileage_policy', req.params.id, req.body);
    res.json(result);
  }

  static async deleteMileagePolicy(req: Request, res: Response) {
    await repo.deleteMileagePolicy(orgId(req), req.params.id);
    audit(req, 'delete', 'homecare_mileage_policy', req.params.id);
    res.json({ deleted: true });
  }

  static async createFollowup(req: Request, res: Response) {
    const result = await repo.createFollowup(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'create', 'homecare_visit_followup', result.id, req.body);
    res.status(201).json(result);
  }

  static async listFollowups(req: Request, res: Response) {
    res.json(await repo.listFollowups(orgId(req), req.query.visitId as string | undefined));
  }

  static async offlineAction(req: Request, res: Response) {
    const actionType = req.params.action as 'check-in' | 'check-out';
    const result = await repo.recordOfflineAction(orgId(req), userId(req), req.params.id, req.body, actionType);
    audit(req, 'offline_' + actionType, 'homecare_visit', req.params.id, { action_key: req.body.action_key });
    res.json(result);
  }

  static async listPayrollReconciliations(req: Request, res: Response) {
    res.json(await repo.listPayrollReconciliations(orgId(req), req.query.exportId as string | undefined));
  }

  static async reconcilePayroll(req: Request, res: Response) {
    const result = await repo.reconcilePayroll(orgId(req), userId(req), req.params.id, req.body);
    audit(req, 'reconcile', 'homecare_payroll_reconciliation', req.params.id, req.body);
    res.json(result);
  }

  static async exportPayroll(req: Request, res: Response) {
    const rows = await repo.getApprovedPayrollRows(orgId(req), { from: req.query.from as string, to: req.query.to as string, provider: req.query.provider as any });
    const headers = ['timesheet_id', 'staff_id', 'staff_name', 'client_name', 'visit_label', 'scheduled_start', 'scheduled_end', 'work_minutes', 'travel_minutes', 'paid_travel_minutes', 'mileage_miles', 'mileage_rate_pence', 'hourly_rate_pence', 'gross_pay_pence'];
    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n') + '\n';
    const checksum = require('crypto').createHash('sha256').update(csv).digest('hex');
    await repo.createPayrollExport(orgId(req), userId(req), { from: req.query.from as string, to: req.query.to as string, provider: req.query.provider as any }, rows, checksum);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="homecare-payroll-${req.query.from}-${req.query.to}.csv"`);
    res.send(csv);
  }

  static async listClientBillingRuns(req: Request, res: Response) {
    res.json(await repo.listClientBillingRuns(orgId(req)));
  }

  static async getClientBillingUtilisation(req: Request, res: Response) {
    res.json(await repo.buildClientBillingUtilisation(orgId(req), req.query.from as string, req.query.to as string));
  }

  static async createClientBillingRun(req: Request, res: Response) {
    const result = await repo.createClientBillingRun(orgId(req), userId(req), req.body.from, req.body.to);
    audit(req, 'create', 'homecare_client_billing_run', result.run.id, { from: req.body.from, to: req.body.to, row_count: result.lines.length });
    res.status(201).json(result);
  }

  static async listClientBillingLines(req: Request, res: Response) {
    res.json(await repo.listClientBillingLines(orgId(req), req.params.runId));
  }

  static async approveClientBillingRun(req: Request, res: Response) {
    const result = await repo.approveClientBillingRun(orgId(req), userId(req), req.params.runId);
    audit(req, 'approve', 'homecare_client_billing_run', req.params.runId, { invoice_number: result.invoice_number });
    res.json(result);
  }

  static async voidClientBillingRun(req: Request, res: Response) {
    const result = await repo.voidClientBillingRun(orgId(req), userId(req), req.params.runId, req.body?.void_reason || req.body?.reason || null);
    audit(req, 'void', 'homecare_client_billing_run', req.params.runId, { void_reason: result.void_reason, invoice_number: result.invoice_number });
    res.json(result);
  }

  static async getClientBillingRun(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    res.json(run);
  }

  static async downloadClientInvoicePdf(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    if (run.status !== 'approved') throw new AppError(409, 'Only approved billing runs have statutory invoices');

    const lines = await repo.listClientBillingLines(orgId(req), req.params.runId);
    const { buildClientInvoicePdf } = await import('./client-invoice.pdf' as string);

    const supplier = await repo.getSupplierInfo(orgId(req));
    const customer = await repo.getCustomerInfo(orgId(req), run);

    const pdf = await buildClientInvoicePdf({
      invoice_number: run.invoice_number || `HC-${run.id.slice(0, 8)}`,
      invoice_date: run.approved_at || run.created_at,
      tax_point: run.period_to,
      period_from: run.period_from,
      period_to: run.period_to,
      status: run.status,
      subtotal_pence: run.subtotal_pence,
      vat_rate: run.vat_rate,
      vat_inclusive: run.vat_inclusive,
      vat_amount_pence: run.vat_amount_pence,
      gross_amount_pence: run.gross_amount_pence,
      funding_breakdown: run.funding_breakdown || {},
      voided_at: run.voided_at,
      void_reason: run.void_reason,
      lines,
    }, supplier, customer);

    const filename = `invoice-${(run.invoice_number || run.id).replace(/[^A-Za-z0-9-_]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }

  static async getMtdExport(req: Request, res: Response) {
    const run = await repo.getClientBillingRun(orgId(req), req.params.runId);
    if (!run) throw new AppError(404, 'Billing run not found');
    if (run.status !== 'approved') throw new AppError(409, 'Only approved billing runs have MTD exports');

    const lines = await repo.listClientBillingLines(orgId(req), req.params.runId);
    const { buildMtdDigitalLink } = await import('./client-invoice.pdf' as string);

    const supplier = await repo.getSupplierInfo(orgId(req));
    const customer = await repo.getCustomerInfo(orgId(req), run);

    const mtd = buildMtdDigitalLink({
      invoice_number: run.invoice_number || `HC-${run.id.slice(0, 8)}`,
      invoice_date: run.approved_at || run.created_at,
      tax_point: run.period_to,
      period_from: run.period_from,
      period_to: run.period_to,
      status: run.status,
      subtotal_pence: run.subtotal_pence,
      vat_rate: run.vat_rate,
      vat_inclusive: run.vat_inclusive,
      vat_amount_pence: run.vat_amount_pence,
      gross_amount_pence: run.gross_amount_pence,
      funding_breakdown: run.funding_breakdown || {},
      voided_at: run.voided_at,
      void_reason: run.void_reason,
      lines,
    }, supplier, customer);

    audit(req, 'mtd_export', 'homecare_client_billing_run', req.params.runId, { invoice_number: run.invoice_number });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mtd-${(run.invoice_number || run.id).replace(/[^A-Za-z0-9-_]/g, '')}.json"`);
    res.json(mtd);
  }

  // ── Notification helpers ──
  private static async notifyMissedCall(orgId: string, visit: any) {
    try {
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';

      // Notify managers
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [orgId]
      );
      for (const m of managers.rows) {
        EmailService.sendMissedCallEmail(m.email, m.name, personName, visit.label || visit.visit_type, visit.scheduled_start, visit.late_reason).catch(() => {});
        sendPushToUser(m.id, { type: 'missed_call', title: `Missed call — ${personName}`, body: `${visit.label || visit.visit_type} was marked missed`, url: '/homecare' }, 'homecare').catch(() => {});
      }

      // Also push to the assigned carer
      if (visit.assigned_staff_id) {
        const staffUser = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [visit.assigned_staff_id]);
        if (staffUser.rows.length) {
          sendPushToUser(staffUser.rows[0].user_id, { type: 'missed_call', title: 'Call marked missed', body: `Your ${visit.label || visit.visit_type} call for ${personName} was marked as missed.`, url: '/homecare' }, 'homecare').catch(() => {});
        }
      }
    } catch (e: any) { /* notification failure should not block */ }
  }

  private static async notifyCarerAssigned(orgId: string, visit: any, staffId: string) {
    try {
      const staffResult = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [staffId]);
      if (!staffResult.rows.length) return;
      const userId = staffResult.rows[0].user_id;
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';
      const msg = `You have been assigned the ${visit.label || visit.visit_type} call for ${personName}`;
      sendPushToUser(userId, { type: 'call_assigned', title: 'New call assigned', body: msg, url: '/homecare' }, 'homecare').catch(() => {});
      await query(
        `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
         VALUES ($1, $2, $3, 'assigned', $4)`,
        [orgId, visit.id, staffId, msg]
      );
    } catch (e: any) { /* non-critical */ }
  }

  private static async notifyCallCompleted(orgId: string, visit: any) {
    try {
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [orgId]
      );
      const personResult = await query('SELECT first_name, last_name FROM people WHERE id = $1', [visit.person_id]);
      const personName = personResult.rows[0] ? `${personResult.rows[0].first_name} ${personResult.rows[0].last_name}` : 'Unknown';
      for (const m of managers.rows) {
        EmailService.sendCallCompletedEmail(m.email, m.name, personName, visit.label || visit.visit_type).catch(() => {});
      }
    } catch (e: any) { /* notification failure should not block */ }
  }

  /* ─── Swap / Transfer ─────────────────────────────────────── */

  static async createSwapRequest(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const { visit_id, target_staff_id, target_visit_id, request_type, message } = req.body;
    if (!visit_id || !request_type) throw new AppError(400, 'visit_id and request_type required');

    // Verify visit exists and belongs to this org
    const visitResult = await query('SELECT * FROM homecare_visits WHERE id = $1 AND organization_id = $2', [visit_id, oid]);
    if (!visitResult.rows.length) throw new AppError(404, 'Visit not found');
    const visit = visitResult.rows[0];

    // Get staff profile for current user
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) throw new AppError(404, 'Staff profile not found');
    const staffId = staffResult.rows[0].id;

    // For swap: target must be different staff. For transfer: target is required
    if (request_type === 'swap' && target_staff_id && target_staff_id === staffId) throw new AppError(400, 'Cannot swap with yourself');
    if (request_type === 'transfer' && !target_staff_id) throw new AppError(400, 'Transfer requires a target carer');

    const result = await query(
      `INSERT INTO visit_swap_requests (organization_id, visit_id, requested_by, target_staff_id, target_visit_id, request_type, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [oid, visit_id, uid, target_staff_id || null, target_visit_id || null, request_type, message || null]
    );

    // Notify target carer
    if (target_staff_id) {
      const targetUser = await query('SELECT user_id FROM staff_profiles WHERE id = $1', [target_staff_id]);
      if (targetUser.rows.length) {
        const reqName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
        const msg = `${reqName.rows[0]?.name || 'A carer'} wants to ${request_type} the ${visit.label || visit.visit_type} call`;
        sendPushToUser(targetUser.rows[0].user_id, { type: 'swap_request', title: `${request_type === 'swap' ? 'Swap' : 'Transfer'} request`, body: msg, url: '/homecare' }, 'homecare').catch(() => {});
        await query(
          `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [oid, visit_id, target_staff_id, request_type === 'swap' ? 'swap_offered' : 'reassigned', msg]
        );
      }
    }

    // Notify managers
    try {
      const managers = await query(
        `SELECT u.id FROM users u WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`, [oid]
      );
      for (const m of managers.rows) {
        sendPushToUser(m.id, { type: 'swap_request', title: `Call ${request_type} request`, body: `A ${request_type} request has been submitted for ${visit.label}`, url: '/homecare' }, 'homecare').catch(() => {});
      }
    } catch { /* non-critical */ }

    audit(req, 'SWAP_REQUEST_CREATED', 'visit_swap_request', result.rows[0].id, result.rows[0]);
    res.status(201).json(result.rows[0]);
  }

  static async respondSwapRequest(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const { id } = req.params;
    const { status, response_message } = req.body;
    if (!['accepted', 'rejected'].includes(status)) throw new AppError(400, 'Status must be accepted or rejected');

    const swapResult = await query(
      'SELECT * FROM visit_swap_requests WHERE id = $1 AND organization_id = $2', [id, oid]
    );
    if (!swapResult.rows.length) throw new AppError(404, 'Request not found');
    const swap = swapResult.rows[0];
    if (swap.status !== 'pending') throw new AppError(400, 'Request is no longer pending');

    await query(
      `UPDATE visit_swap_requests SET status = $1, responded_by = $2, responded_at = NOW(), response_message = $3, updated_at = NOW() WHERE id = $4`,
      [status, uid, response_message || null, id]
    );

    if (status === 'accepted' && swap.request_type === 'swap' && swap.target_staff_id) {
      // Swap the assigned staff
      const visit = (await query('SELECT assigned_staff_id FROM homecare_visits WHERE id = $1', [swap.visit_id])).rows[0];
      if (visit) {
        const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
        if (staffResult.rows.length) {
          await query('UPDATE homecare_visits SET assigned_staff_id = $1 WHERE id = $2', [staffResult.rows[0].id, swap.visit_id]);
        }
      }
    } else if (status === 'accepted' && swap.request_type === 'transfer' && swap.target_staff_id) {
      await query('UPDATE homecare_visits SET assigned_staff_id = $1 WHERE id = $2', [swap.target_staff_id, swap.visit_id]);
    }

    // Notify requester
    const reqUser = swap.requested_by;
    const staffName = await query('SELECT COALESCE(sp.first_name, u.email) as name FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id WHERE u.id = $1', [uid]);
    const msg = `${staffName.rows[0]?.name || 'Someone'} ${status}d your ${swap.request_type} request`;
    sendPushToUser(reqUser, { type: 'swap_response', title: `Request ${status}`, body: msg, url: '/homecare' }, 'homecare').catch(() => {});
    await query(
      `INSERT INTO call_assignment_notifications (organization_id, visit_id, staff_id, notification_type, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [oid, swap.visit_id, reqUser, status === 'accepted' ? 'swap_accepted' : 'swap_rejected', msg]
    );

    audit(req, 'SWAP_REQUEST_RESPONDED', 'visit_swap_request', id, { status });
    res.json({ message: `Request ${status}` });
  }

  static async listSwapRequests(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    const staffId = staffResult.rows[0]?.id;

    const result = await query(
      `SELECT sr.*, hv.label as visit_label, hv.visit_type, hv.scheduled_start, hv.scheduled_end,
              p.first_name || ' ' || p.last_name as client_name,
              COALESCE(sp_req.first_name, u_req.email) as requested_by_name,
              COALESCE(sp_tgt.first_name, u_tgt.email) as target_name
       FROM visit_swap_requests sr
       JOIN homecare_visits hv ON hv.id = sr.visit_id
       LEFT JOIN people p ON p.id = hv.person_id
       LEFT JOIN users u_req ON u_req.id = sr.requested_by
       LEFT JOIN staff_profiles sp_req ON sp_req.user_id = u_req.id
       LEFT JOIN staff_profiles sp_tgt ON sp_tgt.id = sr.target_staff_id
       LEFT JOIN users u_tgt ON u_tgt.id = sp_tgt.user_id
       WHERE sr.organization_id = $1
         AND (sr.requested_by = $2 OR sr.target_staff_id = $3)
       ORDER BY sr.created_at DESC LIMIT 50`,
      [oid, uid, staffId]
    );
    res.json(result.rows);
  }

  static async getCarerNotifications(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json([]);
    const staffId = staffResult.rows[0].id;

    const result = await query(
      `SELECT * FROM call_assignment_notifications
       WHERE organization_id = $1 AND staff_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [oid, staffId]
    );
    res.json(result.rows);
  }

  static async markNotificationsRead(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json({ updated: 0 });
    const staffId = staffResult.rows[0].id;

    const result = await query(
      `UPDATE call_assignment_notifications SET read = TRUE
       WHERE organization_id = $1 AND staff_id = $2 AND read = FALSE`,
      [oid, staffId]
    );
    res.json({ updated: result.rowCount });
  }

  static async getWeekVisits(req: Request, res: Response) {
    const oid = orgId(req); const uid = userId(req);
    const staffResult = await query('SELECT id FROM staff_profiles WHERE user_id = $1', [uid]);
    if (!staffResult.rows.length) return res.json([]);
    const staffId = staffResult.rows[0].id;

    const from = req.query.from as string;
    const to = req.query.to as string;
    if (!from || !to) throw new AppError(400, 'from and to query params required');

    const result = await query(
      `SELECT hv.*, p.first_name || ' ' || p.last_name as person_name,
              p.address as person_address, hp.name as package_name,
              sp.first_name || ' ' || sp.last_name as assigned_staff_name
       FROM homecare_visits hv
       LEFT JOIN people p ON p.id = hv.person_id
       LEFT JOIN homecare_packages hp ON hp.id = hv.package_id
       LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
       WHERE hv.organization_id = $1
         AND hv.assigned_staff_id = $2
         AND hv.scheduled_start >= $3 AND hv.scheduled_start <= $4
         AND hv.status NOT IN ('cancelled')
       ORDER BY hv.scheduled_start`,
      [oid, staffId, from, to]
    );
    res.json(result.rows);
  }
}
