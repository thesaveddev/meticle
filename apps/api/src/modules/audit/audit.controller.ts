import { Request, Response } from 'express';
import { AuditRepository } from './audit.repository';

export class AuditController {
  static async getLogs(req: Request, res: Response) {
    const logs = await AuditRepository.getLogs(req.query);
    res.json(logs);
  }
}
