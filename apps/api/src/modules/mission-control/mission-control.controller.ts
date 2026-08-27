import { Request, Response } from 'express';
import { MissionControlRepository } from './mission-control.repository';

export class MissionControlController {
  static async getAlerts(req: Request, res: Response) {
    const { severity, category } = req.query;
    const alerts = await MissionControlRepository.getAlerts(req.user!.organizationId!, {
      severity: severity as string | undefined,
      category: category as string | undefined,
    });
    res.json(alerts);
  }

  static async getSummary(req: Request, res: Response) {
    const summary = await MissionControlRepository.getSummary(req.user!.organizationId!);
    res.json(summary);
  }

  static async getAlertHistory(req: Request, res: Response) {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = await MissionControlRepository.getAlertHistory(req.user!.organizationId!, limit);
    res.json(history);
  }

  static async getTrends(req: Request, res: Response) {
    const trends = await MissionControlRepository.getTrends(req.user!.organizationId!);
    res.json(trends);
  }

  static async dismissAlert(req: Request, res: Response) {
    const updated = await MissionControlRepository.dismissAlert(req.params.id, req.user!.organizationId!);
    res.json({ dismissed: updated > 0 });
  }

  static async dismissByType(req: Request, res: Response) {
    const updated = await MissionControlRepository.dismissByType(req.user!.organizationId!, req.params.alertType);
    res.json({ dismissed: updated });
  }

  static async batchDismiss(req: Request, res: Response) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: { message: 'ids array required' } });
    }
    const dismissed = await MissionControlRepository.batchDismiss(ids, req.user!.organizationId!);
    res.json({ dismissed });
  }

  static async assignAlert(req: Request, res: Response) {
    const { assignedTo, assignedName } = req.body;
    if (!assignedTo || !assignedName) {
      return res.status(400).json({ error: { message: 'assignedTo and assignedName required' } });
    }
    const updated = await MissionControlRepository.assignAlert(req.params.id, req.user!.organizationId!, assignedTo, assignedName);
    if (!updated) return res.status(404).json({ error: { message: 'Alert not found' } });
    res.json(updated);
  }
}