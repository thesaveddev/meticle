import { Request, Response } from 'express';
import { NutritionRepository } from './nutrition.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';

export class NutritionController {
  // === Dietary Profile ===
  static async getDietaryProfile(req: Request, res: Response) {
    const { personId } = req.params;
    const profile = await NutritionRepository.findDietaryProfile(personId);
    res.json(profile);
  }

  static async upsertDietaryProfile(req: Request, res: Response) {
    const { personId } = req.params;
    const profile = await NutritionRepository.upsertDietaryProfile(personId, {
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    AuditRepository.log({ user_id: req.user!.userId, action: profile.recorded_by ? 'update' : 'create', entity_type: 'dietary_profile', entity_id: profile.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(profile);
  }

  // === Meal Records ===
  static async getMeals(req: Request, res: Response) {
    const { personId } = req.params;
    const { date, meal_type, dateFrom, dateTo } = req.query as any;
    const meals = await NutritionRepository.findMeals(personId, { date, meal_type, dateFrom, dateTo });
    res.json(meals);
  }

  static async getMeal(req: Request, res: Response) {
    const { id } = req.params;
    const meal = await NutritionRepository.findMealById(id);
    if (!meal) throw new AppError(404, 'Meal record not found');
    // Attach items
    meal.items = await NutritionRepository.findMealItems(id);
    res.json(meal);
  }

  static async createMeal(req: Request, res: Response) {
    const { personId } = req.params;
    const meal = await NutritionRepository.createMeal(personId, {
      ...req.body,
      person_id: personId,
      recorded_by: req.user!.userId,
    });
    // If items were provided, add them
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        await NutritionRepository.addMealItem(meal.id, item);
      }
      meal.items = await NutritionRepository.findMealItems(meal.id);
    }
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_record', entity_id: meal.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(meal);
  }

  static async updateMeal(req: Request, res: Response) {
    const { id, personId } = req.params;
    const updated = await NutritionRepository.updateMeal(id, req.body);
    if (!updated) throw new AppError(404, 'Meal record not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_record', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async deleteMeal(req: Request, res: Response) {
    const { id, personId } = req.params;
    await NutritionRepository.deleteMeal(id, personId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'meal_record', entity_id: id, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Meal record deleted' });
  }

  // === Meal Items ===
  static async addMealItem(req: Request, res: Response) {
    const { mealId } = req.params;
    const item = await NutritionRepository.addMealItem(mealId, req.body);
    AuditRepository.log({ user_id: req.user!.userId, action: 'create', entity_type: 'meal_item', entity_id: item.id, ip_address: req.ip }).catch(() => {});
    res.status(201).json(item);
  }

  static async updateMealItem(req: Request, res: Response) {
    const { itemId } = req.params;
    const updated = await NutritionRepository.updateMealItem(itemId, req.body);
    if (!updated) throw new AppError(404, 'Meal item not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json(updated);
  }

  static async deleteMealItem(req: Request, res: Response) {
    const { itemId } = req.params;
    await NutritionRepository.deleteMealItem(itemId);
    AuditRepository.log({ user_id: req.user!.userId, action: 'delete', entity_type: 'meal_item', entity_id: itemId, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Meal item deleted' });
  }

  // === Summary / Overview ===
  static async getDailySummary(req: Request, res: Response) {
    const { personId } = req.params;
    const { date } = req.query as any;
    if (!date) throw new AppError(400, 'Date query param required');
    const summary = await NutritionRepository.getDailySummary(personId, date);
    res.json(summary);
  }

  static async getWeeklySummary(req: Request, res: Response) {
    const { personId } = req.params;
    const { startDate } = req.query as any;
    if (!startDate) throw new AppError(400, 'startDate query param required');
    const summary = await NutritionRepository.getWeeklySummary(personId, startDate);
    res.json(summary);
  }

  static async getNutritionOverview(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const overview = await NutritionRepository.getNutritionOverview(orgId);
    res.json(overview);
  }

  static async getPeopleWithDietaryInfo(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const people = await NutritionRepository.getPeopleWithDietaryInfo(orgId);
    res.json(people);
  }
}
