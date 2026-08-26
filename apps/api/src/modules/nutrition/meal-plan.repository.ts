import { query } from '../../shared/database';

export interface MealPlanTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  meal_type: string;
  day_of_week: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  items?: MealPlanItem[];
}

export interface MealPlanItem {
  id: string;
  meal_plan_id: string;
  food_name: string;
  portion_size: string | null;
  allergens: string | null;
  dietary_flags: string[] | null;
  notes: string | null;
  sort_order: number;
  created_at: Date;
}

export class MealPlanRepository {
  static async listTemplates(orgId: string, filters?: { meal_type?: string; day_of_week?: string; is_active?: boolean }) {
    let sql = `SELECT mp.*,
      (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = mp.created_by) AS created_by_name,
      (SELECT COUNT(*)::int FROM meal_plan_items mpi WHERE mpi.meal_plan_id = mp.id) AS item_count
     FROM meal_plan_templates mp
     WHERE mp.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (filters?.meal_type) { sql += ` AND mp.meal_type = $${idx++}`; params.push(filters.meal_type); }
    if (filters?.day_of_week) { sql += ` AND mp.day_of_week = $${idx++}`; params.push(filters.day_of_week); }
    if (filters?.is_active !== undefined) { sql += ` AND mp.is_active = $${idx++}`; params.push(filters.is_active); }
    sql += ' ORDER BY mp.meal_type, mp.name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async getTemplateById(id: string) {
    const result = await query(
      `SELECT mp.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = mp.created_by) AS created_by_name
       FROM meal_plan_templates mp WHERE mp.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    const template = result.rows[0];
    template.items = await this.getTemplateItems(id);
    return template;
  }

  static async createTemplate(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO meal_plan_templates
        (organization_id, name, description, meal_type, day_of_week, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, data.name, data.description || null, data.meal_type,
       data.day_of_week || null, data.is_active !== false, data.created_by || null]);
    return result.rows[0];
  }

  static async updateTemplate(id: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (['name', 'description', 'meal_type', 'day_of_week', 'is_active'].includes(key)) {
        if (val !== undefined) { fields.push(`${key} = $${idx++}`); values.push(val); }
      }
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id);
    const result = await query(
      `UPDATE meal_plan_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return result.rows[0] || null;
  }

  static async deleteTemplate(id: string, orgId: string) {
    await query('DELETE FROM meal_plan_templates WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  // Template items
  static async getTemplateItems(templateId: string) {
    const result = await query(
      `SELECT * FROM meal_plan_items WHERE meal_plan_id = $1 ORDER BY sort_order, created_at`, [templateId]);
    return result.rows;
  }

  static async addTemplateItem(templateId: string, data: any) {
    const maxOrder = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM meal_plan_items WHERE meal_plan_id = $1',
      [templateId]);
    const result = await query(
      `INSERT INTO meal_plan_items
        (meal_plan_id, food_name, portion_size, allergens, dietary_flags, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [templateId, data.food_name, data.portion_size || null, data.allergens || null,
       data.dietary_flags || [], data.notes || null, data.sort_order ?? maxOrder.rows[0].next_order]);
    return result.rows[0];
  }

  static async updateTemplateItem(id: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (['food_name', 'portion_size', 'allergens', 'dietary_flags', 'notes', 'sort_order'].includes(key)) {
        if (val !== undefined) { fields.push(`${key} = $${idx++}`); values.push(val); }
      }
    }
    if (fields.length === 0) return null;
    values.push(id);
    const result = await query(
      `UPDATE meal_plan_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return result.rows[0] || null;
  }

  static async deleteTemplateItem(id: string) {
    await query('DELETE FROM meal_plan_items WHERE id = $1', [id]);
  }

  // Clone a template (e.g. to create next week's plan from this week's)
  static async cloneTemplate(templateId: string, orgId: string, newDayOfWeek?: string) {
    const source = await this.getTemplateById(templateId);
    if (!source) return null;
    const cloned = await this.createTemplate(orgId, {
      name: `${source.name} (copy)`,
      description: source.description,
      meal_type: source.meal_type,
      day_of_week: newDayOfWeek || source.day_of_week,
    });
    if (source.items) {
      for (const item of source.items) {
        await this.addTemplateItem(cloned.id, {
          food_name: item.food_name,
          portion_size: item.portion_size,
          allergens: item.allergens,
          dietary_flags: item.dietary_flags,
          notes: item.notes,
          sort_order: item.sort_order,
        });
      }
    }
    return this.getTemplateById(cloned.id);
  }
}
