import { query } from '../../shared/database';

export interface EMedicationRecord {
  id: string;
  organization_id: string;
  person_id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EMedicationItem {
  id: string;
  emedication_record_id: string;
  name: string;
  dosage: string;
  unit: string;
  route: string;
  frequency: string;
  times: string[];
  instructions: string;
  is_prn: boolean;
  is_active: boolean;
  stock_item_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
}

export interface EMedicationAdministration {
  id: string;
  emedication_item_id: string;
  staff_id: string;
  scheduled_time: string;
  administered_time: string;
  status: string;
  notes: string;
  created_at: string;
}

export class EMedicationRepository {
  private static readonly STOCK_UPDATE_COLUMNS = new Set(['medication_name', 'dosage', 'unit', 'batch_number', 'expiry_date', 'quantity', 'quantity_unit', 'reorder_level', 'location', 'person_id', 'status']);
  // ── Records ──
  static async findRecords(orgId: string, personId?: string) {
    let sql = `
      SELECT r.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name
      FROM emedication_records r
      WHERE r.organization_id = $1`;
    const params: any[] = [orgId];
    if (personId) {
      sql += ` AND r.person_id = $2`;
      params.push(personId);
    }
    sql += ` ORDER BY r.start_date DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async findRecordById(id: string, orgId: string) {
    const result = await query(`
      SELECT r.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name
      FROM emedication_records r
      WHERE r.id = $1 AND r.organization_id = $2`, [id, orgId]);
    return result.rows[0] || null;
  }

  static async createRecord(orgId: string, data: Partial<EMedicationRecord> & { created_by: string }) {
    const result = await query(`
      INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [orgId, data.person_id, data.title, data.start_date, data.end_date, data.status || 'active', data.created_by]
    );
    return result.rows[0];
  }

