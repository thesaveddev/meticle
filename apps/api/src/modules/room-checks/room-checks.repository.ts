import { query } from '../../shared/database';

export class RoomCheckRepository {
  private static readonly ROOM_CHECK_UPDATE_COLUMNS = new Set(['location_id', 'room_number', 'checked_by', 'check_date', 'status', 'cleanliness_rating', 'safety_rating', 'notes', 'photo_url']);
  static async findAll(orgId: string, filters?: { location_id?: string; status?: string; date?: string; room_number?: string }) {
    let sql = `SELECT rc.*, l.name as location_name,
               COALESCE(sp.first_name || ' ' || sp.last_name, '') as checked_by_name
        FROM room_checks rc
        LEFT JOIN locations l ON rc.location_id = l.id
        LEFT JOIN staff_profiles sp ON rc.checked_by = sp.id
        WHERE rc.organization_id = $1`;
    const params: any[] = [orgId]; let idx = 2;
    if (filters?.location_id) { sql += ` AND rc.location_id = $${idx++}`; params.push(filters.location_id); }
    if (filters?.status) { sql += ` AND rc.status = $${idx++}`; params.push(filters.status); }
    if (filters?.date) { sql += ` AND rc.check_date = $${idx++}`; params.push(filters.date); }
    if (filters?.room_number) { sql += ` AND rc.room_number = $${idx++}`; params.push(filters.room_number); }
    sql += ' ORDER BY rc.check_date DESC, rc.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async create(orgId: string, data: any) {
    const result = await query(
      `INSERT INTO room_checks (organization_id, location_id, room_number, checked_by, check_date, status, cleanliness_rating, safety_rating, notes, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, data.location_id || null, data.room_number, data.checked_by || null, data.check_date || new Date().toISOString().split('T')[0],
       data.status || 'pass', data.cleanliness_rating || null, data.safety_rating || null, data.notes || null, data.photo_url || null]
    );
    return result.rows[0];
  }

  static async update(id: string, orgId: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!RoomCheckRepository.ROOM_CHECK_UPDATE_COLUMNS.has(k)) continue;
      fields.push(`${k} = $${idx++}`); params.push(v);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    params.push(id, orgId);
    const result = await query(`UPDATE room_checks SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    const result = await query('DELETE FROM room_checks WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    return result.rows[0] || null;
  }
}
