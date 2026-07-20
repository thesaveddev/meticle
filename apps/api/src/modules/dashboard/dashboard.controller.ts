import { Request, Response } from 'express';
import { DashboardRepository } from './dashboard.repository';
import { AppError } from '../../shared/middleware/error.middleware';

export class DashboardController {
  static async getStats(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization required');
    const stats = await DashboardRepository.getStats(orgId);
    res.json(stats);
  }

  static async getComplianceSnapshot(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization required');
    const data = await DashboardRepository.getComplianceSnapshot(orgId);
    res.json(data);
  }

  static async getTodayRota(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId) throw new AppError(403, 'Organization required');
    const rota = await DashboardRepository.getTodayRota(orgId, userId);
    res.json(rota);
  }

  static async getWidgets(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    if (!orgId || !userId) throw new AppError(403, 'Organization and user required');
    const data = await DashboardRepository.getWidgets(orgId, userId);
    res.json(data);
  }

  static async getReviewScheduler(req: Request, res: Response) {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    const items = await DashboardRepository.getReviewScheduler(orgId);
    res.json(items);
  }
}
