import { query } from '../../shared/database';

export class HealthRepository {
  // === Health Observations ===
  static async findObservations(serviceUserId: string, limit = 50) {
    const result = await query(`
      SELECT ho.*, u.email AS recorded_by_name
      FROM health_observations ho
      LEFT JOIN users u ON u.id = ho.recorded_by
      WHERE ho.service_user_id = $1
      ORDER BY ho.observation_date DESC, ho.created_at DESC
      LIMIT $2
    `, [serviceUserId, limit]);
    return result.rows;
  }

  static async createObservation(data: any) {
    const { service_user_id, observation_date, category, notes, severity, recorded_by } = data;
    const result = await query(`
      INSERT INTO health_observations (service_user_id, observation_date, category, notes, severity, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [service_user_id, observation_date || new Date().toISOString().split('T')[0], category || 'general', notes, severity || 'normal', recorded_by]);
    return result.rows[0];
  }

  static async deleteObservation(id: string, serviceUserId: string) {
    await query('DELETE FROM health_observations WHERE id = $1 AND service_user_id = $2', [id, serviceUserId]);
  }

  static async updateObservation(id: string, serviceUserId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    values.push(id, serviceUserId);
    const result = await query(`UPDATE health_observations SET ${fields.join(', ')} WHERE id = $${idx} AND service_user_id = $${idx + 1} RETURNING *`, values);
    return result.rows[0] || null;
  }

  // === Bowel Movements ===
  static async findBowelMovements(serviceUserId: string, dateFrom?: string, dateTo?: string) {
    let sql = `SELECT bm.*, u.email AS recorded_by_name FROM bowel_movements bm
      LEFT JOIN users u ON u.id = bm.recorded_by
      WHERE bm.service_user_id = $1`;
    const params: any[] = [serviceUserId];
    let idx = 2;
    if (dateFrom) { sql += ` AND bm.recorded_date >= $${idx}`; params.push(dateFrom); idx++; }
    if (dateTo) { sql += ` AND bm.recorded_date <= $${idx}`; params.push(dateTo); idx++; }
    sql += ' ORDER BY bm.recorded_date DESC, bm.recorded_time DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async createBowelMovement(data: any) {
    const { service_user_id, recorded_date, recorded_time, bristol_type, color, frequency, consistency, notes, recorded_by } = data;
    const result = await query(`
      INSERT INTO bowel_movements (service_user_id, recorded_date, recorded_time, bristol_type, color, frequency, consistency, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [service_user_id, recorded_date, recorded_time, bristol_type, color, frequency || 1, consistency, notes, recorded_by]);
    return result.rows[0];
  }

  static async deleteBowelMovement(id: string, serviceUserId: string) {
    await query('DELETE FROM bowel_movements WHERE id = $1 AND service_user_id = $2', [id, serviceUserId]);
  }

  static async updateBowelMovement(id: string, serviceUserId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    values.push(id, serviceUserId);
    const result = await query(`UPDATE bowel_movements SET ${fields.join(', ')} WHERE id = $${idx} AND service_user_id = $${idx + 1} RETURNING *`, values);
    return result.rows[0] || null;
  }

  // === Dental Records ===
  static async findDentalRecords(serviceUserId: string) {
    const result = await query(`
      SELECT dr.*, u.email AS recorded_by_name FROM dental_records dr
      LEFT JOIN users u ON u.id = dr.recorded_by
      WHERE dr.service_user_id = $1
      ORDER BY dr.checkup_date DESC
    `, [serviceUserId]);
    return result.rows;
  }

  static async createDentalRecord(data: any) {
    const { service_user_id, checkup_date, dentist_name, findings, actions_taken, next_checkup_date, notes, recorded_by } = data;
    const result = await query(`
      INSERT INTO dental_records (service_user_id, checkup_date, dentist_name, findings, actions_taken, next_checkup_date, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [service_user_id, checkup_date, dentist_name, findings, actions_taken, next_checkup_date, notes, recorded_by]);
    return result.rows[0];
  }

  static async deleteDentalRecord(id: string, serviceUserId: string) {
    await query('DELETE FROM dental_records WHERE id = $1 AND service_user_id = $2', [id, serviceUserId]);
  }

  static async updateDentalRecord(id: string, serviceUserId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    values.push(id, serviceUserId);
    const result = await query(`UPDATE dental_records SET ${fields.join(', ')} WHERE id = $${idx} AND service_user_id = $${idx + 1} RETURNING *`, values);
    return result.rows[0] || null;
  }

  // === Fluid Intake ===
  static async findFluidIntake(serviceUserId: string, date?: string) {
    let sql = `SELECT fi.*, u.email AS recorded_by_name FROM fluid_intake fi
      LEFT JOIN users u ON u.id = fi.recorded_by
      WHERE fi.service_user_id = $1`;
    const params: any[] = [serviceUserId];
    if (date) { sql += ' AND fi.recorded_date = $2'; params.push(date); }
    sql += ' ORDER BY fi.recorded_date DESC, fi.recorded_time DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async createFluidIntake(data: any) {
    const { service_user_id, recorded_date, recorded_time, amount_ml, fluid_type, notes, recorded_by } = data;
    const result = await query(`
      INSERT INTO fluid_intake (service_user_id, recorded_date, recorded_time, amount_ml, fluid_type, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [service_user_id, recorded_date, recorded_time, amount_ml, fluid_type, notes, recorded_by]);
    return result.rows[0];
  }

  static async getDailyFluidTotal(serviceUserId: string, date: string) {
    const result = await query(`
      SELECT COALESCE(SUM(amount_ml), 0)::int AS total_ml
      FROM fluid_intake
      WHERE service_user_id = $1 AND recorded_date = $2
    `, [serviceUserId, date]);
    return result.rows[0];
  }

  static async deleteFluidIntake(id: string, serviceUserId: string) {
    await query('DELETE FROM fluid_intake WHERE id = $1 AND service_user_id = $2', [id, serviceUserId]);
  }

  static async updateFluidIntake(id: string, serviceUserId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    values.push(id, serviceUserId);
    const result = await query(`UPDATE fluid_intake SET ${fields.join(', ')} WHERE id = $${idx} AND service_user_id = $${idx + 1} RETURNING *`, values);
    return result.rows[0] || null;
  }
}
