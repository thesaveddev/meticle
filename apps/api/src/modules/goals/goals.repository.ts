import { query } from '../../shared/database';

export interface GoalRow {
  id: string;
  organization_id: string;
  service_user_id: string;
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
}

export class GoalRepository {
  static async findAll(orgId: string, serviceUserId?: string, status?: string) {
    let sql = `
      SELECT g.*,
        (SELECT first_name || ' ' || last_name FROM service_users WHERE id = g.service_user_id) AS service_user_name
      FROM service_user_goals g
      WHERE g.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (serviceUserId) { sql += ` AND g.service_user_id = $${idx++}`; params.push(serviceUserId); }
    if (status) { sql += ` AND g.status = $${idx++}`; params.push(status); }
    sql += ' ORDER BY g.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId: string) {
    const result = await query(`
      SELECT g.*,
        (SELECT first_name || ' ' || last_name FROM service_users WHERE id = g.service_user_id) AS service_user_name
      FROM service_user_goals g
      WHERE g.id = $1 AND g.organization_id = $2
    `, [id, orgId]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<GoalRow>) {
    const { organization_id, service_user_id, title, description, target_date, review_date, status, progress, cqc_domain, frequency, goal_category, created_by } = data;
    const result = await query(
      `INSERT INTO service_user_goals (organization_id, service_user_id, title, description, target_date, review_date, status, progress, cqc_domain, frequency, goal_category, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [organization_id, service_user_id, title, description, target_date, review_date, status || 'active', progress || 0, cqc_domain, frequency || 'one_time', goal_category, created_by]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<GoalRow>, orgId: string) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id' || k === 'organization_id' || k === 'created_at') continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    params.push(id, orgId);
    const result = await query(
      `UPDATE service_user_goals SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    await query('DELETE FROM service_user_goals WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  static async getServiceUserStats(orgId: string, serviceUserId: string) {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COALESCE(ROUND(AVG(progress) FILTER (WHERE status = 'active')), 0)::int AS avg_progress
      FROM service_user_goals
      WHERE organization_id = $1 AND service_user_id = $2
    `, [orgId, serviceUserId]);
    return result.rows[0] || { total: 0, active: 0, completed: 0, avg_progress: 0 };
  }
}
