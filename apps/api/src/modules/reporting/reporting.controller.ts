import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { getReportData } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { REPORT_REGISTRY, CATEGORIES, ReportFilters } from './reporting.types';
import { generateCsv } from './reporting.csv';
import { EmailService } from '../../shared/utils/email.service';
import pool from '../../shared/database';
import { AuditRepository } from '../audit/audit.repository';
import {
  CUSTOM_DATASETS,
  CustomReportConfig,
  buildCustomQuery,
  createReportSchedule,
  createSavedReport,
  customReportConfigSchema,
  deleteReportSchedule,
  deleteSavedReport,
  getSavedReport,
  listReportSchedules,
  listSavedReports,
  listScheduleDeliveries,
  listScheduleRecipients,
  reportScheduleSchema,
  runCustomReport,
  updateReportSchedule,
  updateSavedReport,
} from './reporting.custom';
import { nextOccurrence } from './reporting.delivery';

const DOMICILIARY_REPORTS = new Set([
  'staff-directory', 'staff-by-location', 'staff-compliance', 'staff-documents',
  'su-directory', 'su-by-location', 'su-care-plans', 'satisfaction-surveys',
  'leave-by-type', 'leave-by-month', 'leave-balances', 'incident-summary',
  'incident-trends', 'compliance-overall', 'compliance-by-staff',
  'compliance-expiring', 'training-completion', 'training-overdue',
]);

async function reportsForOrganisation(orgId: string) {
  const result = await pool.query('SELECT service_types FROM organizations WHERE id = $1', [orgId]);
  const types: string[] = result.rows[0]?.service_types || [];
  const isDomiciliary = types.some(type => ['domiciliary', 'live_in'].includes(type));
  return isDomiciliary ? REPORT_REGISTRY.filter(report => DOMICILIARY_REPORTS.has(report.id)) : REPORT_REGISTRY;
}

export class ReportingController {
  static async listReports(req: Request, res: Response) {
    const registry = await reportsForOrganisation(req.user!.organizationId!);
    const reports = registry.map(r => ({
      id: r.id, title: r.title, description: r.description,
      category: r.category, icon: r.icon, color: r.color,
      filters: r.filters, chartTypes: r.chartTypes, defaultChartType: r.defaultChartType,
      groupByOptions: r.groupByOptions,
    }));
    res.json({ reports, categories: CATEGORIES });
  }

  static async getOverview(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json(await ReportingRepository.overview(orgId));
  }

  static async getFilterOptions(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json(await ReportingRepository.filterOptions(orgId));
  }

  static async getReportData(req: Request, res: Response) {
    const { reportId } = req.params;
    const orgId = req.user!.organizationId!;
    const filters = extractFilters(req.query);
    const registry = await reportsForOrganisation(orgId);

    if (!registry.find(r => r.id === reportId)) {
      throw new AppError(400, `Unknown report: ${reportId}`);
    }

    const data = await getReportData(reportId, orgId, filters);
    res.json(data);
  }

  // ─── Custom report builder ─────────────────────────────

  static async listCustomReports(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json({ reports: await listSavedReports(orgId) });
  }

  static async getCustomDatasets(req: Request, res: Response) {
    res.json({
      datasets: CUSTOM_DATASETS.map((d) => ({
        id: d.id,
        label: d.label,
        description: d.description,
        columns: d.columns.map((c) => ({ key: c.key, label: c.label, type: c.type, aggregatable: c.aggregatable })),
      })),
    });
  }

