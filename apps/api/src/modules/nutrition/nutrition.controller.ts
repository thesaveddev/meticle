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

  static async seedTestNutritionData(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const pool = (await import('../../shared/database')).default;

    // Get active people with their dietary profiles
    const peopleResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.organization_id,
              dp.id as dp_id, dp.dietary_type, dp.appetite_level
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.organization_id = $1 AND p.status = 'active'
       ORDER BY RANDOM() LIMIT 5`,
      [orgId]
    );

    if (peopleResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'No active people found. Add people first.' } });
    }

    const results: any[] = [];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'morning_snack', 'afternoon_snack'];
    const appetites = ['poor', 'fair', 'poor', 'poor']; // Weighted toward poor to trigger events
    const refusalReasons = ['Refused meal - not hungry', 'Refused meal - said food was cold', 'Refused meal - not feeling well', 'Refused to eat'];
    const staffConcerns = ['Person ate very little today', 'Appetite seems lower than usual', 'Not finishing meals recently'];

    for (const person of peopleResult.rows) {
      // Ensure dietary profile exists
      if (!person.dp_id) {
        await pool.query(
          `INSERT INTO dietary_profiles (person_id, dietary_type, appetite_level, fluid_daily_target_ml, vegetarian, vegan, gluten_free, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (person_id) DO NOTHING`,
          [person.id, 'Standard', 'good', 2000, false, false, false, userId]
        );
      }

      const personMeals: any[] = [];

      // Create 3-5 meal records over the last 3 days
      for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
        const mealDate = new Date();
        mealDate.setDate(mealDate.getDate() - daysAgo);
        const dateStr = mealDate.toISOString().split('T')[0];

        // Create 2-3 meals per day
        const mealsPerDay = 2 + Math.floor(Math.random() * 2);
        for (let m = 0; m < mealsPerDay; m++) {
          const mealType = mealTypes[m % mealTypes.length];
          const hour = 8 + m * 3 + Math.floor(Math.random() * 2);
          const mealTime = `${String(hour).padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;

          // Mix of refused, poor appetite, and normal meals
          // Person at index 0: 3 consecutive refusals (high severity)
          // Person at index 1: declining appetite (medium severity)
          // Person at index 2: 2 consecutive refusals (medium severity)
          // Others: random mix
          let refused = false;
          let appetiteLevel = 'good';
          let consumedPercent = 75 + Math.floor(Math.random() * 20);
          let refusalReason: string | null = null;
          let staffConcern: string | null = null;

          if (person.first_name && peopleResult.rows[0] && person.id === peopleResult.rows[0].id) {
            // First person: refused all meals (3+ consecutive)
            refused = true;
            consumedPercent = 0;
            refusalReason = refusalReasons[Math.floor(Math.random() * refusalReasons.length)];
            staffConcern = staffConcerns[2];
          } else if (person.first_name && peopleResult.rows[1] && person.id === peopleResult.rows[1].id) {
            // Second person: declining appetite, very low consumption
            appetiteLevel = daysAgo === 2 ? 'fair' : daysAgo === 1 ? 'poor' : 'poor';
            consumedPercent = daysAgo === 2 ? 40 : daysAgo === 1 ? 20 : 15;
            staffConcern = staffConcerns[0];
          } else if (person.first_name && peopleResult.rows[2] && person.id === peopleResult.rows[2].id && m === 0) {
            // Third person: refused 2 meals (medium)
            refused = true;
            consumedPercent = 0;
            refusalReason = refusalReasons[1];
          } else if (Math.random() < 0.2) {
            // Random occasional refusal
            refused = true;
            consumedPercent = 0;
            refusalReason = refusalReasons[Math.floor(Math.random() * refusalReasons.length)];
          }

          const fluidMl = refused ? 0 : (100 + Math.floor(Math.random() * 300));

          const mealResult = await pool.query(
            `INSERT INTO meal_records
              (person_id, meal_date, meal_time, meal_type, appetite_level,
               amount_offered, amount_consumed, consumed_percent,
               refused, refusal_reason, staff_concerns, fluid_ml, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [person.id, dateStr, mealTime, mealType, appetiteLevel,
             'Standard portion', refused ? 'None' : 'Full', consumedPercent,
             refused, refusalReason, staffConcern, fluidMl, userId]
          );

          personMeals.push(mealResult.rows[0]);
        }
      }

      results.push({
        person: `${person.first_name} ${person.last_name}`,
        person_id: person.id,
        meals_created: personMeals.length,
      });
    }

    res.json({
      message: `Created ${results.reduce((sum, r) => sum + r.meals_created, 0)} test meal records for ${results.length} people. Events will be emitted for refused meals and declining appetite.`,
      results,
    });
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
