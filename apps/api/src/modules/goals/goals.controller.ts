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
    const milestones = await GoalRepository.findMilestones(req.params.id);
    res.json({ ...goal, milestones });
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

  // ─── Milestones ───

  static async listMilestones(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.findById(req.params.id, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    const milestones = await GoalRepository.findMilestones(req.params.id);
    res.json(milestones);
  }

  static async createMilestone(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.findById(req.params.id, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    const milestone = await GoalRepository.createMilestone(req.params.id, req.body);
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'goal_milestone', entity_id: milestone.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(milestone);
  }

  static async updateMilestone(req: Request, res: Response) {
    const milestone = await GoalRepository.updateMilestone(req.params.milestoneId, req.body);
    if (!milestone) throw new AppError(404, 'Milestone not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'goal_milestone', entity_id: req.params.milestoneId, ip_address: req.ip }).catch(() => {});
    res.json(milestone);
  }

  static async deleteMilestone(req: Request, res: Response) {
    await GoalRepository.deleteMilestone(req.params.milestoneId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'goal_milestone', entity_id: req.params.milestoneId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Milestone deleted' });
  }

  // ─── Progress History ───

  static async getProgressHistory(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.findById(req.params.id, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    const history = await GoalRepository.getProgressHistory(req.params.id);
    res.json(history);
  }

  static async recordProgress(req: Request, res: Response) {
    const orgId = GoalController.getOrgId(req);
    const goal = await GoalRepository.findById(req.params.id, orgId);
    if (!goal) throw new AppError(404, 'Goal not found');
    const updated = await GoalRepository.recordProgress(req.params.id, req.body.progress, req.body.notes, req.user!.userId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'update_progress', entity_type: 'service_user_goal', entity_id: req.params.id, new_data: { progress: req.body.progress, notes: req.body.notes }, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }
}
