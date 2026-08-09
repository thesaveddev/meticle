import { query, transaction } from '../../shared/database';

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
  is_controlled_drug?: boolean;
  prescriber_name?: string | null;
  prescriber_phone?: string | null;
  prescription_ref?: string | null;
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

  /** Normalise a medication item's `times` value (JSONB array, JSON string or legacy text) into an array without ever throwing. */
  private static parseTimes(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === '') return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
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

  /** Find an active MAR item on a record with the same name/dosage/unit identity. */
  static async findActiveItemByName(recordId: string, name: string, dosage: string, unit: string) {
    const result = await query(`
      SELECT * FROM emedication_items
      WHERE emedication_record_id = $1
        AND LOWER(TRIM(name)) = LOWER(TRIM($2))
        AND COALESCE(LOWER(TRIM(dosage)), '') = COALESCE(LOWER(TRIM($3)), '')
        AND COALESCE(LOWER(TRIM(unit)), '') = COALESCE(LOWER(TRIM($4)), '')
        AND is_active = TRUE
      LIMIT 1`, [recordId, name, dosage, unit]);
    return result.rows[0] || null;
  }

  static async createItem(recordId: string, data: Partial<EMedicationItem> & { created_by: string }) {
    const result = await query(`
      INSERT INTO emedication_items (emedication_record_id, name, dosage, unit, route, frequency, times, instructions, is_prn, is_active, stock_item_id, start_date, end_date, is_controlled_drug, prescriber_name, prescriber_phone, prescription_ref, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [recordId, data.name, data.dosage, data.unit || 'mg', data.route || 'oral', data.frequency, JSON.stringify(data.times || []), data.instructions || '', data.is_prn || false, data.is_active !== false, data.stock_item_id || null, data.start_date || null, data.end_date || null, data.is_controlled_drug || false, data.prescriber_name || null, data.prescriber_phone || null, data.prescription_ref || null, data.created_by]
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
    if (data.stock_item_id !== undefined) { fields.push(`stock_item_id = $${idx++}`); values.push(data.stock_item_id); }
    if (data.is_controlled_drug !== undefined) { fields.push(`is_controlled_drug = $${idx++}`); values.push(data.is_controlled_drug); }
    if (data.prescriber_name !== undefined) { fields.push(`prescriber_name = $${idx++}`); values.push(data.prescriber_name); }
    if (data.prescriber_phone !== undefined) { fields.push(`prescriber_phone = $${idx++}`); values.push(data.prescriber_phone); }
    if (data.prescription_ref !== undefined) { fields.push(`prescription_ref = $${idx++}`); values.push(data.prescription_ref); }
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
  private static normalizeDate(value: any): string | null {
    return value === '' || value === null || value === undefined ? null : value;
  }

  static async createStockItem(orgId: string, data: any) {
    const result = await query(`
      INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit, reorder_level, location, person_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [orgId, data.medication_name, data.dosage, data.unit, data.batch_number, this.normalizeDate(data.expiry_date), data.quantity, data.quantity_unit, data.reorder_level, data.location, data.person_id || null]);
    return result.rows[0];
  }

  static async listStock(orgId: string, includeArchived = false, personId?: string) {
    const personName = `(SELECT first_name || ' ' || last_name FROM people WHERE id = emedication_stock.person_id) AS person_name`;
    const base = `SELECT emedication_stock.*, ${personName} FROM emedication_stock WHERE organization_id = $1`;
    const conditions: string[] = [];
    const params: any[] = [orgId];
    let idx = 2;
    if (!includeArchived) { conditions.push(`status = 'active'`); }
    if (personId) { conditions.push(`person_id = $${idx++}`); params.push(personId); }
    const where = conditions.length ? ` AND ${conditions.join(' AND ')}` : '';
    const sql = `${base}${where} ORDER BY medication_name`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async findStockById(id: string, orgId: string) {
    const result = await query(
      `SELECT emedication_stock.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = emedication_stock.person_id) AS person_name
       FROM emedication_stock WHERE id = $1 AND organization_id = $2`,
      [id, orgId]);
    return result.rows[0] || null;
  }

  static async updateStock(id: string, orgId: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!EMedicationRepository.STOCK_UPDATE_COLUMNS.has(k)) continue;
      if (v !== undefined) {
        const value = k === 'expiry_date' ? EMedicationRepository.normalizeDate(v) : v;
        fields.push(`${k} = $${idx++}`); values.push(value);
      }
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
    const direct = await query(
      `SELECT s.* FROM emedication_stock s
       JOIN emedication_items i ON i.stock_item_id = s.id
       WHERE i.id = $1 AND s.status = 'active'`,
      [itemId]);
    if (direct.rows[0]) return direct.rows[0];
    // Fallback for items not linked to a stock entry (e.g. imported from a previous month):
    // match an active stock record by medication identity + person.
    const fallback = await query(
      `SELECT s.* FROM emedication_stock s
       JOIN emedication_items i ON i.id = $1
       JOIN emedication_records r ON r.id = i.emedication_record_id
       WHERE s.status = 'active'
         AND s.organization_id = r.organization_id
         AND s.person_id = r.person_id
         AND s.medication_name = i.name
         AND s.dosage = i.dosage
         AND s.unit = i.unit
       LIMIT 1`,
      [itemId]);
    return fallback.rows[0] || null;
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
  static async findDailyCounts(orgId: string, personId?: string, countDate?: string, countSession?: string): Promise<any[]> {
    let sql = `
      SELECT dc.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = dc.person_id) AS person_name,
        (SELECT COUNT(*) FROM emedication_daily_count_items WHERE daily_count_id = dc.id)::int AS items_count,
        EXISTS(SELECT 1 FROM emedication_daily_count_items WHERE daily_count_id = dc.id AND escalate = TRUE) AS has_escalation
      FROM emedication_daily_counts dc
      WHERE dc.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (personId) { sql += ` AND dc.person_id = $${idx++}`; params.push(personId); }
    if (countDate) { sql += ` AND dc.count_date = $${idx++}`; params.push(countDate); }
    if (countSession) { sql += ` AND dc.count_session = $${idx++}`; params.push(countSession); }
    sql += ` ORDER BY dc.count_date DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async createDailyCount(orgId: string, data: any): Promise<any> {
    const session = data.count_session || 'end_of_day';
    const countedAt = data.counted_at || new Date().toISOString();
    const existing = await query(
      `SELECT * FROM emedication_daily_counts
       WHERE organization_id = $1 AND person_id = $2 AND count_date = $3 AND count_session = $4`,
      [orgId, data.person_id, data.count_date, session]);
    if (existing.rows.length > 0) {
      const result = await query(`
        UPDATE emedication_daily_counts
        SET staff_name = $1, matches_physical = $2, notes = $3, counted_at = COALESCE($4, counted_at)
        WHERE id = $5 RETURNING *`,
        [data.staff_name, data.matches_physical !== false, data.notes || null, countedAt, existing.rows[0].id]);
      return result.rows[0];
    }
    const result = await query(
      `INSERT INTO emedication_daily_counts (organization_id, person_id, count_date, count_session, staff_name, matches_physical, notes, counted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orgId, data.person_id, data.count_date, session, data.staff_name, data.matches_physical !== false, data.notes || null, countedAt]);
    return result.rows[0];
  }

  /**
   * Atomic save of a daily count and all its per-medication items in one
   * transaction. Replaces the whole count when one already exists for the
   * person/date/session. matches_physical is derived from the items so a
   * mismatched count can still be saved (with escalation flags) as required.
   */
  static async upsertDailyCountWithItems(orgId: string, data: any): Promise<any> {
    return transaction(async (client) => {
      const session = data.count_session || 'end_of_day';
      const countedAt = data.counted_at || new Date().toISOString();
      const itemsInput = data.items || [];
      const matches = itemsInput.length > 0
        ? itemsInput.every((it: any) => Number(it.actual_quantity) === Number(it.expected_quantity))
        : true;

      let count: any;
      const existing = await client.query(
        `SELECT id FROM emedication_daily_counts
         WHERE organization_id = $1 AND person_id = $2 AND count_date = $3 AND count_session = $4`,
        [orgId, data.person_id, data.count_date, session]);
      if (existing.rows.length > 0) {
        const upd = await client.query(`
          UPDATE emedication_daily_counts
          SET staff_name = $1, matches_physical = $2, notes = $3, counted_at = $4
          WHERE id = $5 RETURNING *`,
          [data.staff_name, matches, data.notes || null, countedAt, existing.rows[0].id]);
        count = upd.rows[0];
        await client.query(`DELETE FROM emedication_daily_count_items WHERE daily_count_id = $1`, [count.id]);
      } else {
        const ins = await client.query(
          `INSERT INTO emedication_daily_counts (organization_id, person_id, count_date, count_session, staff_name, matches_physical, notes, counted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [orgId, data.person_id, data.count_date, session, data.staff_name, matches, data.notes || null, countedAt]);
        count = ins.rows[0];
      }

      const savedItems: any[] = [];
      for (const it of itemsInput) {
        const r = await client.query(`
          INSERT INTO emedication_daily_count_items
            (daily_count_id, medication_item_id, medication_name, expected_quantity, actual_quantity, reason_for_mismatch, escalate)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [count.id, it.medication_item_id, it.medication_name, Number(it.expected_quantity) || 0, Number(it.actual_quantity) || 0, it.reason_for_mismatch || null, it.escalate || false]);
        savedItems.push(r.rows[0]);
      }

      return { ...count, items: savedItems };
    });
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

  /**
   * All active stock rows that back a given medication for a person:
   * same name/dosage/unit, scoped to the person OR shared stock (person_id NULL).
   * Used so the expected quantity in a daily count always matches the sum of the
   * rows shown in the Stock tab.
   */
  static async getStockRowsForMedication(orgId: string, name: string, dosage: string, unit: string, personId: string): Promise<any[]> {
    const result = await query(`
      SELECT id, quantity, quantity_unit, batch_number, expiry_date, person_id, status, reorder_level
      FROM emedication_stock
      WHERE organization_id = $1 AND status = 'active'
        AND LOWER(medication_name) = LOWER($2)
        AND COALESCE(LOWER(dosage), '') = COALESCE(LOWER($3), '')
        AND COALESCE(LOWER(unit), '') = COALESCE(LOWER($4), '')
        AND (person_id = $5 OR person_id IS NULL)
      ORDER BY created_at ASC`, [orgId, name, dosage, unit, personId]);
    return result.rows;
  }

  static async getMedicationExpectedQuantities(recordId: string, orgId: string): Promise<any[]> {
    const items = await this.findItems(recordId);
    const regularItems = items.filter((i: any) => !i.is_prn && i.is_active);
    const record = await this.findRecordById(recordId, orgId);
    const personId = record?.person_id;
    const result: any[] = [];
    for (const i of regularItems) {
      const rows = personId ? await this.getStockRowsForMedication(orgId, i.name, i.dosage, i.unit, personId) : [];
      const total = rows.reduce((sum: number, r: any) => sum + Number(r.quantity || 0), 0);
      result.push({
        medication_item_id: i.id,
        medication_name: i.name,
        dosage: i.dosage,
        unit: i.unit,
        times: this.parseTimes(i.times),
        stock_quantity: total,
        expected_quantity: Math.round(total),
        stock_rows: rows.length,
        stock_batches: rows.map((r: any) => ({ id: r.id, quantity: Number(r.quantity), quantity_unit: r.quantity_unit, batch_number: r.batch_number, expiry_date: r.expiry_date, person_id: r.person_id })),
        stock_low: rows.some((r: any) => Number(r.quantity) <= Number(r.reorder_level)),
      });
    }
    return result;
  }

  /** Aggregated medication list for a person across all their active records (deduped by identity). */
  static async getMedicationsForDailyCount(orgId: string, personId: string): Promise<any[]> {
    const records = await query(
      `SELECT id FROM emedication_records
       WHERE organization_id = $1 AND person_id = $2 AND status = 'active'
       ORDER BY start_date DESC`, [orgId, personId]);
    const seen = new Set<string>();
    const result: any[] = [];
    for (const r of records.rows) {
      const meds = await this.getMedicationExpectedQuantities(r.id, orgId);
      for (const m of meds) {
        const key = `${(m.medication_name || '').toLowerCase()}|${(m.dosage || '').toLowerCase()}|${(m.unit || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ ...m, record_id: r.id });
      }
    }
    return result;
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
  /**
   * Apply a delivered item to the org's stock ledger:
   * - an existing stock row (matched on name, then name+dosage+unit, scoped to the
   *   person when the delivery is person-scoped) gets the quantity added
   * - otherwise a new stock record is created
   * - a matching MAR item (if any, unlinked, for the person when scoped) is linked
   * Returns the stock row (or null when the item has no medication name).
   */
  private static async upsertStockForDeliveryItem(orgId: string, item: any, personId?: string | null): Promise<any | null> {
    const name = (item.medication_name || '').trim();
    if (!name) return null;
    const qty = Number(item.quantity) || 0;

    let match = await query(`
      SELECT * FROM emedication_stock
      WHERE organization_id = $1 AND LOWER(medication_name) = LOWER($2)
        AND COALESCE(LOWER(dosage), '') = COALESCE(LOWER($3), '')
        AND COALESCE(LOWER(unit), '') = COALESCE(LOWER($4), '')
        AND (person_id IS NOT DISTINCT FROM $5)
      ORDER BY created_at ASC LIMIT 1`,
      [orgId, name, item.dosage || '', item.unit || '', personId || null]);

    if (match.rows.length === 0) {
      match = await query(`
        SELECT * FROM emedication_stock
        WHERE organization_id = $1 AND LOWER(medication_name) = LOWER($2)
          AND (person_id IS NOT DISTINCT FROM $3)
        ORDER BY created_at ASC LIMIT 1`,
        [orgId, name, personId || null]);
    }

    if (match.rows.length > 0) {
      const stock = match.rows[0];
      await query(`
        UPDATE emedication_stock
        SET quantity = quantity + $1,
            batch_number = COALESCE($2, batch_number),
            expiry_date = COALESCE($3, expiry_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
        [qty, item.batch_number || null, item.expiry_date || null, stock.id]);
      return stock;
    }

    const created = await query(`
      INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit, reorder_level, status, person_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 'active', $9) RETURNING *`,
      [orgId, name, item.dosage || null, item.unit || 'mg', item.batch_number || null, item.expiry_date || null, qty, item.quantity_unit || 'tablet(s)', personId || null]);

    // Link the first active, unlinked MAR item with the same name (scoped to the person for person-scoped deliveries)
    await query(`
      UPDATE emedication_items ei
      SET stock_item_id = $1
      WHERE ei.id = (
        SELECT ei2.id FROM emedication_items ei2
        JOIN emedication_records r ON ei2.emedication_record_id = r.id
        WHERE r.organization_id = $2
          AND LOWER(ei2.name) = LOWER($3)
          AND ei2.stock_item_id IS NULL
          AND ei2.is_active = TRUE
          ${personId ? `AND r.person_id = $4` : ''}
        ORDER BY ei2.created_at ASC
        LIMIT 1
      )`,
      personId ? [created.rows[0].id, orgId, name, personId] : [created.rows[0].id, orgId, name]);

    return created.rows[0];
  }

  /** Locate the person's active MAR chart for the given month (YYYY-MM-DD). */
  static async findRecordForMonth(orgId: string, personId: string, date: string) {
    const d = new Date(date + 'T00:00:00');
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const title = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} MAR`;
    const result = await query(
      `SELECT * FROM emedication_records WHERE organization_id = $1 AND person_id = $2 AND title = $3 AND status = 'active'`,
      [orgId, personId, title]);
    return result.rows[0] || null;
  }

  /**
   * Apply a delivery item to stock, optionally creating a brand-new MAR medication.
   * When `item.new_medication` is present (and the delivery is person-scoped), a new
   * medication is added to the person's MAR chart and a linked person-scoped stock
   * record is created — so the delivery is reflected on both the MAR and the ledger.
   */
  private static async applyDeliveryItem(orgId: string, item: any, personId: string | null, userId: string, deliveryDate: string): Promise<{ stock: any; new_item_id?: string } | null> {
    if (item.new_medication && personId) {
      await this.ensureMonthlyMar(orgId, personId, userId);
      let record = await this.findRecordForMonth(orgId, personId, deliveryDate);
      if (!record) {
        const recs = await this.findRecords(orgId, personId);
        record = recs.find((r: any) => r.status === 'active') || null;
      }
      if (!record) throw new Error('No active MAR chart exists for this person. Create a chart first.');

      const med = item.new_medication;
      const createdItem = await this.createItem(record.id, {
        name: (item.medication_name || '').trim(),
        dosage: item.dosage || '',
        unit: item.unit || 'mg',
        route: med.route || 'oral',
        frequency: med.frequency,
        times: med.times || [],
        instructions: med.instructions || '',
        is_prn: med.is_prn || false,
        is_active: true,
        start_date: med.start_date || deliveryDate,
        end_date: med.end_date || null,
        is_controlled_drug: med.is_controlled_drug || false,
        prescriber_name: med.prescriber_name || null,
        prescriber_phone: med.prescriber_phone || null,
        prescription_ref: med.prescription_ref || null,
        created_by: userId,
      });

      const qty = Number(item.quantity) || 0;
      const stock = await query(`
        INSERT INTO emedication_stock (organization_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit, reorder_level, status, person_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 10, 'active', $9) RETURNING *`,
        [orgId, (item.medication_name || '').trim(), item.dosage || null, item.unit || 'mg', item.batch_number || null, item.expiry_date || null, qty, item.quantity_unit || 'tablet(s)', personId]);
      await this.updateItem(createdItem.id, { stock_item_id: stock.rows[0].id });
      return { stock: stock.rows[0], new_item_id: createdItem.id };
    }

    const stock = await this.upsertStockForDeliveryItem(orgId, item, personId);
    return { stock };
  }

  private static async insertDeliveryItem(deliveryId: string, item: any, stockId: string | null) {
    const result = await query(`
      INSERT INTO emedication_delivery_items (delivery_id, stock_id, medication_name, dosage, unit, batch_number, expiry_date, quantity, quantity_unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [deliveryId, stockId, item.medication_name, item.dosage, item.unit, item.batch_number, item.expiry_date || null, item.quantity, item.quantity_unit]);
    return result.rows[0];
  }

  private static async reverseDeliveryItemStock(deliveryItem: any) {
    if (deliveryItem.stock_id) {
      await query(`
        UPDATE emedication_stock SET quantity = GREATEST(0, quantity - $1), updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [deliveryItem.quantity, deliveryItem.stock_id]);
    }
  }

  static async createDelivery(orgId: string, data: any, userId: string) {
    const { supplier, delivery_note, delivery_date, received_by, notes, person_id, items } = data;
    return transaction(async () => {
      const delivery = await query(`
        INSERT INTO emedication_deliveries (organization_id, supplier, delivery_note, delivery_date, received_by, notes, person_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [orgId, supplier, delivery_note, delivery_date, received_by, notes, person_id || null]);
      const createdItems: any[] = [];
      if (items && items.length > 0) {
        for (const item of items) {
          const applied = await this.applyDeliveryItem(orgId, item, person_id || null, userId, delivery_date);
          createdItems.push(await this.insertDeliveryItem(delivery.rows[0].id, item, applied?.stock?.id || null));
        }
      }
      return { ...delivery.rows[0], items: createdItems };
    });
  }

  /**
   * Update a delivery: header fields plus a full reconciliation of its items.
   * Stock effects are reversed for the previous items, then every payload item is
   * re-applied (new medications included) so the ledger stays accurate.
   */
  static async updateDelivery(orgId: string, id: string, data: any, userId: string) {
    const { supplier, delivery_note, delivery_date, received_by, notes, person_id, items } = data;
    return transaction(async () => {
      const existing = await this.getDelivery(id, orgId);
      if (!existing) throw new Error('Delivery not found');

      for (const di of existing.items) {
        await this.reverseDeliveryItemStock(di);
      }
      await query(`DELETE FROM emedication_delivery_items WHERE delivery_id = $1`, [id]);

      const updated = await query(`
        UPDATE emedication_deliveries
        SET supplier = $1, delivery_note = $2, delivery_date = $3, received_by = $4,
            notes = $5, person_id = $6
        WHERE id = $7 AND organization_id = $8 RETURNING *`,
        [supplier, delivery_note, delivery_date, received_by, notes, person_id || null, id, orgId]);

      const createdItems: any[] = [];
      if (items && items.length > 0) {
        for (const item of items) {
          const applied = await this.applyDeliveryItem(orgId, item, person_id || null, userId, delivery_date);
          createdItems.push(await this.insertDeliveryItem(id, item, applied?.stock?.id || null));
        }
      }
      return { ...updated.rows[0], items: createdItems };
    });
  }

  static async deleteDelivery(orgId: string, id: string) {
    return transaction(async () => {
      const existing = await this.getDelivery(id, orgId);
      if (!existing) throw new Error('Delivery not found');
      for (const di of existing.items) {
        await this.reverseDeliveryItemStock(di);
      }
      await query(`DELETE FROM emedication_deliveries WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    });
  }

  static async listDeliveries(orgId: string) {
    const result = await query(`
      SELECT d.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = d.person_id) AS person_name,
        (SELECT COUNT(*) FROM emedication_delivery_items WHERE delivery_id = d.id)::int AS items_count
      FROM emedication_deliveries d
      WHERE d.organization_id = $1
      ORDER BY d.delivery_date DESC`, [orgId]);
    return result.rows;
  }

  static async getDelivery(id: string, orgId: string) {
    const delivery = await query(`
      SELECT d.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = d.person_id) AS person_name
      FROM emedication_deliveries d WHERE d.id = $1 AND d.organization_id = $2`, [id, orgId]);
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
