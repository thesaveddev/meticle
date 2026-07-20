import { query } from '../../shared/database';

export class AgenciesRepository {
  // ── Agencies ──
  static async getAll(orgId: string) {
    const result = await query(
      `SELECT a.*,
        (SELECT COUNT(*) FROM agency_workers WHERE agency_id = a.id AND status = 'active') as active_workers,
        (SELECT COUNT(*) FROM shifts WHERE agency_id = a.id) as total_shifts
       FROM agencies a WHERE a.organization_id = $1 ORDER BY a.name`,
      [orgId]
    );
    return result.rows;
  }

  static async getById(id: string, orgId: string) {
    const result = await query(
      `SELECT a.*,
        (SELECT COUNT(*) FROM agency_workers WHERE agency_id = a.id AND status = 'active') as active_workers,
        (SELECT COUNT(*) FROM shifts WHERE agency_id = a.id AND agency_covered = true) as completed_shifts,
        (SELECT COALESCE(SUM(agency_cost), 0) FROM shifts WHERE agency_id = a.id AND agency_covered = true) as total_spend
       FROM agencies a WHERE a.id = $1 AND a.organization_id = $2`,
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async create(data: {
    name: string; contact_name?: string; contact_phone?: string; contact_email?: string;
    address?: string; notes?: string; status?: string; contract_start_date?: string; contract_end_date?: string;
  }, orgId: string) {
    const result = await query(
      `INSERT INTO agencies (organization_id, name, contact_name, contact_phone, contact_email, address, notes, status, contract_start_date, contract_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [orgId, data.name, data.contact_name || null, data.contact_phone || null, data.contact_email || null,
       data.address || null, data.notes || null, data.status || 'active', data.contract_start_date || null, data.contract_end_date || null]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<{
    name: string; contact_name: string; contact_phone: string; contact_email: string;
    address: string; notes: string; status: string; contract_start_date: string; contract_end_date: string;
  }>, orgId: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }
    if (fields.length === 0) throw new Error('No fields to update');
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, orgId);
    const result = await query(
      `UPDATE agencies SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async delete(id: string, orgId: string) {
    const result = await query(
      'DELETE FROM agencies WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, orgId]
    );
    return result.rows.length > 0;
  }

  // ── Agency Workers ──
  static async getWorkers(agencyId: string, orgId: string) {
    const result = await query(
      `SELECT w.*, a.name as agency_name
       FROM agency_workers w JOIN agencies a ON w.agency_id = a.id
       WHERE w.agency_id = $1 AND a.organization_id = $2 ORDER BY w.first_name`,
      [agencyId, orgId]
    );
    return result.rows;
  }

  static async getAllWorkers(orgId: string) {
    const result = await query(
      `SELECT w.*, a.name as agency_name
       FROM agency_workers w JOIN agencies a ON w.agency_id = a.id
       WHERE a.organization_id = $1 ORDER BY a.name, w.first_name`,
      [orgId]
    );
    return result.rows;
  }

  static async getWorkerById(id: string, orgId: string) {
    const result = await query(
      `SELECT w.*, a.name as agency_name
       FROM agency_workers w JOIN agencies a ON w.agency_id = a.id
       WHERE w.id = $1 AND a.organization_id = $2`,
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async createWorker(data: {
    agency_id: string; first_name: string; last_name: string; role?: string;
    phone?: string; email?: string; dbs_check_date?: string; dbs_expiry_date?: string;
    mandatory_training_completed?: boolean; status?: string; rating?: number; notes?: string;
  }, orgId: string) {
    const result = await query(
      `INSERT INTO agency_workers (agency_id, organization_id, first_name, last_name, role, phone, email,
        dbs_check_date, dbs_expiry_date, mandatory_training_completed, status, rating, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [data.agency_id, orgId, data.first_name, data.last_name, data.role || null, data.phone || null, data.email || null,
       data.dbs_check_date || null, data.dbs_expiry_date || null, data.mandatory_training_completed || false,
       data.status || 'active', data.rating || null, data.notes || null]
    );
    return result.rows[0];
  }

  static async updateWorker(id: string, data: Partial<{
    first_name: string; last_name: string; role: string; phone: string; email: string;
    dbs_check_date: string; dbs_expiry_date: string; mandatory_training_completed: boolean;
    status: string; rating: number; notes: string;
  }>, orgId: string) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }
    if (fields.length === 0) throw new Error('No fields to update');
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, orgId);
    const result = await query(
      `UPDATE agency_workers w SET ${fields.join(', ')}
       FROM agencies a WHERE w.agency_id = a.id AND w.id = $${idx++} AND a.organization_id = $${idx} RETURNING w.*`,
      params
    );
    return result.rows[0] || null;
  }

  static async deleteWorker(id: string, orgId: string) {
    const result = await query(
      `DELETE FROM agency_workers w USING agencies a
       WHERE w.agency_id = a.id AND w.id = $1 AND a.organization_id = $2 RETURNING w.id`,
      [id, orgId]
    );
    return result.rows.length > 0;
  }

  // ── Agency Rates ──
  static async getRates(agencyId: string, orgId: string) {
    const result = await query(
      `SELECT r.* FROM agency_rates r JOIN agencies a ON r.agency_id = a.id
       WHERE r.agency_id = $1 AND a.organization_id = $2
       AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
       ORDER BY r.shift_type, r.effective_from DESC`,
      [agencyId, orgId]
    );
    return result.rows;
  }

  static async getAllRates(orgId: string) {
    const result = await query(
      `SELECT r.*, a.name as agency_name FROM agency_rates r JOIN agencies a ON r.agency_id = a.id
       WHERE a.organization_id = $1
       AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
       ORDER BY a.name, r.shift_type`,
      [orgId]
    );
    return result.rows;
  }

  static async upsertRate(data: {
    agency_id: string; shift_type: string; rate_per_hour: number; effective_from?: string; effective_to?: string;
  }, orgId: string) {
    const result = await query(
      `INSERT INTO agency_rates (agency_id, organization_id, shift_type, rate_per_hour, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.agency_id, orgId, data.shift_type, data.rate_per_hour, data.effective_from || new Date().toISOString().split('T')[0], data.effective_to || null]
    );
    return result.rows[0];
  }

  static async deleteRate(id: string, orgId: string) {
    const result = await query(
      `DELETE FROM agency_rates r USING agencies a
       WHERE r.agency_id = a.id AND r.id = $1 AND a.organization_id = $2 RETURNING r.id`,
      [id, orgId]
    );
    return result.rows.length > 0;
  }

  // ── Shift History ──
  static async getShiftHistory(orgId: string, filters?: { agency_id?: string; status?: string; date_from?: string; date_to?: string }) {
    let sql = `SELECT s.id, s.start_time, s.end_time, s.agency_cost, s.agency_status, s.agency_sent_at,
                      s.agency_check_in, s.agency_check_out, s.agency_contact_name, s.agency_contact_phone,
                      s.agency_covered,
                      l.name as location_name, a.name as agency_name,
                      w.first_name as worker_first_name, w.last_name as worker_last_name,
                      EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600 as hours,
                      COALESCE(o.default_hourly_rate, 12.00) as internal_hourly_rate
               FROM shifts s
               JOIN locations l ON s.location_id = l.id
               LEFT JOIN agencies a ON s.agency_id = a.id
               LEFT JOIN agency_workers w ON s.agency_worker_id = w.id
               JOIN organizations o ON l.organization_id = o.id
               WHERE l.organization_id = $1 AND s.agency_id IS NOT NULL`;
    const params: any[] = [orgId];
    let idx = 2;
    if (filters?.agency_id) { sql += ` AND s.agency_id = $${idx++}`; params.push(filters.agency_id); }
    if (filters?.status) { sql += ` AND s.agency_status = $${idx++}`; params.push(filters.status); }
    if (filters?.date_from) { sql += ` AND s.start_time >= $${idx++}`; params.push(filters.date_from); }
    if (filters?.date_to) { sql += ` AND s.end_time <= $${idx++}`; params.push(filters.date_to); }
    sql += ' ORDER BY s.start_time DESC LIMIT 500';
    const result = await query(sql, params);
    return result.rows;
  }

  // ── Analytics / Savings ──
  static async getSavings(orgId: string, dateFrom?: string, dateTo?: string) {
    let sql = `SELECT
        COUNT(*) as total_shifts,
        COUNT(*) FILTER (WHERE s.agency_covered = true) as completed_shifts,
        COALESCE(SUM(s.agency_cost), 0) as total_agency_cost,
        COALESCE(AVG(s.agency_cost / NULLIF(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600, 0)), 0) as avg_agency_hourly_rate,
        COALESCE(o.default_hourly_rate, 12.00) as internal_hourly_rate,
        COALESCE(SUM(
          (COALESCE(o.default_hourly_rate, 12.00) - (s.agency_cost / NULLIF(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600, 0)))
          * EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600
        ), 0) as net_savings
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      JOIN organizations o ON l.organization_id = o.id
      WHERE l.organization_id = $1 AND s.agency_id IS NOT NULL AND s.agency_covered = true`;
    const params: any[] = [orgId];
    let idx = 2;
    if (dateFrom) { sql += ` AND s.start_time >= $${idx++}`; params.push(dateFrom); }
    if (dateTo) { sql += ` AND s.end_time <= $${idx}`; params.push(dateTo); }
    sql += ` GROUP BY o.id, o.default_hourly_rate`;
    const result = await query(sql, params);
    return result.rows[0] || { total_shifts: 0, completed_shifts: 0, total_agency_cost: 0, avg_agency_hourly_rate: 0, internal_hourly_rate: 12, net_savings: 0 };
  }

  static async getSavingsByMonth(orgId: string, months: number = 6) {
    const result = await query(
      `SELECT
        DATE_TRUNC('month', s.start_time) as month,
        COUNT(*) as shifts,
        COALESCE(SUM(s.agency_cost), 0) as total_cost,
        COALESCE(SUM(
          (COALESCE(o.default_hourly_rate, 12.00) - (s.agency_cost / NULLIF(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600, 0)))
          * EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600
        ), 0) as net_savings
      FROM shifts s
      JOIN locations l ON s.location_id = l.id
      JOIN organizations o ON l.organization_id = o.id
      WHERE l.organization_id = $1 AND s.agency_id IS NOT NULL AND s.agency_covered = true
        AND s.start_time >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * $2)
      GROUP BY DATE_TRUNC('month', s.start_time)
      ORDER BY month DESC`,
      [orgId, months]
    );
    return result.rows;
  }

  static async getSavingsByAgency(orgId: string) {
    const result = await query(
      `SELECT a.id, a.name,
        COUNT(s.id) as shifts,
        COALESCE(SUM(s.agency_cost), 0) as total_cost,
        COALESCE(AVG(s.agency_cost / NULLIF(EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600, 0)), 0) as avg_rate,
        COALESCE(o.default_hourly_rate, 12.00) as internal_rate
      FROM agencies a
      LEFT JOIN shifts s ON s.agency_id = a.id AND s.agency_covered = true
      CROSS JOIN organizations o
      WHERE a.organization_id = $1 AND o.id = $1
      GROUP BY a.id, a.name, o.default_hourly_rate
      ORDER BY total_cost DESC`,
      [orgId]
    );
    return result.rows;
  }
}
