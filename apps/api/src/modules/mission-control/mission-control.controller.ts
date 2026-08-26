import { Request, Response } from 'express';
import { MissionControlRepository } from './mission-control.repository';

export class MissionControlController {
  static async getAlerts(req: Request, res: Response) {
    const alerts = await MissionControlRepository.getAlerts(req.user!.organizationId!);
    res.json(alerts);
  }

  static async getSummary(req: Request, res: Response) {
    const summary = await MissionControlRepository.getSummary(req.user!.organizationId!);
    res.json(summary);
  }

  static async dismissAlert(req: Request, res: Response) {
    const updated = await MissionControlRepository.dismissAlert(req.params.id, req.user!.organizationId!);
    res.json({ dismissed: updated > 0 });
  }

  static async dismissByType(req: Request, res: Response) {
    const updated = await MissionControlRepository.dismissByType(req.user!.organizationId!, req.params.alertType);
    res.json({ dismissed: updated });
  }
}