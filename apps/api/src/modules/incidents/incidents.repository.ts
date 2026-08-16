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
      `INSERT INTO incident_categories (organization_id, name, severity, is_cqc_reportable, is_active)
       VALUES ($1, $2, $3, $4, COALESCE($5, TRUE)) RETURNING *`,
      [orgId, data.name, data.severity || 'medium', data.is_cqc_reportable || false, data.is_active ?? true]
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

  static async findAll(orgId: string, opts: {
    status?: string; category_id?: string; severity?: string; is_near_miss?: string;
    date_from?: string; date_to?: string; include_confidential?: boolean;
    limit?: number; offset?: number;
  } = {}) {
    let sql = `SELECT i.*, to_char(i.incident_time, 'HH24:MI') AS incident_time, ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last,
                      (SELECT COUNT(*)::int FROM incident_actions ia WHERE ia.incident_id = i.id AND ia.completed_at IS NULL) AS open_actions
               FROM incidents i
               LEFT JOIN incident_categories ic ON i.category_id = ic.id
               LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
               WHERE i.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (!opts.include_confidential) { sql += ` AND i.is_confidential = FALSE`; }
    if (opts.status) { sql += ` AND i.status = $${idx}`; params.push(opts.status); idx++; }
    if (opts.category_id) { sql += ` AND i.category_id = $${idx}`; params.push(opts.category_id); idx++; }
    if (opts.severity) { sql += ` AND i.severity = $${idx}`; params.push(opts.severity); idx++; }
    if (opts.is_near_miss) { sql += ` AND i.is_near_miss = $${idx}`; params.push(opts.is_near_miss === 'true'); idx++; }
    if (opts.date_from) { sql += ` AND i.incident_date >= $${idx}`; params.push(opts.date_from); idx++; }
    if (opts.date_to) { sql += ` AND i.incident_date <= $${idx}`; params.push(opts.date_to); idx++; }
    sql += ' ORDER BY i.incident_date DESC, i.created_at DESC';
    if (opts.limit) { sql += ` LIMIT $${idx}`; params.push(opts.limit); idx++; }
    if (opts.offset) { sql += ` OFFSET $${idx}`; params.push(opts.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId?: string, includeConfidential = true) {
    const result = await query(
      `SELECT i.*, to_char(i.incident_time, 'HH24:MI') AS incident_time, ic.name AS category_name, sp.first_name AS reported_by_first, sp.last_name AS reported_by_last
       FROM incidents i
       LEFT JOIN incident_categories ic ON i.category_id = ic.id
       LEFT JOIN staff_profiles sp ON i.reported_by = sp.user_id
       WHERE i.id = $1${orgId ? ' AND i.organization_id = $2' : ''}${includeConfidential ? '' : ' AND i.is_confidential = FALSE'}`,
      orgId ? [id, orgId] : [id]
    );
    return result.rows[0] || null;
  }

  static async create(orgId: string, data: any, reportedBy: string) {
    const result = await query(
      `INSERT INTO incidents (organization_id, category_id, title, description, incident_date, incident_time, location, severity, status, is_cqc_reportable, is_near_miss, is_confidential, root_cause, outcomes, investigation_notes, lessons_learned, cqc_reference, reported_to_cqc_at, reported_by)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, COALESCE($9, 'reported'), $10, COALESCE($11, FALSE), COALESCE($12, FALSE), $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [orgId, data.category_id, data.title, data.description, data.incident_date, data.incident_time, data.location, data.severity || 'medium', data.status, data.is_cqc_reportable || false, data.is_near_miss || false, data.is_confidential || false, data.root_cause, data.outcomes, data.investigation_notes, data.lessons_learned, data.cqc_reference, data.reported_to_cqc_at, reportedBy]
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

  static async delete(id: string, orgId: string) {
    const result = await query(
      'DELETE FROM incidents WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async getInvolvedResidents(incidentId: string) {
    const result = await query(
      `SELECT iir.*, su.first_name, su.last_name, su.room_number
       FROM incident_involved_residents iir
       LEFT JOIN people su ON iir.person_id = su.id
       WHERE iir.incident_id = $1 ORDER BY iir.created_at`,
      [incidentId]
    );
    return result.rows;
  }

  static async addInvolvedResident(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_involved_residents (incident_id, person_id, involvement_type, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [incidentId, data.person_id, data.involvement_type || 'affected', data.notes]
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

  private static readonly ACTION_UPDATE_COLUMNS = ['action', 'assigned_to', 'due_date', 'completed_at', 'status'] as const;

  static async updateAction(id: string, data: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (IncidentsRepository.ACTION_UPDATE_COLUMNS as readonly string[]).includes(key)) {
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
      `UPDATE incident_actions SET completed_at = CURRENT_TIMESTAMP, status = 'completed' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  static async deleteAction(id: string) {
    await query('DELETE FROM incident_actions WHERE id = $1', [id]);
  }

  static async getAttachments(incidentId: string) {
    const result = await query(
      `SELECT ia.*, sp.first_name AS uploaded_first, sp.last_name AS uploaded_last
       FROM incident_attachments ia
       LEFT JOIN staff_profiles sp ON ia.uploaded_by = sp.user_id
       WHERE ia.incident_id = $1 ORDER BY ia.created_at DESC`,
      [incidentId]
    );
    return result.rows;
  }

  static async addAttachment(incidentId: string, data: any) {
    const result = await query(
      `INSERT INTO incident_attachments (incident_id, file_name, file_url, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [incidentId, data.file_name, data.file_url, data.file_type, data.file_size, data.uploaded_by]
    );
    return result.rows[0];
  }

  static async deleteAttachment(id: string) {
    await query('DELETE FROM incident_attachments WHERE id = $1', [id]);
  }

  static async getStats(orgId: string, includeConfidential = true) {
    const scope = includeConfidential ? '' : ' AND is_confidential = FALSE';
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'reported')::int AS reported,
        COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
        COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
        COUNT(*) FILTER (WHERE is_cqc_reportable = TRUE AND status != 'closed')::int AS pending_cqc,
        COUNT(*) FILTER (WHERE is_near_miss = TRUE)::int AS near_misses,
        COUNT(*) FILTER (WHERE is_confidential = TRUE)::int AS confidential
      FROM incidents WHERE organization_id = $1${scope}
    `, [orgId]);

    const actions = await query(`
      SELECT
        COUNT(*)::int AS total_actions,
        COUNT(*) FILTER (WHERE ia.completed_at IS NULL AND ia.status != 'cancelled')::int AS open_actions,
        COUNT(*) FILTER (WHERE ia.completed_at IS NULL AND ia.status != 'cancelled' AND ia.due_date < CURRENT_DATE)::int AS overdue_actions
      FROM incident_actions ia
      JOIN incidents i ON ia.incident_id = i.id
      WHERE i.organization_id = $1${scope}
    `, [orgId]);

    return { ...result.rows[0], ...actions.rows[0] };
  }

  static async getTimeline(incidentId: string) {
    const result = await query(
      `SELECT created_at, 'incident.created' AS event, 'Incident reported' AS title, NULL::text AS detail
       FROM incidents WHERE id = $1
       UNION ALL
       SELECT al.created_at, 'audit.' || al.action AS event,
              CASE al.action
                WHEN 'create' THEN 'Incident created'
                WHEN 'update' THEN 'Incident updated'
                WHEN 'status' THEN 'Status changed'
                WHEN 'delete' THEN 'Incident removed'
                WHEN 'action_create' THEN 'Action added'
                WHEN 'action_update' THEN 'Action updated'
                WHEN 'action_complete' THEN 'Action completed'
                WHEN 'action_delete' THEN 'Action removed'
                WHEN 'involved_add' THEN 'Person linked'
                WHEN 'involved_remove' THEN 'Person unlinked'
                WHEN 'attachment_upload' THEN 'Evidence attached'
                WHEN 'attachment_delete' THEN 'Evidence removed'
                ELSE 'Change recorded'
              END AS title,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email, 'System') AS detail
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE al.entity_type = 'incident' AND al.entity_id = $1
       ORDER BY created_at DESC
      `,
      [incidentId]
    );
    return result.rows;
  }
}