  static async getCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const saved = await getSavedReport(orgId, req.params.id);
    if (!saved) throw new AppError(404, 'Saved report not found.');
    res.json({ report: saved });
  }

  static async createCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const parsed = customReportConfigSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, `Invalid report configuration: ${parsed.error.issues[0]?.message || 'check the fields and try again.'}`);
    // Stored configs are re-validated on every run, but rejecting unknown
    // references at save time keeps the library clean.
    buildCustomQuery(parsed.data);
    const saved = await createSavedReport(orgId, req.user!.userId, parsed.data);
    await AuditRepository.log({
      user_id: req.user!.userId, action: 'create', entity_type: 'custom_report', entity_id: saved.id,
      new_data: { name: saved.name, dataset: saved.dataset }, ip_address: req.ip,
    });
    res.status(201).json({ report: saved });
  }

  static async updateCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const parsed = customReportConfigSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, `Invalid report configuration: ${parsed.error.issues[0]?.message || 'check the fields and try again.'}`);
    buildCustomQuery(parsed.data);
    const saved = await updateSavedReport(orgId, req.params.id, parsed.data);
    await AuditRepository.log({
      user_id: req.user!.userId, action: 'update', entity_type: 'custom_report', entity_id: req.params.id,
      old_data: { name: existing.name }, new_data: { name: parsed.data.name }, ip_address: req.ip,
    });
    res.json({ report: saved });
  }

  // ─── Scheduled email delivery ──────────────────────────

  static async listScheduleRecipients(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    res.json({ recipients: await listScheduleRecipients(orgId) });
  }

  static async listReportSchedules(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    res.json({ schedules: await listReportSchedules(orgId, req.params.id) });
  }

  static async orgTimeZone(orgId: string): Promise<string> {
    const result = await pool.query('SELECT timezone FROM organizations WHERE id = $1', [orgId]);
    return result.rows[0]?.timezone || 'UTC';
  }

  static async createReportSchedule(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const parsed = reportScheduleSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, `Invalid schedule: ${parsed.error.issues[0]?.message || 'check the fields and try again.'}`);
    try {
      const tz = await ReportingController.orgTimeZone(orgId);
      const saved = await createReportSchedule(orgId, req.params.id, req.user!.userId, parsed.data, nextOccurrence(parsed.data, tz));
      await AuditRepository.log({
        user_id: req.user!.userId, action: 'create', entity_type: 'custom_report_schedule', entity_id: saved.id,
        new_data: { report_id: req.params.id, frequency: saved.frequency, send_time: saved.send_time }, ip_address: req.ip,
      });
      res.status(201).json({ schedule: saved });
    } catch (e: any) {
      throw new AppError(400, e.message || 'Could not create this schedule.');
    }
  }

  static async updateReportSchedule(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const parsed = reportScheduleSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, `Invalid schedule: ${parsed.error.issues[0]?.message || 'check the fields and try again.'}`);
    try {
      const tz = await ReportingController.orgTimeZone(orgId);
      const saved = await updateReportSchedule(orgId, req.params.scheduleId, parsed.data, nextOccurrence(parsed.data, tz));
      if (!saved) throw new AppError(404, 'Schedule not found.');
      await AuditRepository.log({
        user_id: req.user!.userId, action: 'update', entity_type: 'custom_report_schedule', entity_id: saved.id,
        new_data: { report_id: req.params.id, frequency: saved.frequency, send_time: saved.send_time }, ip_address: req.ip,
      });
      res.json({ schedule: saved });
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(400, e.message || 'Could not update this schedule.');
    }
  }

  static async listScheduleDeliveries(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const schedules = await listReportSchedules(orgId, req.params.id);
    if (!schedules.some((s) => s.id === req.params.scheduleId)) throw new AppError(404, 'Schedule not found.');
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    if (req.query.limit && (!Number.isFinite(limit) || limit < 1 || limit > 50)) {
      throw new AppError(400, 'Limit must be between 1 and 50.');
    }
    res.json({ deliveries: await listScheduleDeliveries(orgId, req.params.id, req.params.scheduleId, limit || 10) });
  }

  static async deleteReportSchedule(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const deleted = await deleteReportSchedule(orgId, req.params.scheduleId);
    if (!deleted) throw new AppError(404, 'Schedule not found.');
    await AuditRepository.log({
      user_id: req.user!.userId, action: 'delete', entity_type: 'custom_report_schedule', entity_id: req.params.scheduleId,
      old_data: { report_id: req.params.id }, ip_address: req.ip,
    });
    res.json({ deleted: true });
  }

  /** Immediate send of a saved report to the requesting user (a preview of what the schedule delivers). */
  static async sendReportScheduleNow(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    const config = await ReportingController.resolveRunConfig(orgId, { saved_id: req.params.id });
    try {
      const data = await runCustomReport(orgId, config);
      const csv = generateCsv(data);
      const dateLabel = new Date().toISOString().split('T')[0];
      const me = await pool.query(
        `SELECT u.email, COALESCE(NULLIF(TRIM(COALESCE(sp.first_name, '') || ' ' || COALESCE(sp.last_name, '')), ''), u.email) AS name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1 AND u.organization_id = $2 AND u.status = 'active'`,
        [req.user!.userId, orgId],
      );
      if (!me.rows[0]) throw new AppError(400, 'Only active organisation members can receive reports.');
      const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      const orgName = orgResult.rows[0]?.name || 'your organisation';
      await EmailService.sendScheduledReportEmail(
        me.rows[0].email, me.rows[0].name, orgName, existing.name, dateLabel,
        data.table.rows.length, req.params.id, Buffer.from(csv, 'utf8'),
        `${existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateLabel}.csv`,
      );
      await AuditRepository.log({
        user_id: req.user!.userId, action: 'send', entity_type: 'custom_report', entity_id: req.params.id,
        new_data: { to: me.rows[0].email }, ip_address: req.ip,
      });
      res.json({ sent: true, to: me.rows[0].email, rows: data.table.rows.length });
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(400, e.message || 'Could not send this report.');
    }
  }

  static async deleteCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const existing = await getSavedReport(orgId, req.params.id);
    if (!existing) throw new AppError(404, 'Saved report not found.');
    await deleteSavedReport(orgId, req.params.id);
    await AuditRepository.log({
      user_id: req.user!.userId, action: 'delete', entity_type: 'custom_report', entity_id: req.params.id,
      old_data: { name: existing.name }, ip_address: req.ip,
    });
    res.json({ deleted: true });
  }

  /** Resolve a run/export body to an executable config: inline or saved. */
  static async resolveRunConfig(orgId: string, body: any): Promise<CustomReportConfig> {
    if (body?.saved_id) {
      const saved = await getSavedReport(orgId, body.saved_id);
      if (!saved) throw new AppError(404, 'Saved report not found.');
      const parsed = customReportConfigSchema.safeParse({
        name: saved.name,
        description: saved.description,
        dataset: saved.dataset,
        columns: saved.columns,
        filters: saved.filters,
        group_by: saved.group_by,
        aggregations: saved.aggregations,
        sort_by: saved.sort_by,
        sort_dir: saved.sort_dir,
        row_limit: saved.row_limit,
        chart_type: saved.chart_type,
      });
      if (!parsed.success) throw new AppError(400, 'This saved report is no longer valid. Open it in the builder and save it again.');
      return parsed.data;
    }
    const parsed = customReportConfigSchema.safeParse(body?.config || body);
    if (!parsed.success) throw new AppError(400, `Invalid report configuration: ${parsed.error.issues[0]?.message || 'check the fields and try again.'}`);
    return parsed.data;
  }

  static async runCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const config = await ReportingController.resolveRunConfig(orgId, req.body);
    try {
      res.json(await runCustomReport(orgId, config));
    } catch (e: any) {
      throw new AppError(400, e.message || 'Could not run this report.');
    }
  }

  static async exportCustomReport(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const format = (req.body?.format as string) || 'csv';
    if (format !== 'csv') throw new AppError(400, `Unsupported export format: ${format}. Use csv.`);
    const config = await ReportingController.resolveRunConfig(orgId, req.body);
    try {
      const data = await runCustomReport(orgId, config);
      const csv = generateCsv(data);
      const filename = `custom-report-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e: any) {
      throw new AppError(400, e.message || 'Could not export this report.');
    }
  }

  static async exportReport(req: Request, res: Response) {
    const { reportId } = req.params;
    const format = (req.query.format as string) || 'csv';
    const orgId = req.user!.organizationId!;
    const filters = extractFilters(req.query);
    const registry = await reportsForOrganisation(orgId);

    if (!registry.find(r => r.id === reportId)) {
      throw new AppError(400, `Unknown report: ${reportId}`);
    }

    const data = await getReportData(reportId, orgId, filters);

    if (format === 'csv') {
      const csv = generateCsv(data);
      const filename = `${reportId}-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
      return;
    }

    throw new AppError(400, `Unsupported export format: ${format}. Use csv.`);
  }
}

function extractFilters(query: any): ReportFilters {
  const f: ReportFilters = {};
  if (query.dateFrom) f.dateFrom = query.dateFrom;
  if (query.dateTo) f.dateTo = query.dateTo;
  if (query.location_id) f.location_id = query.location_id;
  if (query.department_id) f.department_id = query.department_id;
  if (query.role) f.role = query.role;
  if (query.status) f.status = query.status;
  if (query.severity) f.severity = query.severity;
  if (query.category) f.category = query.category;
  if (query.groupBy) f.groupBy = query.groupBy;
  if (query.interval) f.interval = query.interval;
  return f;
}
