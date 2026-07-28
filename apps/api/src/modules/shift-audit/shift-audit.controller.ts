import { Request, Response } from 'express';
import { ShiftAuditService } from './shift-audit.service';

export class ShiftAuditController {
  static async getDailyAudit(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const audit = await ShiftAuditService.generateDailyAudit(orgId!, date);
    if (!audit) {
      res.json({ date, locations: [], message: 'No shifts found for this date' });
      return;
    }
    res.json(audit);
  }

  static async triggerAuditEmails(req: Request, res: Response) {
    const date = (req.body.date as string) || undefined;
    const emailsSent = await ShiftAuditService.sendDailyAuditEmails(date);
    res.json({ emailsSent, date: date || new Date().toISOString().slice(0, 10) });
  }
}
