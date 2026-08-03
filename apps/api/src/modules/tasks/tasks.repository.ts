import { query } from '../../shared/database';

export class TaskRepository {
  static async findAll(orgId: string, filters?: { status?: string; assigned_to?: string; person_id?: string }) {
    let sql = `SELECT t.*, COALESCE(sp.first_name || ' ' || sp.last_name, '') as assigned_name,
               COALESCE(su.first_name || ' ' || su.last_name, '') as person_name,
               (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = t.created_by) as created_by_name
        FROM tasks t
        LEFT JOIN staff_profiles sp ON t.assigned_to = sp.id
        LEFT JOIN people su ON t.person_id = su.id
        WHERE t.organization_id = $1`;
    const params: any[] = [orgId]; let idx = 2;
    if (filters?.status) { sql += ` AND t.status = $${idx++}`; params.push(filters.status); }
    if (filters?.assigned_to) { sql += ` AND t.assigned_to = $${idx++}`; params.push(filters.assigned_to); }
    if (filters?.person_id) { sql += ` AND t.person_id = $${idx++}`; params.push(filters.person_id); }
    sql += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST, t.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId: string) {
    const result = await query('SELECT * FROM tasks WHERE id = $1 AND organization_id = $2', [id, orgId]);
    return result.rows[0] || null;
  }

  static async create(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO tasks (organization_id, title, description, assigned_to, person_id, priority, status, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, data.title, data.description || null, data.assigned_to || null, data.person_id || null,
       data.priority || 'medium', data.status || 'pending', data.due_date || null, data.created_by || null]
    );
    return result.rows[0];
  }

  static async update(id: string, orgId: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const allowed = new Set(['title', 'description', 'assigned_to', 'person_id', 'priority', 'status', 'due_date']);
    for (const [k, v] of Object.entries(data)) {
      if (!allowed.has(k)) continue;
      if (k === 'status' && v === 'completed') fields.push('completed_at = NOW()');
      fields.push(`${k} = $${idx++}`); params.push(v);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    params.push(id, orgId);
    const result = await query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    const result = await query('DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    return result.rows[0] || null;
  }
}
