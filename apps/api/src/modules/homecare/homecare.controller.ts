import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
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
    res.status(201).json(result);
  }

  static async updateVisit(req: Request, res: Response) {
    const result = await repo.updateVisit(orgId(req), req.params.id, req.body);
    audit(req, 'update', 'homecare_visit', req.params.id, req.body);
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

  static async listTimesheets(req: Request, res: Response) {
    res.json(await repo.listTimesheets(orgId(req), req.query.status as string | undefined));
  }

  static async updateTimesheet(req: Request, res: Response) {
    const result = await repo.updateTimesheet(orgId(req), req.params.id, userId(req), req.body);
    audit(req, req.body.status === 'approved' ? 'approve' : 'update', 'homecare_timesheet', req.params.id, req.body);
    res.json(result);
  }

  static async listAvailability(req: Request, res: Response) {
    res.json(await repo.listAvailability(orgId(req), req.query.staffId as string | undefined));
  }

  static async createAvailability(req: Request, res: Response) {
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
    audit(req, 'approve', 'homecare_client_billing_run', req.params.runId);
    res.json(result);
  }
}
