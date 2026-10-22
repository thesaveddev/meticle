import { Request, Response } from 'express';
import { PolicyRepository } from './policies.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { UserRole } from '@meticle/shared';

export class PolicyController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static async list(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const { category, search } = req.query as any;
    await PolicyRepository.ensureDefaults(orgId);
    const policies = await PolicyRepository.findAll(orgId, category, search);
    res.json(policies);
  }

  static async getById(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    res.json(policy);
  }

  static async create(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.create({ ...req.body, organization_id: orgId, updated_by: req.user!.userId });
    res.status(201).json(policy);
  }

  static async update(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.update(req.params.id, { ...req.body, updated_by: req.user!.userId }, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    res.json(policy);
  }

  static async delete(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    await PolicyRepository.delete(req.params.id, orgId);
    res.json({ message: 'Policy deleted' });
  }

  static async getCategories(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const categories = await PolicyRepository.getCategories(orgId);
    res.json(categories);
  }

  static async seedStandard(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const result = await PolicyRepository.seedStandardPolicies(orgId);
    res.json(result);
  }

  /**
   * Any signed-in staff member may acknowledge a policy in their own name —
   * that is the whole point (blueprint §9.7): the acknowledgement is
   * attributed to the caller, never to a supplied user id.
   */
  static async acknowledge(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const ack = await PolicyRepository.acknowledge(req.params.id, orgId, req.user!.userId);
    res.status(201).json(ack);
  }

  /**
   * Managers read the whole list; anyone else reads only their own row, so a
   * support worker can see what they have acknowledged without seeing the
   * organisation's reading history.
   */
  static async acknowledgements(req: Request, res: Response) {
    const orgId = PolicyController.getOrgId(req);
    const policy = await PolicyRepository.findById(req.params.id, orgId);
    if (!policy) throw new AppError(404, 'Policy not found');
    const rows = await PolicyRepository.acknowledgements(req.params.id, orgId);
    const role = req.user!.role;
    if (role === UserRole.ORG_ADMIN || role === UserRole.MANAGER) return res.json(rows);
    return res.json(rows.filter((row: any) => row.user_id === req.user!.userId));
  }
}
