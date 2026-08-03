import { query } from '../../shared/database';

export interface GoalRow {
  id: string;
  organization_id: string;
  person_id: string;
  title: string;
  description?: string;
  target_date?: string;
  review_date?: string;
  status: string;
  progress: number;
  cqc_domain?: string;
  frequency: string;
  goal_category?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  care_plan_id?: string;
  baseline_value?: number;
  target_value?: number;
  value_unit?: string;
  provider_clarification?: string;
  assigned_to?: string;
  status_reason?: string;
  is_private?: boolean;
  started_at?: string;
}

export interface MilestoneRow {
  id: string;
  goal_id: string;
  title: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  sort_order: number;
  created_at: string;
}

export interface ProgressHistoryRow {
  id: string;
  goal_id: string;
  progress: number;
  notes?: string;
  recorded_by?: string;
  recorded_at: string;
  recorded_by_name?: string;
}

export class GoalRepository {
  private static readonly GOAL_UPDATE_COLUMNS = new Set(['person_id', 'title', 'description', 'target_date', 'review_date', 'status', 'progress', 'cqc_domain', 'frequency', 'goal_category', 'created_by', 'care_plan_id', 'baseline_value', 'target_value', 'value_unit', 'provider_clarification', 'assigned_to', 'status_reason', 'is_private', 'started_at']);
  private static readonly MILESTONE_UPDATE_COLUMNS = new Set(['title', 'is_completed', 'sort_order']);
  static async findAll(orgId: string, personId?: string, status?: string) {
    let sql = `
      SELECT g.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = g.person_id) AS person_name,
        (SELECT cp.title FROM care_plans cp WHERE cp.id = g.care_plan_id) AS care_plan_title,
        (SELECT COUNT(*)::int FROM goal_milestones gm WHERE gm.goal_id = g.id) AS milestones_total,
        (SELECT COUNT(*)::int FROM goal_milestones gm WHERE gm.goal_id = g.id AND gm.is_completed = true) AS milestones_completed
      FROM person_goals g
      WHERE g.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (personId) { sql += ` AND g.person_id = $${idx++}`; params.push(personId); }
    if (status) { sql += ` AND g.status = $${idx++}`; params.push(status); }
    sql += ' ORDER BY g.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId: string) {
    const result = await query(`
      SELECT g.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = g.person_id) AS person_name,
        (SELECT cp.title FROM care_plans cp WHERE cp.id = g.care_plan_id) AS care_plan_title
      FROM person_goals g
      WHERE g.id = $1 AND g.organization_id = $2
    `, [id, orgId]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<GoalRow>) {
    const { organization_id, person_id, title, description, target_date, review_date, status, progress, cqc_domain, frequency, goal_category, created_by, care_plan_id, baseline_value, target_value, value_unit, provider_clarification, assigned_to, status_reason, is_private, started_at } = data;
    const result = await query(
      `INSERT INTO person_goals (organization_id, person_id, title, description, target_date, review_date, status, progress, cqc_domain, frequency, goal_category, created_by, care_plan_id, baseline_value, target_value, value_unit, provider_clarification, assigned_to, status_reason, is_private, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [organization_id, person_id, title, description, target_date, review_date, status || 'active', progress || 0, cqc_domain, frequency || 'one_time', goal_category, created_by, care_plan_id || null, baseline_value ?? null, target_value ?? null, value_unit || null, provider_clarification || null, assigned_to || null, status_reason || null, is_private || false, started_at || null]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<GoalRow>, orgId: string) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!GoalRepository.GOAL_UPDATE_COLUMNS.has(k)) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    params.push(id, orgId);
    const result = await query(
      `UPDATE person_goals SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    await query('DELETE FROM person_goals WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  static async getPersonStats(orgId: string, personId: string) {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COALESCE(ROUND(AVG(progress) FILTER (WHERE status = 'active')), 0)::int AS avg_progress,
        COUNT(*) FILTER (WHERE status = 'active' AND review_date < CURRENT_DATE)::int AS overdue_reviews,
        (SELECT COUNT(*)::int FROM goal_milestones gm JOIN person_goals g2 ON gm.goal_id = g2.id WHERE g2.person_id = $2 AND g2.organization_id = $1 AND gm.is_completed = true) AS milestones_completed,
        (SELECT COUNT(*)::int FROM goal_milestones gm JOIN person_goals g2 ON gm.goal_id = g2.id WHERE g2.person_id = $2 AND g2.organization_id = $1) AS milestones_total
      FROM person_goals
      WHERE organization_id = $1 AND person_id = $2
    `, [orgId, personId]);
    return result.rows[0] || { total: 0, active: 0, completed: 0, avg_progress: 0, overdue_reviews: 0, milestones_completed: 0, milestones_total: 0 };
  }

  // ─── Milestones ───

  static async findMilestones(goalId: string) {
    const result = await query(
      `SELECT gm.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = gm.completed_by) AS completed_by_name
       FROM goal_milestones gm WHERE gm.goal_id = $1 ORDER BY gm.sort_order, gm.created_at`,
      [goalId]
    );
    return result.rows;
  }

  static async createMilestone(goalId: string, data: { title: string; sort_order?: number }) {
    const result = await query(
      `INSERT INTO goal_milestones (goal_id, title, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [goalId, data.title, data.sort_order ?? 0]
    );
    return result.rows[0];
  }

  static async updateMilestone(milestoneId: string, data: { title?: string; is_completed?: boolean; sort_order?: number }) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!GoalRepository.MILESTONE_UPDATE_COLUMNS.has(k)) continue;
      if (v === undefined) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    if (fields.length === 0) return null;
    if (data.is_completed === true) {
      fields.push(`completed_at = CURRENT_TIMESTAMP`);
    }
    params.push(milestoneId);
    const result = await query(
      `UPDATE goal_milestones SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async deleteMilestone(milestoneId: string) {
    await query('DELETE FROM goal_milestones WHERE id = $1', [milestoneId]);
  }

  // ─── Progress History ───

  static async recordProgress(goalId: string, progress: number, notes: string | undefined, recordedBy: string) {
    // Insert history entry
    await query(
      `INSERT INTO goal_progress_history (goal_id, progress, notes, recorded_by) VALUES ($1, $2, $3, $4)`,
      [goalId, progress, notes || null, recordedBy]
    );
    // Update goal's current progress
    const result = await query(
      `UPDATE person_goals SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [progress, goalId]
    );
    return result.rows[0] || null;
  }

  static async getProgressHistory(goalId: string) {
    const result = await query(`
      SELECT gph.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = gph.recorded_by) AS recorded_by_name
      FROM goal_progress_history gph
      WHERE gph.goal_id = $1
      ORDER BY gph.recorded_at DESC
    `, [goalId]);
    return result.rows;
  }
}
