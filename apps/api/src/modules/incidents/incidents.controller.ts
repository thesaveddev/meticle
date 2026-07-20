import { Request, Response } from 'express';
import { AppError } from '../../shared/middleware/error.middleware';
import { IncidentsRepository } from './incidents.repository';
import { requireIncidentInOrg } from '../../shared/database/tenant';

export class IncidentsController {
  static getOrgId(req: Request): string {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    return orgId;
  }

  static getUserId(req: Request): string | undefined {
    return req.user?.userId;
  }

  static async getStats(req: Request, res: Response) {
    const data = await IncidentsRepository.getStats(IncidentsController.getOrgId(req));
    res.json(data);
  }

  static async list(req: Request, res: Response) {
    const { status, category_id, severity, limit, offset } = req.query;
    const data = await IncidentsRepository.findAll(IncidentsController.getOrgId(req), {
      status: status as string, category_id: category_id as string,
      severity: severity as string, limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(data);
  }

  static async getById(req: Request, res: Response) {
    const incident = await IncidentsRepository.findById(req.params.id, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    const involved = await IncidentsRepository.getInvolvedResidents(req.params.id);
    const actions = await IncidentsRepository.getActions(req.params.id);
    res.json({ ...incident, involved, actions });
  }

  static async create(req: Request, res: Response) {
    const orgId = IncidentsController.getOrgId(req);
    const userId = IncidentsController.getUserId(req) || '';
    const incident = await IncidentsRepository.create(orgId, req.body, userId);
    res.status(201).json(incident);
  }

  static async update(req: Request, res: Response) {
    const incident = await IncidentsRepository.update(req.params.id, req.body, IncidentsController.getOrgId(req));
    if (!incident) throw new AppError(404, 'Incident not found');
    res.json(incident);
  }

  static async addInvolvedResident(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    const record = await IncidentsRepository.addInvolvedResident(req.params.id, req.body);
    res.status(201).json(record);
  }

  static async removeInvolvedResident(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    await IncidentsRepository.removeInvolvedResident(req.params.id);
    res.status(204).send();
  }

  static async getActions(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    const actions = await IncidentsRepository.getActions(req.params.id);
    res.json(actions);
  }

  static async createAction(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    const action = await IncidentsRepository.createAction(req.params.id, req.body);
    res.status(201).json(action);
  }

  static async completeAction(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    const action = await IncidentsRepository.completeAction(req.params.id);
    if (!action) throw new AppError(404, 'Action not found');
    res.json(action);
  }

  static async updateAction(req: Request, res: Response) {
    const user = req.user!;
    await requireIncidentInOrg(user, req.params.id);
    const action = await IncidentsRepository.updateAction(req.params.actionId, req.body);
    if (!action) throw new AppError(404, 'Action not found');
    res.json(action);
  }

  static async deleteAction(req: Request, res: Response) {
    const actionId = req.params.actionId || req.params.id;
    await IncidentsRepository.deleteAction(actionId);
    res.status(204).send();
  }

  static async getCategories(req: Request, res: Response) {
    const data = await IncidentsRepository.findCategories(IncidentsController.getOrgId(req));
    res.json(data);
  }

  static async createCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.createCategory(IncidentsController.getOrgId(req), req.body);
    res.status(201).json(cat);
  }

  static async updateCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.updateCategory(req.params.id, IncidentsController.getOrgId(req), req.body);
    if (!cat) throw new AppError(404, 'Category not found');
    res.json(cat);
  }

  static async deleteCategory(req: Request, res: Response) {
    const cat = await IncidentsRepository.deleteCategory(req.params.id, IncidentsController.getOrgId(req));
    if (!cat) throw new AppError(404, 'Category not found');
    res.status(204).send();
  }
}
