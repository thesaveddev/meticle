import { Request, Response } from 'express';
import { MealPlanRepository } from './meal-plan.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class MealPlanController {
  static async listTemplates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { meal_type, day_of_week, active_only } = req.query as any;
    const is_active = active_only === 'true' ? true : active_only === 'false' ? false : undefined;
    const templates = await MealPlanRepository.listTemplates(orgId, { meal_type, day_of_week, is_active });
    res.json(templates);
  }

  static async getTemplate(req: Request, res: Response) {
    const { id } = req.params;
    const template = await MealPlanRepository.getTemplateById(id);
    if (!template) throw new AppError(404, 'Meal plan template not found');
    res.json(template);
  }

  static async createTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const template = await MealPlanRepository.createTemplate(orgId, {
      ...req.body,
      created_by: req.user!.userId,
    });
    // Create items if provided
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        await MealPlanRepository.addTemplateItem(template.id, item);
      }
      const fullTemplate = await MealPlanRepository.getTemplateById(template.id);
      AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_plan_template', entity_id: template.id, ip_address: req.ip }).catch(() => {});
      res.status(201).json(fullTemplate);
    } else {
      AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_plan_template', entity_id: template.id, ip_address: req.ip }).catch(() => {});
      res.status(201).json(template);
    }
  }

  static async updateTemplate(req: Request, res: Response) {
    const { id } = req.params;
    const updated = await MealPlanRepository.updateTemplate(id, req.body);
    if (!updated) throw new AppError(404, 'Meal plan template not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_plan_template', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async deleteTemplate(req: Request, res: Response) {
    const { id } = req.params;
    const orgId = req.user!.organizationId!;
    await MealPlanRepository.deleteTemplate(id, orgId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'meal_plan_template', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Meal plan template deleted' });
  }

  static async cloneTemplate(req: Request, res: Response) {
    const { id } = req.params;
    const orgId = req.user!.organizationId!;
    const { day_of_week } = req.body;
    const cloned = await MealPlanRepository.cloneTemplate(id, orgId, day_of_week);
    if (!cloned) throw new AppError(404, 'Source template not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'clone', entity_type: 'meal_plan_template', entity_id: cloned.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(cloned);
  }

  // Template items
  static async addItem(req: Request, res: Response) {
    const { templateId } = req.params;
    const item = await MealPlanRepository.addTemplateItem(templateId, req.body);
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_plan_item', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateItem(req: Request, res: Response) {
    const { itemId } = req.params;
    const updated = await MealPlanRepository.updateTemplateItem(itemId, req.body);
    if (!updated) throw new AppError(404, 'Meal plan item not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_plan_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async deleteItem(req: Request, res: Response) {
    const { itemId } = req.params;
    await MealPlanRepository.deleteTemplateItem(itemId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'meal_plan_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Meal plan item deleted' });
  }
}
