import { Request, Response } from 'express';
import { NutritionRepository } from './nutrition.repository';
import { AppError } from '../../shared/middleware/error.middleware';
import { AuditRepository } from '../audit/audit.repository';
import { publishAppetiteDeclineEvent, publishRefusedMealEvent } from './nutrition.events';
import { query } from '../../shared/database';

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
    // Fire nutrition events asynchronously (don't block response)
    emitNutritionEventsIfNeeded(personId, meal).catch(() => {});
    res.status(201).json(meal);
  }

  static async updateMeal(req: Request, res: Response) {
    const { id, personId } = req.params;
    const updated = await NutritionRepository.updateMeal(id, req.body);
    if (!updated) throw new AppError(404, 'Meal record not found');
    AuditRepository.log({ user_id: req.user!.userId, action: 'update', entity_type: 'meal_record', entity_id: id, ip_address: req.ip }).catch(() => {});
    // Re-evaluate nutrition events after update
    emitNutritionEventsIfNeeded(personId, updated).catch(() => {});
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

/**
 * After a meal is recorded or updated, check if it triggers
 * nutrition.appetite_decline or nutrition.refused_meal events.
 */
async function emitNutritionEventsIfNeeded(personId: string, meal: any): Promise<void> {
  // Fetch person info and org
  const personResult = await query(
    'SELECT id, organization_id, first_name, last_name FROM people WHERE id = $1',
    [personId]);
  if (personResult.rows.length === 0) return;
  const person = personResult.rows[0];
  const personName = `${person.first_name} ${person.last_name}`;
  const orgId = person.organization_id;

  // Check for refused meal
  if (meal.refused) {
    // Count consecutive refusals (look at recent meals for this person)
    const recentMeals = await query(
      `SELECT id, meal_type, meal_date, refused FROM meal_records
       WHERE person_id = $1 ORDER BY meal_date DESC, meal_time DESC LIMIT 10`,
      [personId]);
    let consecutiveRefusals = 0;
    for (const m of recentMeals.rows) {
      if (m.refused) consecutiveRefusals++;
      else break;
    }

    await publishRefusedMealEvent({
      organizationId: orgId,
      personId,
      personName,
      mealId: meal.id,
      mealDate: meal.meal_date || new Date().toISOString().split('T')[0],
      mealType: meal.meal_type || 'unknown',
      refusalReason: meal.refusal_reason || null,
      staffConcerns: meal.staff_concerns || null,
      consumedPercent: meal.consumed_percent ?? null,
      consecutiveRefusals,
    }).catch(() => {});
  }

  // Check for appetite decline: poor appetite or very low consumption
  if (meal.appetite_level === 'poor' || (meal.consumed_percent != null && meal.consumed_percent <= 25)) {
    // Count consecutive poor meals
    const recentMeals = await query(
      `SELECT appetite_level, consumed_percent FROM meal_records
       WHERE person_id = $1 ORDER BY meal_date DESC, meal_time DESC LIMIT 10`,
      [personId]);
    let consecutivePoor = 0;
    for (const m of recentMeals.rows) {
      if (m.appetite_level === 'poor' || (m.consumed_percent != null && m.consumed_percent <= 25)) {
        consecutivePoor++;
      } else {
        break;
      }
    }

    // Get baseline appetite from dietary profile
    const profile = await NutritionRepository.findDietaryProfile(personId);

    await publishAppetiteDeclineEvent({
      organizationId: orgId,
      personId,
      personName,
      mealDate: meal.meal_date || new Date().toISOString().split('T')[0],
      mealType: meal.meal_type || 'unknown',
      appetiteLevel: meal.appetite_level || 'unknown',
      consumedPercent: meal.consumed_percent ?? null,
      dietaryAppetiteBaseline: profile?.appetite_level || null,
      consecutivePoorMeals: consecutivePoor,
    }).catch(() => {});
  }
}
