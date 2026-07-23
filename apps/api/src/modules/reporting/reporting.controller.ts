import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { generatePdf } from '../../shared/pdf/pdf.service';
import { getReportData, ReportType } from './reporting.service';
import { reportBuilders } from './reporting.pdf';
import { ReportingRepository } from './reporting.repository';

const REPORT_TYPES: ReportType[] = ['staff-compliance', 'training-matrix', 'incident-log', 'leave-overview', 'service-user-roster', 'medication-admin'];

export class ReportingController {
  static async getComplianceAudit(req: Request, res: Response) {
    const data = await ReportingRepository.getComplianceAudit();
    res.json(data);
  }

  static async getStaffingStats(req: Request, res: Response) {
    const stats = await ReportingRepository.getStaffingStats();
    res.json(stats);
  }

  static async exportReport(req: Request, res: Response) {
    const { type } = req.params;
    const format = (req.query.format as string) || 'pdf';
    const orgId = req.user!.organizationId;

    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw new AppError(400, `Unknown report type: ${type}. Valid types: ${REPORT_TYPES.join(', ')}`);
    }

    const builder = reportBuilders[type as ReportType];
    const data = await getReportData(type as ReportType, orgId!);

    if (format === 'csv') {
      const csv = builder.csv(data);
      const filename = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
      return;
    }

    const html = builder.html(data, req.user!.email);
    const pdf = await generatePdf(html, {
      headerTemplate: `<div style="font-size:9px;color:#9CA3AF;width:100%;text-align:center;padding:5px 15mm">CareDesk Report — ${type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>`,
    });
    const filename = `${type}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }
}
