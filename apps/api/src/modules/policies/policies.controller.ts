import { Request, Response } from 'express';
import { PolicyRepository } from './policies.repository';
import { AppError } from '../../shared/middleware/error.middleware';

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
}
