import { Request, Response } from 'express';
import { GoalRepository } from './goals.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class GoalController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async list(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const { service_user_id, status } = req.query as any;
    const goals = await GoalRepository.findAll(orgId, service_user_id, status);
    res.json(goals);
  }

  static async getById(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.findById(req.params.id, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    res.json(goal);
  }

  static async create(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.create({ ...req.body, organization_id: orgId, created_by: req.user!.userId });
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'service_user_goal', entity_id: goal.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(goal);
  }

  static async update(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.update(req.params.id, req.body, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'service_user_goal', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json(goal);
  }

  static async delete(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    await GoalRepository.delete(req.params.id, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'service_user_goal', entity_id: req.params.id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Goal deleted' });
  }

  static async getServiceUserStats(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const { serviceUserId } = req.params;
    const stats = await GoalRepository.getServiceUserStats(orgId, serviceUserId);
    res.json(stats);
  }
}
