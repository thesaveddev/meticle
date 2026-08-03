import { query } from '../../shared/database';

export interface AppointmentRow {
  id: string;
  organization_id: string;
  person_id?: string;
  staff_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  status: string;
  location_id?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export class AppointmentRepository {
  private static readonly APPOINTMENT_UPDATE_COLUMNS = new Set(['person_id', 'staff_id', 'title', 'description', 'start_time', 'end_time', 'status', 'location_id', 'created_by']);
  static async findAll(orgId: string, date?: string) {
    let sql = `
      SELECT a.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = a.person_id) AS person_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE id = a.staff_id) AS staff_name,
        l.name AS location_name
      FROM appointments a
      LEFT JOIN locations l ON l.id = a.location_id
      WHERE a.organization_id = $1`;
    const params: any[] = [orgId];
    if (date) {
      sql += ` AND a.start_time >= $2::date AND a.start_time < $2::date + interval '1 day'`;
      params.push(date);
    }
    sql += ' ORDER BY a.start_time';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId: string) {
    const result = await query(`
      SELECT a.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = a.person_id) AS person_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE id = a.staff_id) AS staff_name,
        l.name AS location_name
      FROM appointments a
      LEFT JOIN locations l ON l.id = a.location_id
      WHERE a.id = $1 AND a.organization_id = $2
    `, [id, orgId]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<AppointmentRow>) {
    const { organization_id, person_id, staff_id, title, description, start_time, end_time, status, location_id, created_by } = data;
    const result = await query(
      `INSERT INTO appointments (organization_id, person_id, staff_id, title, description, start_time, end_time, status, location_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [organization_id, person_id, staff_id, title, description, start_time, end_time, status || 'scheduled', location_id, created_by]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<AppointmentRow>, orgId: string) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!AppointmentRepository.APPOINTMENT_UPDATE_COLUMNS.has(k)) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    params.push(id, orgId);
    const result = await query(
      `UPDATE appointments SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    await query('DELETE FROM appointments WHERE id = $1 AND organization_id = $2', [id, orgId]);
  }

  static async getTodayStats(orgId: string) {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
      FROM appointments
      WHERE organization_id = $1
        AND start_time >= CURRENT_DATE
        AND start_time < CURRENT_DATE + INTERVAL '1 day'
    `, [orgId]);
    return result.rows[0] || { total: 0, scheduled: 0, completed: 0, cancelled: 0 };
  }
}
