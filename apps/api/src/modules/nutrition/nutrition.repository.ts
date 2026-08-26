import { query } from '../../shared/database';

const DIETARY_PROFILE_UPDATE_COLUMNS = new Set([
  'dietary_type', 'texture_modified', 'vegetarian', 'vegan', 'halal', 'kosher',
  'gluten_free', 'dairy_free', 'nut_allergy', 'other_allergies',
  'food_preferences', 'food_dislikes', 'fluid_daily_target_ml',
  'appetite_level', 'eating_abilities', 'additional_notes',
]);

const MEAL_UPDATE_COLUMNS = new Set([
  'meal_date', 'meal_time', 'meal_type', 'notes', 'appetite_level',
  'amount_offered', 'amount_consumed', 'consumed_percent',
  'refused', 'refusal_reason', 'staff_concerns', 'fluid_ml',
]);

export class NutritionRepository {
  // ── Dietary Profile ──

  static async findDietaryProfile(personId: string) {
    const result = await query(
      `SELECT dp.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dp.recorded_by) AS recorded_by_name
       FROM dietary_profiles dp
       WHERE dp.person_id = $1
       ORDER BY dp.updated_at DESC LIMIT 1`, [personId]);
    return result.rows[0] || null;
  }

  static async upsertDietaryProfile(personId: string, data: any) {
    const existing = await query(
      'SELECT id FROM dietary_profiles WHERE person_id = $1', [personId]);

    const dietaryType = data.dietary_type || null;
    const textureModified = data.texture_modified || null;
    const vegetarian = data.vegetarian || false;
    const vegan = data.vegan || false;
    const halal = data.halal || false;
    const kosher = data.kosher || false;
    const glutenFree = data.gluten_free || false;
    const dairyFree = data.dairy_free || false;
    const nutAllergy = data.nut_allergy || false;
    const otherAllergies = data.other_allergies || null;
    const foodPreferences = data.food_preferences || null;
    const foodDislikes = data.food_dislikes || null;
    const fluidDailyTarget = data.fluid_daily_target_ml || 2000;
    const appetiteLevel = data.appetite_level || null;
    const eatingAbilities = data.eating_abilities || null;
    const additionalNotes = data.additional_notes || null;
    const recordedBy = data.recorded_by || null;

    if (existing.rows.length > 0) {
      const result = await query(
        `UPDATE dietary_profiles SET
          dietary_type = $2, texture_modified = $3, vegetarian = $4, vegan = $5,
          halal = $6, kosher = $7, gluten_free = $8, dairy_free = $9,
          nut_allergy = $10, other_allergies = $11, food_preferences = $12,
          food_dislikes = $13, fluid_daily_target_ml = $14, appetite_level = $15,
          eating_abilities = $16, additional_notes = $17, recorded_by = $18,
          updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [existing.rows[0].id, dietaryType, textureModified, vegetarian, vegan,
         halal, kosher, glutenFree, dairyFree, nutAllergy, otherAllergies,
         foodPreferences, foodDislikes, fluidDailyTarget, appetiteLevel,
         eatingAbilities, additionalNotes, recordedBy]);
      return result.rows[0];
    }

    const result = await query(
      `INSERT INTO dietary_profiles
        (person_id, dietary_type, texture_modified, vegetarian, vegan,
         halal, kosher, gluten_free, dairy_free, nut_allergy, other_allergies,
         food_preferences, food_dislikes, fluid_daily_target_ml, appetite_level,
         eating_abilities, additional_notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [personId, dietaryType, textureModified, vegetarian, vegan,
       halal, kosher, glutenFree, dairyFree, nutAllergy, otherAllergies,
       foodPreferences, foodDislikes, fluidDailyTarget, appetiteLevel,
       eatingAbilities, additionalNotes, recordedBy]);
    return result.rows[0];
  }

  // ── Meal Records ──

  static async findMeals(personId: string, filters?: { date?: string; meal_type?: string; dateFrom?: string; dateTo?: string }) {
    let sql = `
      SELECT m.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = m.recorded_by) AS recorded_by_name
      FROM meal_records m
      WHERE m.person_id = $1`;
    const params: any[] = [personId];
    let idx = 2;
    if (filters?.date) { sql += ` AND m.meal_date = $${idx++}`; params.push(filters.date); }
    if (filters?.meal_type) { sql += ` AND m.meal_type = $${idx++}`; params.push(filters.meal_type); }
    if (filters?.dateFrom) { sql += ` AND m.meal_date >= $${idx++}`; params.push(filters.dateFrom); }
    if (filters?.dateTo) { sql += ` AND m.meal_date <= $${idx++}`; params.push(filters.dateTo); }
    sql += ' ORDER BY m.meal_date DESC, m.meal_time DESC NULLS LAST';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findMealById(id: string) {
    const result = await query(
      `SELECT m.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = m.recorded_by) AS recorded_by_name
       FROM meal_records m WHERE m.id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async createMeal(personId: string, data: any) {
    const result = await query(
      `INSERT INTO meal_records
        (person_id, meal_date, meal_time, meal_type, notes, appetite_level,
         amount_offered, amount_consumed, consumed_percent,
         refused, refusal_reason, staff_concerns, fluid_ml, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [personId, data.meal_date || new Date().toISOString().split('T')[0],
       data.meal_time || null, data.meal_type, data.notes || null,
       data.appetite_level || null, data.amount_offered || null,
       data.amount_consumed || null, data.consumed_percent ?? null,
       data.refused || false, data.refusal_reason || null,
       data.staff_concerns || null, data.fluid_ml ?? null, data.recorded_by || null]);
    return result.rows[0];
  }

  static async updateMeal(id: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (!MEAL_UPDATE_COLUMNS.has(key)) continue;
      if (val !== undefined) { fields.push(`${key} = $${idx++}`); values.push(val); }
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id);
    const result = await query(
      `UPDATE meal_records SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return result.rows[0] || null;
  }

  static async deleteMeal(id: string, personId: string) {
    await query('DELETE FROM meal_records WHERE id = $1 AND person_id = $2', [id, personId]);
  }

  // ── Meal Items ──

  static async findMealItems(mealId: string) {
    const result = await query(
      `SELECT mi.* FROM meal_items mi WHERE mi.meal_id = $1 ORDER BY mi.created_at`, [mealId]);
    return result.rows;
  }

  static async addMealItem(mealId: string, data: any) {
    const result = await query(
      `INSERT INTO meal_items (meal_id, food_name, portion_size, allergens, preparation_notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [mealId, data.food_name, data.portion_size || null, data.allergens || null, data.preparation_notes || null]);
    return result.rows[0];
  }

  static async updateMealItem(id: string, data: any) {
    const result = await query(
      `UPDATE meal_items SET food_name = COALESCE($1, food_name), portion_size = COALESCE($2, portion_size),
       allergens = COALESCE($3, allergens), preparation_notes = COALESCE($4, preparation_notes)
       WHERE id = $5 RETURNING *`,
      [data.food_name || null, data.portion_size || null, data.allergens || null, data.preparation_notes || null, id]);
    return result.rows[0] || null;
  }

  static async deleteMealItem(id: string) {
    await query('DELETE FROM meal_items WHERE id = $1', [id]);
  }

  // ── Summary / Aggregation ──

  static async getDailySummary(personId: string, date: string) {
    const meals = await this.findMeals(personId, { date });
    const totalFluidMl = meals.reduce((sum: number, m: any) => sum + (Number(m.fluid_ml) || 0), 0);
    const totalCaloriesEst = meals.reduce((sum: number, m: any) => sum + (Number(m.calories_estimate) || 0), 0);
    const mealCount = meals.length;
    const refusedCount = meals.filter((m: any) => m.refused).length;
    const avgConsumed = meals.length > 0
      ? Math.round(meals.reduce((sum: number, m: any) => sum + (Number(m.consumed_percent) || 0), 0) / meals.length)
      : 0;

    return {
      date,
      meal_count: mealCount,
      refused_count: refusedCount,
      total_fluid_ml: totalFluidMl,
      total_calories_estimate: totalCaloriesEst,
      avg_consumed_percent: avgConsumed,
      meals,
    };
  }

  static async getWeeklySummary(personId: string, startDate: string) {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const result = await query(
      `SELECT meal_date, meal_type, consumed_percent, refused, fluid_ml,
              COUNT(*) OVER (PARTITION BY meal_date) AS meals_on_day
       FROM meal_records
       WHERE person_id = $1 AND meal_date >= $2 AND meal_date < $3
       ORDER BY meal_date, meal_time`, [personId, fmt(start), fmt(end)]);
    return result.rows;
  }

  static async getNutritionOverview(orgId: string) {
    const result = await query(
      `SELECT p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name,
        l.name AS location_name,
        dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
        dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
        dp.other_allergies, dp.appetite_level, dp.fluid_daily_target_ml,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date = CURRENT_DATE) ::int AS meals_today,
        (SELECT COALESCE(SUM(fluid_ml), 0) FROM meal_records mr
         WHERE mr.person_id = p.id AND mr.meal_date = CURRENT_DATE) ::int AS fluid_today,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date = CURRENT_DATE AND mr.refused = TRUE) ::int AS refused_today
       FROM people p
       LEFT JOIN locations l ON l.id = p.location_id
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.organization_id = $1 AND p.status = 'active'
       ORDER BY p.last_name, p.first_name`, [orgId]);
    return result.rows;
  }

  static async getPeopleWithDietaryInfo(orgId: string) {
    const result = await query(
      `SELECT p.id, p.first_name, p.last_name, p.dietary_requirements, p.allergies,
        dp.dietary_type, dp.texture_modified, dp.vegetarian, dp.vegan,
        dp.halal, dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
        dp.other_allergies, dp.food_preferences, dp.food_dislikes,
        dp.appetite_level, dp.eating_abilities, dp.additional_notes,
        l.name AS location_name
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       LEFT JOIN locations l ON l.id = p.location_id
       WHERE p.organization_id = $1 AND p.status = 'active'
       ORDER BY p.last_name, p.first_name`, [orgId]);
    return result.rows;
  }
}
