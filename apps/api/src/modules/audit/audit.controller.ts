import { Request, Response } from 'express';
import { AuditRepository } from './audit.repository';
import logger from '../../shared/utils/logger';

export class AuditController {
  static async getLogs(req: Request, res: Response) {
    try {
      const logs = await AuditRepository.getLogs(req.query);
      res.json(logs);
    } catch (err: any) {
      logger.error(err, 'Failed to fetch audit logs');
      res.json([]);
    }
  }
}
