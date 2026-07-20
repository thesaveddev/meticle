import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { InsightsRepository } from './insights.repository';

export class InsightsController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async getOverview(req: Request, res: Response) {
    const data = await InsightsRepository.getOverview(InsightsController.getOrgId(req));
    res.json(data);
  }

  static async getStaffing(req: Request, res: Response) {
    const data = await InsightsRepository.getStaffing(InsightsController.getOrgId(req));
    res.json(data);
  }

  static async getCompliance(req: Request, res: Response) {
    const data = await InsightsRepository.getCompliance(InsightsController.getOrgId(req));
    res.json(data);
  }

  static async getLeave(req: Request, res: Response) {
    const data = await InsightsRepository.getLeave(InsightsController.getOrgId(req));
    res.json(data);
  }

  static async getRota(req: Request, res: Response) {
    const data = await InsightsRepository.getRota(InsightsController.getOrgId(req));
    res.json(data);
  }
}
