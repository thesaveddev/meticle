import { Request, Response } from 'express';
import { DashboardRepository } from './dashboard.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

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

  static async getDomiciliarySummary(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization required');
    const { getDomiciliaryDashboard } = await import('./dashboard.domiciliary');
    const data = await getDomiciliaryDashboard(orgId, req.query.date as string | undefined);
    res.json(data);
  }

  static async getLiveMap(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization required');
    const { getLiveMapData } = await import('./dashboard.live-map');
    const data = await getLiveMapData(orgId);
    // Viewing staff locations is an access event, not a read. The DPIA claimed
    // this endpoint was audited and it was not, so the record has now been
    // added: the question "which manager looked at the carers' positions, and
    // when" should be answerable without guessing.
    //
    // Deliberately no coordinates in new_data. The audit row records that the map
    // was opened; the positions themselves are already recorded against each
    // visit at check-in, and duplicating them here would create a second copy
    // with its own retention question.
    AuditRepository.log({
      user_id: req.user?.userId,
      action: 'view',
      entity_type: 'homecare_visit_map',
      new_data: {
        organization_id: orgId,
        checked_in_visits_returned: data?.active_visits?.length ?? 0,
      },
      ip_address: req.ip,
    }).catch(() => {});
    res.json(data);
  }
}
