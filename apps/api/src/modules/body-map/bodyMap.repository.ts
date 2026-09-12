import { query } from '../../shared/database';

export class BodyMapRepository {
  static async getEntries(orgId: string, personId: string) {
    const result = await query(
      `SELECT bm.*, u.email as recorded_by_name
       FROM body_map_entries bm
       LEFT JOIN users u ON u.id = bm.created_by
       WHERE bm.person_id = $1
       ORDER BY bm.recorded_date DESC, bm.created_at DESC`,
      [personId]
    );
    return result.rows;
  }

  static async getActiveEntries(orgId: string, personId: string) {
    const result = await query(
      `SELECT bm.*, u.email as recorded_by_name
       FROM body_map_entries bm
       LEFT JOIN users u ON u.id = bm.created_by
       WHERE bm.person_id = $1 AND bm.status = 'active'
       ORDER BY bm.recorded_date DESC`,
      [personId]
    );
    return result.rows;
  }

  static async getEntry(orgId: string, entryId: string) {
    const result = await query(
      `SELECT bm.*, u.email as recorded_by_name
       FROM body_map_entries bm
       LEFT JOIN users u ON u.id = bm.created_by
       WHERE bm.id = $1`,
      [entryId]
    );
    return result.rows[0] || null;
  }

  static async createEntry(orgId: string, data: {
    person_id: string;
    body_view: 'front' | 'back';
    body_zone: string;
    zone_x?: number;
    zone_y?: number;
    condition_type: string;
    description?: string;
    severity?: string;
    image_url?: string;
  }, userId: string) {
    const result = await query(
      `INSERT INTO body_map_entries (person_id, body_view, body_zone, zone_x, zone_y, condition_type, description, severity, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.person_id, data.body_view, data.body_zone, data.zone_x || null, data.zone_y || null,
       data.condition_type, data.description || null, data.severity || 'mild', data.image_url || null, userId]
    );
    return result.rows[0];
  }

  static async updateEntry(orgId: string, entryId: string, data: {
    description?: string;
    severity?: string;
    status?: string;
    resolved_date?: string;
    image_url?: string;
  }) {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (data.description !== undefined) { fields.push(`description = $${i++}`); params.push(data.description); }
    if (data.severity !== undefined) { fields.push(`severity = $${i++}`); params.push(data.severity); }
    if (data.status !== undefined) { fields.push(`status = $${i++}`); params.push(data.status); }
    if (data.resolved_date !== undefined) { fields.push(`resolved_date = $${i++}`); params.push(data.resolved_date); }
    if (data.image_url !== undefined) { fields.push(`image_url = $${i++}`); params.push(data.image_url); }

    if (fields.length === 0) return this.getEntry(orgId, entryId);
    params.push(entryId);

    const result = await query(
      `UPDATE body_map_entries SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async deleteEntry(orgId: string, entryId: string) {
    await query(`DELETE FROM body_map_entries WHERE id = $1`, [entryId]);
  }

  static async getHistory(orgId: string, personId: string, limit = 50) {
    const result = await query(
      `SELECT bm.*, u.email as recorded_by_name
       FROM body_map_entries bm
       LEFT JOIN users u ON u.id = bm.created_by
       WHERE bm.person_id = $1
       ORDER BY bm.recorded_date DESC, bm.created_at DESC
       LIMIT $2`,
      [personId, limit]
    );
    return result.rows;
  }

  static async getStats(orgId: string, personId: string) {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') as active_count,
         COUNT(*) FILTER (WHERE status = 'healing') as healing_count,
         COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
         COUNT(*) as total_count
       FROM body_map_entries WHERE person_id = $1`,
      [personId]
    );
    return result.rows[0];
  }
}
