import { Request, Response } from 'express';
import { ReportingRepository } from './reporting.repository';

export class ReportingController {
  static async getComplianceAudit(req: Request, res: Response) {
    const data = await ReportingRepository.getComplianceAudit();
    res.json(data);
  }

  static async getStaffingStats(req: Request, res: Response) {
    const stats = await ReportingRepository.getStaffingStats();
    res.json(stats);
  }
}
