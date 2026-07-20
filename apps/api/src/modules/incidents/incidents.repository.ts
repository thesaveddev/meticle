import { query } from '../../shared/database';

export class IncidentsRepository {
  static async findCategories(orgId: string) {
    const result = await query(
      'SELECT * FROM incident_categories WHERE organization_id = $1 ORDER BY name',
      [orgId]
    );
    return result.rows;
  }

  static async createCategory(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_categories (organization_id, name, severity, is_cqc_reportable)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, data.name, data.severity || 'medium', data.is_cqc_reportable || false]
    );
    return result.rows[0];
  }

  static async updateCategory(id: string, orgId: string, data: any) {
    const result = await query(
      `UPDATE incident_categories SET name = COALESCE($1, name), severity = COALESCE($2, severity),
       is_cqc_reportable = COALESCE($3, is_cqc_reportable), is_active = COALESCE($4, is_active)
       WHERE id = $5 AND organization_id = $6 RETURNING *`,
      [data.name, data.severity, data.is_cqc_reportable, data.is_active, id, orgId]
    );
    return result.rows[0] || null;
  }

  static async deleteCategory(id: string, orgId: string) {
    const result = await query(
      'DELETE FROM incident_categories WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async findAll(orgId: string, filters?: { status?: string; category_id?: string; severity?: string; limit?: number; offset?: number }) {
    let sql = `SELECT i.*, ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last
               FROM incidents i
               LEFT JOIN incident_categories ic ON i.category_id = ic.id
               LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
               WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (filters?.status) { sql += ` AND i.status = $${idx}`; params.push(filters.status); idx++; }
    if (filters?.category_id) { sql += ` AND i.category_id = $${idx}`; params.push(filters.category_id); idx++; }
    if (filters?.severity) { sql += ` AND i.severity = $${idx}`; params.push(filters.severity); idx++; }
    sql += ' ORDER BY i.created_at DESC';
    if (filters?.limit) { sql += ` LIMIT $${idx}`; params.push(filters.limit); idx++; }
    if (filters?.offset) { sql += ` OFFSET $${idx}`; params.push(filters.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId?: string) {
    const result = await query(
      `SELECT i.*, ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last
       FROM incidents i
       LEFT JOIN incident_categories ic ON i.category_id = ic.id
       LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
       WHERE i.id = $1${orgId ? ' AND i.organization_id = $2' : ''}`,
      orgId ? [id, orgId] : [id]
    );
    return result.rows[0] || null;
  }

  static async create(orgId: string, data: any, reportedBy: string) {
    const result = await query(
      `INSERT INTO incidents (organization_id, category_id, title, description, incident_date, incident_time, location, severity, status, is_cqc_reportable, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'reported', $9, $10) RETURNING *`,
      [orgId, data.category_id, data.title, data.description, data.incident_date, data.incident_time, data.location, data.severity || 'medium', data.is_cqc_reportable || false, reportedBy]
    );
    return result.rows[0];
  }

  static async update(id: string, data: any, orgId?: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'organization_id') {
        fields.push(`${key} = $${idx}`);
        params.push(value);
        idx++;
      }
    }
    if (fields.length === 0) return null;
    params.push(id);
    if (orgId) { params.push(orgId); }
    const result = await query(
      `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${idx}${orgId ? ` AND organization_id = $${idx + 1}` : ''} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async getInvolvedResidents(incidentId: string) {
    const result = await query(
      `SELECT iir.*, su.first_name, su.last_name, su.room_number
       FROM incident_involved_residents iir
       LEFT JOIN service_users su ON iir.service_user_id = su.id
       WHERE iir.incident_id = $1 ORDER BY iir.created_at`,
      [incidentId]
    );
    return result.rows;
  }

  static async addInvolvedResident(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_involved_residents (incident_id, service_user_id, involvement_type, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [incidentId, data.service_user_id, data.involvement_type || 'affected', data.notes]
    );
    return result.rows[0];
  }

  static async removeInvolvedResident(id: string) {
    await query('DELETE FROM incident_involved_residents WHERE id = $1', [id]);
  }

  static async getActions(incidentId: string) {
    const result = await query(
      `SELECT ia.*, sp.first_name AS assigned_first, sp.last_name AS assigned_last
       FROM incident_actions ia
       LEFT JOIN staff_profiles sp ON ia.assigned_to = sp.user_id
       WHERE ia.incident_id = $1 ORDER BY ia.created_at`,
      [incidentId]
    );
    return result.rows;
  }

  static async createAction(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_actions (incident_id, action, assigned_to, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [incidentId, data.action, data.assigned_to, data.due_date]
    );
    return result.rows[0];
  }

  static async updateAction(id: string, data: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx}`);
        params.push(value);
        idx++;
      }
    }
    if (fields.length === 0) return null;
    params.push(id);
    const result = await query(
      `UPDATE incident_actions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async completeAction(id: string) {
    const result = await query(
      `UPDATE incident_actions SET completed_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async deleteAction(id: string) {
    await query('DELETE FROM incident_actions WHERE id = $1', [id]);
  }

  static async getStats(orgId: string) {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'reported')::int AS reported,
        COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE is_cqc_reportable = TRUE AND status != 'closed')::int AS pending_cqc
      FROM incidents WHERE organization_id = $1
    `, [orgId]);
    return result.rows[0];
  }
}
