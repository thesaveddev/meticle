import { Request, Response } from 'express';
import { MealPlanRepository } from './meal-plan.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import { query } from '../../shared/database';

/** Canonical dietary tags for template menus (Figma 11.1). Anything else
 *  sent by a hand-written request is dropped, never stored. */
const DIETARY_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher', 'soft', 'low-sugar', 'diabetic-friendly'];

export class MealPlanController {
  private static cleanMealPlanInput(body: any) {
    const out: any = {};
    if (body.dietary_tags !== undefined) {
      out.dietary_tags = Array.isArray(body.dietary_tags)
        ? body.dietary_tags.filter((t: any) => DIETARY_TAGS.includes(String(t))).slice(0, 20)
        : [];
    }
    return out;
  }

  private static async assertLocationInOrg(locationId: string | undefined, orgId: string) {
    if (!locationId) return null;
    const result = await query('SELECT 1 FROM locations WHERE id = $1 AND organization_id = $2', [locationId, orgId]);
    if (!result.rows.length) throw new AppError(400, 'Location not found in your organisation.');
    return locationId;
  }

  private static async assertTemplateInOrg(templateId: string, orgId: string) {
    const result = await query('SELECT 1 FROM meal_plan_templates WHERE id = $1 AND organization_id = $2', [templateId, orgId]);
    if (!result.rows.length) throw new AppError(404, 'Meal plan template not found');
  }

  private static async assertItemInOrg(itemId: string, orgId: string) {
    const result = await query(
      `SELECT 1 FROM meal_plan_items mpi
       JOIN meal_plan_templates mp ON mp.id = mpi.meal_plan_id
       WHERE mpi.id = $1 AND mp.organization_id = $2`,
      [itemId, orgId]
    );
    if (!result.rows.length) throw new AppError(404, 'Meal plan item not found');
  }

  static async listTemplates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { meal_type, day_of_week, active_only } = req.query as any;
    const is_active = active_only === 'true' ? true : active_only === 'false' ? false : undefined;
    const templates = await MealPlanRepository.listTemplates(orgId, { meal_type, day_of_week, is_active });
    res.json(templates);
  }

  static async getTemplate(req: Request, res: Response) {
    const { id } = req.params;
    await MealPlanController.assertTemplateInOrg(id, req.user!.organizationId!);
    const template = await MealPlanRepository.getTemplateById(id);
    if (!template) throw new AppError(404, 'Meal plan template not found');
    res.json(template);
  }

  static async createTemplate(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const template = await MealPlanRepository.createTemplate(orgId, {
      ...req.body,
      ...MealPlanController.cleanMealPlanInput(req.body),
      location_id: await MealPlanController.assertLocationInOrg(req.body.location_id, orgId),
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
    const orgId = req.user!.organizationId!;
    await MealPlanController.assertTemplateInOrg(id, orgId);
    const updated = await MealPlanRepository.updateTemplate(id, {
      ...req.body,
      ...MealPlanController.cleanMealPlanInput(req.body),
      ...(req.body.location_id !== undefined
        ? { location_id: await MealPlanController.assertLocationInOrg(req.body.location_id, orgId) }
        : {}),
    }, orgId);
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
    await MealPlanController.assertTemplateInOrg(templateId, req.user!.organizationId!);
    const item = await MealPlanRepository.addTemplateItem(templateId, req.body);
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_plan_item', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateItem(req: Request, res: Response) {
    const { itemId } = req.params;
    await MealPlanController.assertItemInOrg(itemId, req.user!.organizationId!);
    const updated = await MealPlanRepository.updateTemplateItem(itemId, req.body);
    if (!updated) throw new AppError(404, 'Meal plan item not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_plan_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async deleteItem(req: Request, res: Response) {
    const { itemId } = req.params;
    await MealPlanController.assertItemInOrg(itemId, req.user!.organizationId!);
    await MealPlanRepository.deleteTemplateItem(itemId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'meal_plan_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Meal plan item deleted' });
  }
}
