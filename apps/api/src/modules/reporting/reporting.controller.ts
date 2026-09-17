import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { getReportData } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { REPORT_REGISTRY, CATEGORIES, ReportFilters } from './reporting.types';
import { generateCsv } from './reporting.csv';
import pool from '../../shared/database';

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