  static async updateRecord(id: string, orgId: string, data: Partial<EMedicationRecord>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
    if (data.start_date !== undefined) { fields.push(`start_date = $${idx++}`); values.push(data.start_date); }
    if (data.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.end_date); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, orgId);
    const result = await query(`
      UPDATE emedication_records SET ${fields.join(', ')}
      WHERE id = $${idx++} AND organization_id = $${idx}
      RETURNING *`, values);
    return result.rows[0];
  }

  static async deleteRecord(id: string, orgId: string) {
    await query(`DELETE FROM emedication_records WHERE id = $1 AND organization_id = $2`, [id, orgId]);
  }

  // ── Items ──
  static async findItems(recordId: string) {
    const result = await query(`
      SELECT * FROM emedication_items
      WHERE emedication_record_id = $1
      ORDER BY is_prn ASC, name ASC`, [recordId]);
    return result.rows;
  }

  static async createItem(recordId: string, data: Partial<EMedicationItem> & { created_by: string }) {
    const result = await query(`
      INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, times, instructions, is_prn, is_active, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [recordId, data.name, data.dosage, data.unit || 'mg', data.route || 'oral', data.frequency, JSON.stringify(data.times || []), data.instructions || '', data.is_prn || false, data.is_active !== false, data.start_date || null, data.end_date || null, data.created_by]
    );
    return result.rows[0];
  }

  static async updateItem(id: string, data: Partial<EMedicationItem>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.dosage !== undefined) { fields.push(`dosage = $${idx++}`); values.push(data.dosage); }
    if (data.unit !== undefined) { fields.push(`unit = $${idx++}`); values.push(data.unit); }
    if (data.route !== undefined) { fields.push(`route = $${idx++}`); values.push(data.route); }
    if (data.frequency !== undefined) { fields.push(`frequency = $${idx++}`); values.push(data.frequency); }
    if (data.times !== undefined) { fields.push(`times = $${idx++}`); values.push(JSON.stringify(data.times)); }
    if (data.instructions !== undefined) { fields.push(`instructions = $${idx++}`); values.push(data.instructions); }
    if (data.is_prn !== undefined) { fields.push(`is_prn = $${idx++}`); values.push(data.is_prn); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }
    if (data.start_date !== undefined) { fields.push(`start_date = $${idx++}`); values.push(data.start_date || null); }
    if (data.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.end_date || null); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await query(`
      UPDATE emedication_items SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *`, values);
    return result.rows[0];
  }

  static async deleteItem(id: string): Promise<'deleted' | 'archived'> {
    const adminCount = await query(`SELECT COUNT(*)::int AS cnt FROM emedication_administrations WHERE emedication_item_id = $1`, [id]);
    if (adminCount.rows[0]?.cnt > 0) {
      await query(`UPDATE emedication_items SET is_active = false WHERE id = $1`, [id]);
      return 'archived';
    } else {
      await query(`DELETE FROM emedication_items WHERE id = $1`, [id]);
      return 'deleted';
    }
  }

  // ── Administrations ──
  static async findAdministrations(itemId: string, startDate?: string, endDate?: string) {
    let sql = `
      SELECT a.*, sp.first_name, sp.last_name, u.email, u.id AS user_id
      FROM emedication_administrations a
      LEFT JOIN staff_profiles sp ON a.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE a.emedication_item_id = $1`;
    const params: any[] = [itemId];
    if (startDate) {
      params.push(startDate);
      sql += ` AND a.scheduled_time >= $${params.length}::date`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND a.scheduled_time <= $${params.length}::date + interval '1 day'`;
    }
    sql += ` ORDER BY a.scheduled_time DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async findAdministrationsForItemIds(itemIds: string[], startDate: string, endDate: string) {
    if (itemIds.length === 0) return [];
    const result = await query(`
      SELECT a.*, sp.first_name, sp.last_name, u.id AS user_id
      FROM emedication_administrations a
      LEFT JOIN staff_profiles sp ON a.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE a.emedication_item_id = ANY($1::uuid[])
        AND a.scheduled_time >= $2::date
        AND a.scheduled_time <= $3::date + interval '1 day'
      ORDER BY a.scheduled_time ASC`, [itemIds, startDate, endDate]);
    return result.rows;
  }

  static async createAdministration(data: Partial<EMedicationAdministration> & { staff_id: string }) {
    const result = await query(`
      INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, administered_time, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [data.emedication_item_id, data.staff_id, data.scheduled_time, data.administered_time || null, data.status || 'pending', data.notes || '']
    );
    return result.rows[0];
  }

  static async upsertAdministration(data: {
    emedication_item_id: string;
    staff_id: string;
    scheduled_time: string;
    status: string;
    notes?: string;
    administered_time?: string;
    prn_reason?: string;
    prn_effectiveness?: string;
    wastage_amount?: string;
    wastage_reason?: string;
    batch_number?: string;
    expiry_date?: string;
  }) {
    const existing = await query(`
      SELECT id FROM emedication_administrations
      WHERE emedication_item_id = $1 AND scheduled_time = $2`,
      [data.emedication_item_id, data.scheduled_time]);
    if (existing.rows.length > 0) {
      const result = await query(`
        UPDATE emedication_administrations
        SET status = $1, administered_time = $2, notes = $3, staff_id = $4,
            prn_reason = $5, prn_effectiveness = $6, wastage_amount = $7, wastage_reason = $8, batch_number = $9, expiry_date = $10
        WHERE id = $11
        RETURNING *`,
        [data.status, data.administered_time || null, data.notes || '', data.staff_id,
         data.prn_reason || null, data.prn_effectiveness || null, data.wastage_amount || null, data.wastage_reason || null,
         data.batch_number || null, data.expiry_date || null, existing.rows[0].id]);
      return result.rows[0];
    }
    const result = await query(`
      INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, administered_time, status, notes,
        prn_reason, prn_effectiveness, wastage_amount, wastage_reason, batch_number, expiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [data.emedication_item_id, data.staff_id, data.scheduled_time, data.administered_time || null, data.status, data.notes || '',
       data.prn_reason || null, data.prn_effectiveness || null, data.wastage_amount || null, data.wastage_reason || null,
       data.batch_number || null, data.expiry_date || null]);
    return result.rows[0];
  }

  static async updateAdministration(id: string, data: Partial<EMedicationAdministration>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.administered_time !== undefined) { fields.push(`administered_time = $${idx++}`); values.push(data.administered_time); }
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
    values.push(id);
    const result = await query(`
      UPDATE emedication_administrations SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *`, values);
    return result.rows[0];
  }

  // ── MAR Chart ──
  static async getMarChart(recordId: string, orgId: string, referenceDate?: string) {
    const record = await this.findRecordById(recordId, orgId);
    if (!record) return null;
    const items = await this.findItems(recordId);
    if (items.length === 0) return { record, days: [], items: [], adminMap: {} };

    const ref = referenceDate ? new Date(referenceDate) : new Date();
    const chartStart = new Date(record.start_date);
    const chartEnd = new Date(record.end_date);
    const windowStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    if (windowStart < chartStart) windowStart.setTime(chartStart.getTime());
    const windowEnd = new Date(windowStart);
    windowEnd.setMonth(windowEnd.getMonth() + 1);
    windowEnd.setDate(windowEnd.getDate() - 1);
    if (windowEnd > chartEnd) windowEnd.setTime(chartEnd.getTime());

    const fmtLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const days: string[] = [];
    const cursor = new Date(windowStart);
    while (cursor <= windowEnd) {
      days.push(fmtLocal(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (days.length === 0) {
      days.push(fmtLocal(windowStart));
    }

    const itemIds = items.map((i: any) => i.id);

    const admins = itemIds.length > 0
      ? await this.findAdministrationsForItemIds(itemIds, days[0], days[days.length - 1])
      : [];

    const adminMap: Record<string, Record<string, any>> = {};
    for (const a of admins) {
      const adt = a.scheduled_time instanceof Date ? a.scheduled_time : new Date(a.scheduled_time);
      const dateKey = fmtLocal(adt);
      if (!adminMap[a.emedication_item_id]) adminMap[a.emedication_item_id] = {};
      if (!adminMap[a.emedication_item_id][dateKey]) adminMap[a.emedication_item_id][dateKey] = [];
      adminMap[a.emedication_item_id][dateKey].push(a);
    }
    return { record, days, items, adminMap };
  }

  // ── Overdue ──
  static async getOverdueAdministrations(orgId: string) {
    const result = await query(`
      SELECT a.*, mi.name AS medication_name, mi.dosage, mi.unit, mi.times,
             r.person_id, r.title AS chart_title,
             (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name,
             sp.first_name || ' ' || sp.last_name AS staff_name
      FROM emedication_administrations a
      JOIN emedication_items mi ON a.emedication_item_id = mi.id
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      LEFT JOIN staff_profiles sp ON a.staff_id = sp.id
      WHERE r.organization_id = $1
        AND r.status = 'active'
        AND mi.is_active = TRUE
        AND a.status = 'pending'
        AND a.scheduled_time < CURRENT_TIMESTAMP - interval '30 minutes'
      ORDER BY a.scheduled_time ASC
      LIMIT 50`, [orgId]);
    return result.rows;
  }

  static async getOverdueCount(orgId: string) {
    const result = await query(`
      SELECT COUNT(*)::int AS count
      FROM emedication_administrations a
      JOIN emedication_items mi ON a.emedication_item_id = mi.id
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      WHERE r.organization_id = $1
        AND r.status = 'active'
        AND mi.is_active = TRUE
        AND a.status = 'pending'
        AND a.scheduled_time < CURRENT_TIMESTAMP - interval '30 minutes'`, [orgId]);
    return result.rows[0]?.count || 0;
  }

  // ── Ensure monthly MAR exists ──
  static async ensureMonthlyMar(orgId: string, personId: string, userId: string) {
    const now = new Date();
    const existingTitles = await query(`
      SELECT title FROM emedication_records
      WHERE organization_id = $1 AND person_id = $2`,
      [orgId, personId]);
    const existingSet = new Set(existingTitles.rows.map(r => r.title));
    let created = 0;

    // Create/ensure from 2 months ago to 3 months ahead
    const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const label = `${MONTH_NAMES[m]} ${y}`;
      const title = `${label} MAR`;
      if (!existingSet.has(title)) {
        const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const monthEnd = new Date(y, m + 1, 0).toISOString().split('T')[0];
        await query(`
          INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, status, created_by)
          VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
          [orgId, personId, title, monthStart, monthEnd, userId]);
        created++;
      }
      cursor.setMonth(m + 1);
    }

    return { created };
  }

  // ── Archive previous month MARs (after 3rd of month) ──
  static async archivePreviousMonthMars(orgId: string) {
    const now = new Date();
    // After the 3rd of the month, archive last month's MARs
    if (now.getDate() <= 3) return 0;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const result = await query(`
      UPDATE emedication_records SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = $1
        AND status = 'active'
        AND end_date < $2`, [orgId, lastMonthEnd]);
    return result.rowCount || 0;
  }

  // ── Import medications from previous month ──
  static async importMedicationsFromPreviousMonth(recordId: string, orgId: string, userId: string) {
    const currentRecord = await this.findRecordById(recordId, orgId);
    if (!currentRecord) throw new Error('Record not found');

    // Find previous month's record for same person
    const prevMonthStart = new Date(currentRecord.start_date);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthLabel = prevMonthStart.toLocaleString('en', { month: 'long', year: 'numeric' });
    const prevTitle = `${prevMonthLabel} MAR`;

    const prevRecords = await query(
      `SELECT id FROM emedication_records
       WHERE organization_id = $1 AND person_id = $2 AND title = $3 AND status = 'active'`,
      [orgId, currentRecord.person_id, prevTitle]);
    if (prevRecords.rows.length === 0) return { imported: 0, message: 'No previous month record found' };

    const prevRecordId = prevRecords.rows[0].id;
    const prevItems = await this.findItems(prevRecordId);
    let imported = 0;
    for (const item of prevItems) {
      // Skip medications whose end_date is before the current record's start_date
      if (item.end_date && currentRecord.start_date && item.end_date < currentRecord.start_date) {
        continue;
      }
      // Check if item with same name already exists in current record
      const dupCheck = await query(
        `SELECT id FROM emedication_items WHERE emedication_record_id = $1 AND name = $2`,
        [recordId, item.name]);
      if (dupCheck.rows.length === 0) {
        await query(`
          INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, times, instructions, is_prn, is_active, start_date, end_date, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [recordId, item.name, item.dosage, item.unit, item.route, item.frequency,
           JSON.stringify(item.times), item.instructions || '', item.is_prn, item.is_active,
           item.start_date || null, item.end_date || null, userId]);
        imported++;
      }
    }
    return { imported, message: `Imported ${imported} medications from ${prevMonthLabel}` };
  }

  // ── Stock ──
  static async createStockItem(orgId: string, data: any) {
    const result = await query(`
      INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit, reorder_level, location, person_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [orgId, data.medication_name, data.dosage, data.unit, data.batch_number, data.expiry_date, data.quantity, data.quantity_unit, data.reorder_level, data.location, data.person_id || null]);
    return result.rows[0];
  }

  static async listStock(orgId: string, includeArchived = false) {
    const sql = includeArchived
      ? `SELECT * FROM emedication_stock WHERE organization_id = $1 ORDER BY medication_name`
      : `SELECT * FROM emedication_stock WHERE organization_id = $1 AND status = 'active' ORDER BY medication_name`;
    const result = await query(sql, [orgId]);
    return result.rows;
  }

  static async updateStock(id: string, orgId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!EMedicationRepository.STOCK_UPDATE_COLUMNS.has(k)) continue;
      if (v !== undefined) { fields.push(`${k} = $${idx++}`); values.push(v); }
    }
    if (fields.length === 0) return null;
    values.push(id, orgId);
    const result = await query(`UPDATE emedication_stock SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx++} AND organization_id = $${idx++} RETURNING *`, values);
    return result.rows[0] || null;
  }

  static async archiveStock(id: string, orgId: string) {
    const result = await query(`UPDATE emedication_stock SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2 RETURNING *`, [id, orgId]);
    return result.rows[0] || null;
  }

  static async deleteStock(id: string, orgId: string) {
    await query(`DELETE FROM emedication_stock WHERE id = $1 AND organization_id = $2`, [id, orgId]);
  }

  // ── Stock auto-creation (linked to medication item) ──
  static async findOrCreateStockForItem(orgId: string, personId: string, itemData: { name: string; dosage: string; unit: string }) {
    let existing = await query(
      `SELECT * FROM emedication_stock
       WHERE organization_id = $1 AND medication_name = $2 AND dosage = $3 AND unit = $4 AND person_id = $5`,
      [orgId, itemData.name, itemData.dosage, itemData.unit, personId]);
    if (existing.rows.length > 0) return existing.rows[0];
    const result = await query(
      `INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, quantity, quantity_unit, reorder_level, person_id)
       VALUES ($1, $2, $3, $4, 0, 'tablet(s)', 10, $5) RETURNING *`,
      [orgId, itemData.name, itemData.dosage, itemData.unit, personId]);
    return result.rows[0];
  }

  static async deductStockFromAdministration(stockItemId: string): Promise<{ id: string; quantity: number; reorder_level: number } | null> {
    const result = await query(
      `UPDATE emedication_stock SET quantity = GREATEST(0, quantity - 1)
       WHERE id = $1
       RETURNING id, quantity, reorder_level`,
      [stockItemId]);
    return result.rows[0] || null;
  }

  static async getStockForItem(itemId: string) {
    const result = await query(
      `SELECT s.* FROM emedication_stock s
       JOIN emedication_items i ON i.stock_item_id = s.id
       WHERE i.id = $1 AND s.status = 'active'`,
      [itemId]);
    return result.rows[0] || null;
  }

  static async getLowStockForOrg(orgId: string) {
    const result = await query(
      `SELECT s.id, s.medication_name, s.dosage, s.unit, s.quantity, s.reorder_level, s.quantity_unit,
              l.id AS location_id, l.name AS location_name,
              su.first_name || ' ' || su.last_name AS person_name
       FROM emedication_stock s
       JOIN people su ON su.id = s.person_id
       JOIN locations l ON l.id = su.location_id
       WHERE s.organization_id = $1
         AND s.status = 'active'
         AND s.quantity IS NOT NULL
         AND s.quantity <= s.reorder_level
       ORDER BY l.name, s.medication_name`,
      [orgId]);
    return result.rows;
  }

  // ── Daily Counts ──
  static async findDailyCounts(orgId: string, personId?: string): Promise<any[]> {
    let sql = `
      SELECT dc.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = dc.person_id) AS person_name,
        (SELECT COUNT(*) FROM emedication_daily_count_items WHERE daily_count_id = dc.id)::int AS items_count
      FROM emedication_daily_counts dc
      WHERE dc.organization_id = $1`;
    const params: any[] = [orgId];
    if (personId) {
      sql += ` AND dc.person_id = $2`;
      params.push(personId);
    }
    sql += ` ORDER BY dc.count_date DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async createDailyCount(orgId: string, data: any): Promise<any> {
    const result = await query(
      `INSERT INTO emedication_daily_counts (organization_id, person_id, count_date, staff_name, matches_physical, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, data.person_id, data.count_date, data.staff_name, data.matches_physical !== false, data.notes || null]);
    return result.rows[0];
  }

  // ── Daily Count Items (per-medication) ──
  static async findDailyCountItems(dailyCountId: string): Promise<any[]> {
    const result = await query(
      `SELECT * FROM emedication_daily_count_items WHERE daily_count_id = $1 ORDER BY medication_name`,
      [dailyCountId]);
    return result.rows;
  }

  static async upsertDailyCountItem(data: {
    daily_count_id: string;
    medication_item_id: string;
    medication_name: string;
    expected_quantity: number;
    actual_quantity: number;
    reason_for_mismatch?: string;
    escalate?: boolean;
  }): Promise<any> {
    const existing = await query(
      `SELECT id FROM emedication_daily_count_items WHERE daily_count_id = $1 AND medication_item_id = $2`,
      [data.daily_count_id, data.medication_item_id]);
    if (existing.rows.length > 0) {
      const result = await query(`
        UPDATE emedication_daily_count_items
        SET expected_quantity = $1, actual_quantity = $2, reason_for_mismatch = $3, escalate = $4
        WHERE id = $5 RETURNING *`,
        [data.expected_quantity, data.actual_quantity, data.reason_for_mismatch || null, data.escalate || false, existing.rows[0].id]);
      return result.rows[0];
    }
    const result = await query(`
      INSERT INTO emedication_daily_count_items (daily_count_id, medication_item_id, medication_name, expected_quantity, actual_quantity, reason_for_mismatch, escalate)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.daily_count_id, data.medication_item_id, data.medication_name, data.expected_quantity, data.actual_quantity, data.reason_for_mismatch || null, data.escalate || false]);
    return result.rows[0];
  }

  static async getMedicationExpectedQuantities(recordId: string): Promise<any[]> {
    const items = await this.findItems(recordId);
    const regularItems = items.filter((i: any) => !i.is_prn && i.is_active);
    return regularItems.map((i: any) => ({
      medication_item_id: i.id,
      medication_name: i.name,
      dosage: i.dosage,
      unit: i.unit,
      times: typeof i.times === 'string' ? JSON.parse(i.times) : (i.times || []),
      stock_quantity: 0
    }));
  }

  // ── Stock Adjustments ──
  static async findStockAdjustments(stockItemId: string): Promise<any[]> {
    const result = await query(
      `SELECT sa.*, s.medication_name, s.dosage, s.unit
       FROM emedication_stock_adjustments sa
       JOIN emedication_stock s ON s.id = sa.stock_item_id
       WHERE sa.stock_item_id = $1
       ORDER BY sa.created_at DESC`, [stockItemId]);
    return result.rows;
  }

  static async createStockAdjustment(orgId: string, data: any): Promise<any> {
    const result = await query(
      `INSERT INTO emedication_stock_adjustments (organization_id, stock_item_id, adjustment_type, quantity_adjusted, reason, adjusted_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, data.stock_item_id, data.adjustment_type, data.quantity_adjusted, data.reason || null, data.adjusted_by]);
    await query(
      `UPDATE emedication_stock SET quantity = GREATEST(0, quantity - $1) WHERE id = $2`,
      [data.quantity_adjusted, data.stock_item_id]);
    return result.rows[0];
  }

  // ── Deliveries ──
  static async createDelivery(orgId: string, data: any) {
    const { supplier, delivery_note, delivery_date, received_by, notes, items } = data;
    const delivery = await query(`
      INSERT INTO emedication_deliveries (organization_id, supplier, delivery_note, delivery_date, received_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, supplier, delivery_note, delivery_date, received_by, notes]);
    const createdItems: any[] = [];
    if (items && items.length > 0) {
      for (const item of items) {
        const di = await query(`
          INSERT INTO emedication_delivery_items (delivery_id, stock_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [delivery.rows[0].id, item.stock_id, item.medication_name, item.dosage, item.unit, item.batch_number, item.expiry_date, item.quantity, item.quantity_unit]);
        createdItems.push(di.rows[0]);
      }
    }
    return { ...delivery.rows[0], items: createdItems };
  }

  static async listDeliveries(orgId: string) {
    const result = await query(`SELECT * FROM emedication_deliveries WHERE organization_id = $1 ORDER BY delivery_date DESC`, [orgId]);
    return result.rows;
  }

  static async getDelivery(id: string, orgId: string) {
    const delivery = await query(`SELECT * FROM emedication_deliveries WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (delivery.rows.length === 0) return null;
    const items = await query(`SELECT * FROM emedication_delivery_items WHERE delivery_id = $1`, [id]);
    return { ...delivery.rows[0], items: items.rows };
  }
}

// ── Audit Log ──
export class EMedicationAuditRepository {
  static async log(data: {
    organization_id: string; action: string; entity_type: string; entity_id: string;
    user_id: string; changes: any; ip_address?: string;
  }) {
    try {
      await query(`
        INSERT INTO emedication_audit_log (organization_id, action, entity_type, entity_id, user_id, changes, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [data.organization_id, data.action, data.entity_type, data.entity_id, data.user_id, JSON.stringify(data.changes), data.ip_address || null]);
    } catch { /* audit failures never throw */ }
  }

  static async getLogs(orgId: string, entityType?: string, entityId?: string, limit = 100) {
    let sql = `SELECT al.*, u.email AS user_email,
      COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS user_name
      FROM emedication_audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE al.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (entityType) { sql += ` AND al.entity_type = $${idx++}`; params.push(entityType); }
    if (entityId) { sql += ` AND al.entity_id = $${idx++}`; params.push(entityId); }
    sql += ` ORDER BY al.created_at DESC LIMIT $${idx}`; params.push(limit);
    const result = await query(sql, params);
    return result.rows;
  }
}
