import { query } from '../../shared/database';

export interface ServiceUserRow {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  nhs_number?: string;
  room_number?: string;
  status: string;
  gp_name?: string;
  gp_surgery?: string;
  gp_phone?: string;
  gp_email?: string;
  gp_address?: string;
  dietary_requirements?: string;
  allergies: any[];
  support_level?: string;
  location_id?: string;
  min_staff_required?: number | null;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  pharmacy_address?: string;
  social_worker_name?: string;
  social_worker_phone?: string;
  social_worker_email?: string;
  photo_url?: string;
  gender?: string;
  pronouns?: string;
  marital_status?: string;
  religion?: string;
  communication_language?: string;
  communication_interpreter?: boolean;
  communication_method?: string;
  admission_date?: string;
  admission_source?: string;
  funding_type?: string;
  funding_details?: string;
  flags?: any[];
  tags?: any[];
  dnacpr_status?: string;
  dnacpr_date?: string;
  dnacpr_review_date?: string;
  dnacpr_details?: string;
  advance_decision?: string;
  advance_decision_date?: string;
  discharge_date?: string;
  discharge_reason?: string;
  discharge_summary?: string;
  discharge_destination?: string;
  created_at: string;
  updated_at?: string;
}

export interface CarePlanRow {
  id: string;
  service_user_id: string;
  title: string;
  category: string;
  description?: string;
  risk_assessment?: string;
  review_date?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: string;
  mobility_level?: string;
  mobility_aids?: string;
  communication_needs?: string;
  capacity_status?: string;
  sleep_pattern?: string;
  emergency_info?: string;
  personal_goals?: string;
  likes_dislikes?: string;
  cultural_needs?: string;
  file_url?: string;
  file_name?: string;
  sections?: any;
  version?: number;
  created_at: string;
}

export interface DailyNoteRow {
  id: string;
  service_user_id: string;
  author_id: string;
  note_date: string;
  shift: string;
  category: string;
  content: string;
  support_level?: string;
  created_at: string;
}

export interface RiskAssessmentRow {
  id: string;
  service_user_id: string;
  type: string;
  risk_level: string;
  details?: string;
  mitigation_actions?: string;
  review_date?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface FamilyContactRow {
  id: string;
  service_user_id: string;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  is_emergency_contact: boolean;
  created_at: string;
}

export interface CareAssessmentRow {
  id: string;
  organization_id: string;
  service_user_id: string;
  assessment_type: string;
  assessment_date: string;
  assessor_name?: string;
  findings?: string;
  recommendations?: string;
  status: string;
  next_review_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export class ServiceUserRepository {
  private static readonly DAILY_NOTE_UPDATE_COLUMNS = new Set(['note_date', 'shift', 'category', 'content', 'support_level']);
  private static readonly CLINICAL_SCORE_UPDATE_COLUMNS = new Set(['score_type', 'score', 'risk_level', 'recorded_date', 'notes']);
  private static readonly RISK_ASSESSMENT_UPDATE_COLUMNS = new Set(['type', 'risk_level', 'details', 'mitigation_actions', 'review_date', 'reviewed_by', 'reviewed_at']);
  private static readonly FAMILY_CONTACT_UPDATE_COLUMNS = new Set(['name', 'relationship', 'phone', 'email', 'is_emergency_contact']);
  private static readonly ASSESSMENT_UPDATE_COLUMNS = new Set(['assessment_type', 'assessment_date', 'assessor_name', 'findings', 'recommendations', 'status', 'next_review_date', 'updated_at']);
  private static readonly BODY_MAP_UPDATE_COLUMNS = new Set(['body_view', 'body_zone', 'zone_x', 'zone_y', 'condition_type', 'description', 'severity', 'recorded_date']);
  private static readonly MEMORY_BOOK_UPDATE_COLUMNS = new Set(['title', 'description', 'image_urls', 'recorded_date', 'support_level']);
  private static readonly CAPACITY_ASSESSMENT_UPDATE_COLUMNS = new Set(['assessment_date', 'decision_to_be_made', 'capacity_found', 'capacity_status', 'best_interest_decision', 'best_interest_meeting_date', 'independent_advocate', 'relevant_people_informed', 'review_date', 'updated_at']);
  private static readonly CARE_PATHWAY_UPDATE_COLUMNS = new Set(['pathway_type', 'title', 'start_date', 'end_date', 'location_name', 'referral_reason', 'discharge_notes', 'status', 'updated_at']);
  // ---- Service Users ----
  static async findAll(orgId: string, filters?: { status?: string; search?: string }) {
    let sql = `SELECT su.*, 
      (SELECT COUNT(*) FROM care_plans WHERE service_user_id = su.id AND status = 'active')::int AS active_care_plans,
      (SELECT COUNT(*) FROM risk_assessments WHERE service_user_id = su.id AND risk_level IN ('high','critical'))::int AS open_risks
      FROM service_users su WHERE su.organization_id = $1`;
    const params: any[] = [orgId];
    let idx = 2;
    if (filters?.status) { sql += ` AND su.status = $${idx++}`; params.push(filters.status); }
    if (filters?.search) { sql += ` AND (LOWER(su.first_name) LIKE LOWER($${idx}) OR LOWER(su.last_name) LIKE LOWER($${idx}) OR LOWER(su.room_number) LIKE LOWER($${idx}))`; params.push(`%${filters.search}%`); idx++; }
    sql += ' ORDER BY su.last_name, su.first_name';
    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id: string, orgId?: string) {
    const result = await query(`
      SELECT su.*,
        (SELECT json_agg(cp ORDER BY cp.created_at DESC) FROM care_plans cp WHERE cp.service_user_id = su.id) AS care_plans,
        (SELECT json_agg(sub) FROM (SELECT dn.*, sp.first_name || ' ' || sp.last_name AS author_name FROM daily_notes dn LEFT JOIN staff_profiles sp ON dn.author_id = sp.user_id WHERE dn.service_user_id = su.id ORDER BY dn.note_date DESC, dn.created_at DESC LIMIT 50) sub) AS recent_notes,
        (SELECT json_agg(ra ORDER BY ra.created_at DESC) FROM risk_assessments ra WHERE ra.service_user_id = su.id) AS risk_assessments,
        (SELECT json_agg(fc ORDER BY fc.name) FROM family_contacts fc WHERE fc.service_user_id = su.id) AS family_contacts
      FROM service_users su WHERE su.id = $1${orgId ? ' AND su.organization_id = $2' : ''}
    `, orgId ? [id, orgId] : [id]);
    return result.rows[0] || null;
  }

  static async create(data: Partial<ServiceUserRow>) {
    const { organization_id, first_name, last_name, date_of_birth, nhs_number, room_number, status, gp_name, gp_surgery, gp_phone, gp_email, gp_address, dietary_requirements, allergies, support_level, location_id, min_staff_required, pharmacy_name, pharmacy_phone, pharmacy_address, social_worker_name, social_worker_phone, social_worker_email, photo_url, gender, pronouns, marital_status, religion, communication_language, communication_interpreter, communication_method, admission_date, admission_source, funding_type, funding_details, flags, tags, dnacpr_status, dnacpr_date, dnacpr_review_date, dnacpr_details, advance_decision, advance_decision_date, discharge_date, discharge_reason, discharge_summary, discharge_destination } = data;
    const result = await query(
      `INSERT INTO service_users (organization_id, first_name, last_name, date_of_birth, nhs_number, room_number, status, gp_name, gp_surgery, gp_phone, gp_email, gp_address, dietary_requirements, allergies, support_level, location_id, min_staff_required, pharmacy_name, pharmacy_phone, pharmacy_address, social_worker_name, social_worker_phone, social_worker_email, photo_url, gender, pronouns, marital_status, religion, communication_language, communication_interpreter, communication_method, admission_date, admission_source, funding_type, funding_details, flags, tags, dnacpr_status, dnacpr_date, dnacpr_review_date, dnacpr_details, advance_decision, advance_decision_date, discharge_date, discharge_reason, discharge_summary, discharge_destination)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47) RETURNING *`,
      [organization_id, first_name, last_name, date_of_birth, nhs_number, room_number, status || 'active', gp_name, gp_surgery, gp_phone, gp_email || null, gp_address || null, dietary_requirements, typeof allergies === 'string' ? allergies : JSON.stringify(allergies ?? []), support_level || null, location_id || null, min_staff_required ?? null, pharmacy_name || null, pharmacy_phone || null, pharmacy_address || null, social_worker_name || null, social_worker_phone || null, social_worker_email || null, photo_url || null, gender || null, pronouns || null, marital_status || null, religion || null, communication_language || null, communication_interpreter ?? null, communication_method || null, admission_date || null, admission_source || null, funding_type || null, funding_details || null, typeof flags === 'string' ? flags : JSON.stringify(flags ?? []), typeof tags === 'string' ? tags : JSON.stringify(tags ?? []), dnacpr_status || null, dnacpr_date || null, dnacpr_review_date || null, dnacpr_details || null, advance_decision || null, advance_decision_date || null, discharge_date || null, discharge_reason || null, discharge_summary || null, discharge_destination || null]
    );
    return result.rows[0];
  }

  static async update(id: string, data: Partial<ServiceUserRow>, orgId?: string) {
    const ALLOWED_COLUMNS = new Set([
      'first_name', 'last_name', 'date_of_birth', 'nhs_number', 'room_number',
      'status', 'gp_name', 'gp_surgery', 'gp_phone', 'gp_email', 'gp_address',
      'dietary_requirements', 'allergies', 'support_level', 'location_id', 'min_staff_required',
      'pharmacy_name', 'pharmacy_phone', 'pharmacy_address',
      'social_worker_name', 'social_worker_phone', 'social_worker_email',
      'photo_url', 'updated_at',
      'gender', 'pronouns', 'marital_status', 'religion',
      'communication_language', 'communication_interpreter', 'communication_method',
      'admission_date', 'admission_source', 'funding_type', 'funding_details',
      'flags', 'tags',
      'dnacpr_status', 'dnacpr_date', 'dnacpr_review_date', 'dnacpr_details',
      'advance_decision', 'advance_decision_date',
      'discharge_date', 'discharge_reason', 'discharge_summary', 'discharge_destination',
    ]);
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const dateFields = new Set(['date_of_birth', 'review_date', 'recorded_date', 'resolved_date', 'check_date', 'reassessment_date', 'next_review_date', 'assessment_date']);
    const jsonFields = new Set(['allergies', 'flags', 'tags']);
    for (const [k, v] of Object.entries(data)) {
      if (!ALLOWED_COLUMNS.has(k)) continue;
      let val = dateFields.has(k) && v === '' ? null : v;
      if (jsonFields.has(k) && val !== null && val !== undefined) {
        val = typeof val === 'string' ? val : JSON.stringify(val);
      }
      fields.push(`${k} = $${idx++}`); params.push(val);
    }
    if (fields.length === 0) {
      const result = await query(`SELECT * FROM service_users WHERE id = $1${orgId ? ' AND organization_id = $2' : ''}`, orgId ? [id, orgId] : [id]);
      return result.rows[0] || null;
    }
    params.push(id);
    if (orgId) { params.push(orgId); }
    const result = await query(`UPDATE service_users SET ${fields.join(', ')} WHERE id = $${idx}${orgId ? ` AND organization_id = $${idx + 1}` : ''} RETURNING *`, params);
    return result.rows[0] || null;
  }

  // ---- Care Plans ----
  static async bulkUpdateStatus(ids: string[], status: string, orgId: string) {
    const result = await query(
      `UPDATE service_users SET status = $1, updated_at = NOW() WHERE id = ANY($2::uuid[]) AND organization_id = $3`,
      [status, ids, orgId]
    );
    return result;
  }

  static async deleteServiceUser(id: string) {
    await query('DELETE FROM service_users WHERE id = $1', [id]);
  }

  static async createCarePlan(data: Partial<CarePlanRow>) {
    const { service_user_id, title, category, description, risk_assessment, review_date, status,
            mobility_level, mobility_aids, communication_needs, capacity_status,
            sleep_pattern, emergency_info, personal_goals, likes_dislikes, cultural_needs, file_url, file_name, sections } = data;
    const result = await query(
      `INSERT INTO care_plans (service_user_id, title, category, description, risk_assessment, review_date, status,
        mobility_level, mobility_aids, communication_needs, capacity_status,
        sleep_pattern, emergency_info, personal_goals, likes_dislikes, cultural_needs, file_url, file_name, sections)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
       [service_user_id, title, category, description, risk_assessment, review_date || null, status || 'active',
       mobility_level || null, mobility_aids || null, communication_needs || null, capacity_status || null,
       sleep_pattern || null, emergency_info || null, personal_goals || null, likes_dislikes || null,
       cultural_needs || null, file_url || null, file_name || null, JSON.stringify(sections || {})]
    );
    return result.rows[0];
  }

  static async updateCarePlan(id: string, data: Partial<CarePlanRow>) {
    const ALLOWED = new Set(['title', 'category', 'description', 'risk_assessment', 'review_date', 'reviewed_by', 'reviewed_at', 'status',
      'mobility_level', 'mobility_aids', 'communication_needs', 'capacity_status',
      'sleep_pattern', 'emergency_info', 'personal_goals', 'likes_dislikes', 'cultural_needs', 'file_url', 'file_name', 'sections']);
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!ALLOWED.has(k)) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v === '' && (k === 'review_date') ? null : (k === 'sections' ? JSON.stringify(v) : v));
    }
    if (fields.length === 0) {
      const result = await query(`SELECT * FROM care_plans WHERE id = $1`, [id]);
      return result.rows[0] || null;
    }
    if (fields.length > 0) {
      fields.push('version = COALESCE(version, 0) + 1');
    }
    params.push(id);
    const result = await query(`UPDATE care_plans SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  // ---- Daily Notes ----
  static async createDailyNote(data: Partial<DailyNoteRow>) {
    const { service_user_id, author_id, note_date, shift, category, content, support_level } = data;
    const result = await query(
      `INSERT INTO daily_notes (service_user_id, author_id, note_date, shift, category, content, support_level) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [service_user_id, author_id, note_date || new Date().toISOString().split('T')[0], shift, category, content, support_level || null]
    );
    return result.rows[0];
  }

  static async updateDailyNote(id: string, data: any) {
    const fields: string[] = []; const values: any[] = []; let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (!ServiceUserRepository.DAILY_NOTE_UPDATE_COLUMNS.has(key)) continue;
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    values.push(id);
    const result = await query(`UPDATE daily_notes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return result.rows[0] || null;
  }

  static async getDailyNotes(serviceUserId: string, limit = 50) {
    const result = await query(
      `SELECT dn.*, (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dn.author_id) AS author_name
       FROM daily_notes dn WHERE dn.service_user_id = $1 ORDER BY dn.note_date DESC, dn.created_at DESC LIMIT $2`,
      [serviceUserId, limit]
    );
    return result.rows;
  }

  // ---- Risk Assessments ----
  static async createRiskAssessment(data: Partial<RiskAssessmentRow>) {
    const { service_user_id, type, risk_level, details, mitigation_actions, review_date } = data;
    const result = await query(
      `INSERT INTO risk_assessments (service_user_id, type, risk_level, details, mitigation_actions, review_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [service_user_id, type, risk_level, details, mitigation_actions, review_date]
    );
    return result.rows[0];
  }

  static async updateRiskAssessment(id: string, data: Partial<RiskAssessmentRow>) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const dateFields = new Set(['review_date', 'reassessment_date']);
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.RISK_ASSESSMENT_UPDATE_COLUMNS.has(k)) continue;
      const val = dateFields.has(k) && v === '' ? null : v;
      fields.push(`${k} = $${idx++}`); params.push(val);
    }
    params.push(id);
    const result = await query(`UPDATE risk_assessments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  // ---- Family Contacts ----
  static async createFamilyContact(data: Partial<FamilyContactRow>) {
    const { service_user_id, name, relationship, phone, email, is_emergency_contact } = data;
    const result = await query(
      `INSERT INTO family_contacts (service_user_id, name, relationship, phone, email, is_emergency_contact) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [service_user_id, name, relationship, phone, email, is_emergency_contact || false]
    );
    return result.rows[0];
  }

  static async updateFamilyContact(id: string, data: Partial<FamilyContactRow>) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.FAMILY_CONTACT_UPDATE_COLUMNS.has(k)) continue;
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }
    params.push(id);
    const result = await query(`UPDATE family_contacts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteFamilyContact(id: string) {
    await query('DELETE FROM family_contacts WHERE id = $1', [id]);
  }

  // ---- Care Assessments ----
  static async findAssessments(serviceUserId: string) {
    const result = await query(
      'SELECT * FROM care_assessments WHERE service_user_id = $1 ORDER BY assessment_date DESC',
      [serviceUserId]
    );
    return result.rows;
  }

  static async findAssessmentById(id: string) {
    const result = await query('SELECT * FROM care_assessments WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async createAssessment(orgId: string, data: any) {
    const { service_user_id, assessment_type, assessment_date, assessor_name, findings, recommendations, status, next_review_date, created_by } = data;
    const result = await query(
      `INSERT INTO care_assessments (organization_id, service_user_id, assessment_type, assessment_date, assessor_name, findings, recommendations, status, next_review_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [orgId, service_user_id, assessment_type, assessment_date || new Date().toISOString().split('T')[0], assessor_name || null, findings || null, recommendations || null, status || 'draft', next_review_date || null, created_by || null]
    );
    return result.rows[0];
  }

  static async updateAssessment(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const dateFields = new Set(['assessment_date', 'next_review_date', 'review_date']);
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.ASSESSMENT_UPDATE_COLUMNS.has(k)) continue;
      const val = dateFields.has(k) && v === '' ? null : v;
      fields.push(`${k} = $${idx++}`);
      params.push(val);
    }
    if (fields.length === 0) {
      const result = await query('SELECT * FROM care_assessments WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(`UPDATE care_assessments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteAssessment(id: string) {
    await query('DELETE FROM care_assessments WHERE id = $1', [id]);
  }

  // ---- Body Map Entries ----
  static async findBodyMapEntries(serviceUserId: string) {
    const result = await query(
      `SELECT bme.*, (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = bme.created_by) AS created_by_name
       FROM body_map_entries bme WHERE bme.service_user_id = $1 ORDER BY bme.recorded_date DESC, bme.created_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async findBodyMapEntryById(id: string) {
    const result = await query('SELECT * FROM body_map_entries WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async createBodyMapEntry(data: any) {
    const { service_user_id, body_view, body_zone, zone_x, zone_y, condition_type, description, severity, recorded_date, created_by } = data;
    const result = await query(
      `INSERT INTO body_map_entries (service_user_id, body_view, body_zone, zone_x, zone_y, condition_type, description, severity, recorded_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [service_user_id, body_view, body_zone, zone_x || null, zone_y || null, condition_type, description || null, severity || 'mild', recorded_date || new Date().toISOString().split('T')[0], created_by || null]
    );
    return result.rows[0];
  }

  static async updateBodyMapEntry(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const dateFields = new Set(['recorded_date', 'resolved_date']);
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.BODY_MAP_UPDATE_COLUMNS.has(k)) continue;
      const val = dateFields.has(k) && v === '' ? null : v;
      fields.push(`${k} = $${idx++}`); params.push(val);
    }
    if (fields.length === 0) {
      const result = await query('SELECT * FROM body_map_entries WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    fields.push('updated_at = NOW()');
    params.push(id);
    const result = await query(`UPDATE body_map_entries SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteBodyMapEntry(id: string) {
    await query('DELETE FROM body_map_entries WHERE id = $1', [id]);
  }

  // ---- Memory Book Entries ----
  static async findMemoryBookEntries(serviceUserId: string) {
    const result = await query(
      `SELECT mbe.*, (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = mbe.created_by) AS created_by_name
       FROM memory_book_entries mbe WHERE mbe.service_user_id = $1 ORDER BY mbe.recorded_date DESC, mbe.created_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createMemoryBookEntry(data: any) {
    const { service_user_id, title, description, image_url, image_urls, recorded_date, created_by, support_level } = data;
    const urls = image_urls && image_urls.length > 0 ? JSON.stringify(image_urls) : '[]';
    const result = await query(
      `INSERT INTO memory_book_entries (service_user_id, title, description, image_url, image_urls, recorded_date, created_by, support_level)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`,
      [service_user_id, title, description || null, image_url || null, urls, recorded_date || new Date().toISOString().split('T')[0], created_by || null, support_level || null]
    );
    return result.rows[0];
  }

  static async updateMemoryBookEntry(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    const dateFields = new Set(['recorded_date']);
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.MEMORY_BOOK_UPDATE_COLUMNS.has(k)) continue;
      const val = dateFields.has(k) && v === '' ? null : v;
      if (k === 'image_urls') {
        fields.push(`${k} = $${idx++}::jsonb`); params.push(JSON.stringify(v));
      } else {
        fields.push(`${k} = $${idx++}`); params.push(val);
      }
    }
    if (fields.length === 0) {
      const result = await query('SELECT * FROM memory_book_entries WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    fields.push('updated_at = NOW()');
    params.push(id);
    const result = await query(`UPDATE memory_book_entries SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteMemoryBookEntry(id: string) {
    await query('DELETE FROM memory_book_entries WHERE id = $1', [id]);
  }

  static async getTimeline(serviceUserId: string) {
    const result = await query(`
      SELECT event_type, event_label, description, details, performed_by, created_at FROM (
        SELECT 'admission' AS event_type, 'Admitted' AS event_label,
          CASE WHEN su.admission_source IS NOT NULL THEN 'Admitted from: ' || su.admission_source ELSE 'Admitted to service' END AS description,
          NULL AS details, NULL AS performed_by, su.created_at
        FROM service_users su WHERE su.id = $1
        UNION ALL
        SELECT 'care_plan' AS event_type, 'Care Plan: ' || cp.title,
          cp.description, NULL,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cp.reviewed_by),
          COALESCE(cp.reviewed_at, cp.created_at)
        FROM care_plans cp WHERE cp.service_user_id = $1
        UNION ALL
        SELECT 'daily_note' AS event_type, 'Daily Note (' || dn.category || ')',
          dn.content, NULL,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dn.author_id),
          dn.created_at
        FROM daily_notes dn WHERE dn.service_user_id = $1
        UNION ALL
        SELECT 'risk_assessment' AS event_type, 'Risk Assessment: ' || dn.type,
          dn.details, ('Risk level: ' || dn.risk_level || E'\\nMitigation: ' || COALESCE(dn.mitigation_actions, 'None')),
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dn.reviewed_by),
          COALESCE(dn.reviewed_at, dn.created_at)
        FROM risk_assessments dn WHERE dn.service_user_id = $1
        UNION ALL
        SELECT 'assessment' AS event_type, 'Care Assessment: ' || ca.assessment_type,
          ca.findings, ca.recommendations,
          ca.assessor_name, ca.created_at
        FROM care_assessments ca WHERE ca.service_user_id = $1
        UNION ALL
        SELECT 'health_observation' AS event_type, 'Health: ' || COALESCE(ho.category, 'Observation'),
          ho.notes, ('Severity: ' || COALESCE(ho.severity, 'normal')),
          (SELECT email FROM users WHERE id = ho.recorded_by), ho.created_at
        FROM health_observations ho WHERE ho.service_user_id = $1
        UNION ALL
        SELECT 'bowel_movement' AS event_type, 'Bowel Movement',
          ('Bristol Type ' || COALESCE(ho.bristol_type::text, 'N/A')),
          NULL,
          (SELECT email FROM users WHERE id = ho.recorded_by), (ho.recorded_date || ' ' || COALESCE(ho.recorded_time, '00:00:00'))::timestamp
        FROM bowel_movements ho WHERE ho.service_user_id = $1
        UNION ALL
        SELECT 'dental' AS event_type, 'Dental Check-up',
          ho.findings, NULL,
          (SELECT email FROM users WHERE id = ho.recorded_by), (ho.checkup_date::text)::timestamp
        FROM dental_records ho WHERE ho.service_user_id = $1
        UNION ALL
        SELECT 'fluid_intake' AS event_type, 'Fluid Intake',
          (ho.amount_ml::text || 'ml of ' || COALESCE(ho.fluid_type, 'fluid')),
          NULL,
          (SELECT email FROM users WHERE id = ho.recorded_by), (ho.recorded_date || ' ' || COALESCE(ho.recorded_time, '00:00:00'))::timestamp
        FROM fluid_intake ho WHERE ho.service_user_id = $1
        UNION ALL
        SELECT 'goal' AS event_type, 'Goal: ' || g.title,
          ('Progress: ' || g.progress || '%'),
          ('CQC domain: ' || COALESCE(g.cqc_domain, 'N/A')),
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = g.created_by),
          g.created_at
        FROM service_user_goals g WHERE g.service_user_id = $1
        UNION ALL
        SELECT 'body_map' AS event_type, 'Body Map: ' || COALESCE(bme.condition_type, 'Entry'),
          bme.description, ('Severity: ' || COALESCE(bme.severity, 'N/A')),
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = bme.created_by),
          bme.created_at
        FROM body_map_entries bme WHERE bme.service_user_id = $1
        UNION ALL
        SELECT 'memory_book' AS event_type, 'Memory: ' || mbe.title,
          mbe.description, NULL,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = mbe.created_by),
          mbe.created_at
        FROM memory_book_entries mbe WHERE mbe.service_user_id = $1
        UNION ALL
        SELECT 'clinical_score' AS event_type, 'Clinical Score: ' || cs.score_type,
          ('Score: ' || COALESCE(cs.score::text, 'N/A') || ' - ' || COALESCE(cs.risk_level, 'N/A')),
          cs.notes,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cs.recorded_by),
          (cs.recorded_date::text)::timestamp
        FROM clinical_scores cs WHERE cs.service_user_id = $1
        UNION ALL
        SELECT 'wellbeing' AS event_type, 'Wellbeing: ' || w.domain,
          ('Score: ' || w.score || '/10'),
          w.notes,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = w.recorded_by),
          w.created_at
        FROM su_wellbeing w WHERE w.service_user_id = $1
        UNION ALL
        SELECT 'communication' AS event_type, 'Communication: ' || cl.contact_method || ' ' || cl.direction,
          cl.summary,
          ('Follow-up: ' || COALESCE(cl.follow_up_actions, 'None')),
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cl.recorded_by),
          cl.created_at
        FROM su_communication_log cl WHERE cl.service_user_id = $1
        UNION ALL
        SELECT 'capacity' AS event_type, 'MCA Assessment',
          ('Decision: ' || ca2.decision_to_be_made),
          ('Capacity: ' || COALESCE(ca2.capacity_status, 'not_assessed')),
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = ca2.recorded_by),
          ca2.created_at
        FROM su_capacity_assessments ca2 WHERE ca2.service_user_id = $1
        UNION ALL
        SELECT 'care_pathway' AS event_type, 'Pathway: ' || cp2.title,
          (cp2.pathway_type || ': ' || COALESCE(cp2.location_name, 'N/A')),
          cp2.referral_reason,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cp2.recorded_by),
          cp2.created_at
        FROM su_care_pathways cp2 WHERE cp2.service_user_id = $1
        UNION ALL
        SELECT 'incident' AS event_type, 'Incident: ' || i.title,
          i.description,
          ('Severity: ' || COALESCE(i.severity, 'N/A')),
          NULL, i.created_at
        FROM incidents i WHERE EXISTS (SELECT 1 FROM incident_involved_residents iir WHERE iir.incident_id = i.id AND iir.service_user_id = $1)
        UNION ALL
        SELECT 'discharge_checklist' AS event_type, 'Discharge Checklist: ' || dc.item,
          CASE WHEN dc.is_complete THEN 'Completed' ELSE 'Pending' END,
          dc.category,
          (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dc.completed_by),
          dc.created_at
        FROM su_discharge_checklist dc WHERE dc.service_user_id = $1
      ) AS timeline
      ORDER BY created_at DESC
    `, [serviceUserId]);
    return result.rows;
  }

  // ---- Clinical Scores ----
  static async getClinicalScores(serviceUserId: string) {
    const result = await query(
      'SELECT cs.*, (SELECT first_name || \' \' || last_name FROM staff_profiles WHERE user_id = cs.recorded_by) AS recorded_by_name FROM clinical_scores cs WHERE cs.service_user_id = $1 ORDER BY cs.recorded_date DESC',
      [serviceUserId]
    );
    return result.rows;
  }

  static async createClinicalScore(data: any) {
    const { service_user_id, score_type, score, risk_level, recorded_date, notes, recorded_by } = data;
    const result = await query(
      `INSERT INTO clinical_scores (service_user_id, score_type, score, risk_level, recorded_date, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [service_user_id, score_type, score ?? null, risk_level || null, recorded_date || new Date().toISOString().split('T')[0], notes || null, recorded_by || null]
    );
    return result.rows[0];
  }

  static async deleteClinicalScore(id: string) {
    await query('DELETE FROM clinical_scores WHERE id = $1', [id]);
  }

  // ---- Service User Documents ----
  static async getDocuments(serviceUserId: string) {
    const result = await query(
      `SELECT sud.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = sud.uploaded_by) AS uploaded_by_name
       FROM service_user_documents sud WHERE sud.service_user_id = $1 ORDER BY sud.upload_date DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createDocument(data: any) {
    const { service_user_id, title, document_type, file_url, description, upload_date, uploaded_by } = data;
    const result = await query(
      `INSERT INTO service_user_documents (service_user_id, title, document_type, file_url, description, upload_date, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [service_user_id, title, document_type, file_url, description || null, upload_date || new Date().toISOString().split('T')[0], uploaded_by || null]
    );
    return result.rows[0];
  }

  static async deleteDocument(id: string) {
    await query('DELETE FROM service_user_documents WHERE id = $1', [id]);
  }

  static async updateClinicalScore(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.CLINICAL_SCORE_UPDATE_COLUMNS.has(k)) continue;
      if (v === undefined) continue;
      fields.push(`${k} = $${idx++}`); params.push(v);
    }
    if (fields.length === 0) return null;
    params.push(id);
    const result = await query(`UPDATE clinical_scores SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async findWellbeing(serviceUserId: string, days = 30) {
    const result = await query(
      `SELECT w.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = w.recorded_by) AS recorded_by_name
       FROM su_wellbeing w WHERE w.service_user_id = $1
       AND w.recorded_date >= CURRENT_DATE - $2::int
       ORDER BY w.recorded_date DESC, w.created_at DESC`,
      [serviceUserId, days]
    );
    return result.rows;
  }

  static async createWellbeing(data: any) {
    const { service_user_id, recorded_date, domain, score, notes, recorded_by } = data;
    const result = await query(
      `INSERT INTO su_wellbeing (service_user_id, recorded_date, domain, score, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [service_user_id, recorded_date || new Date().toISOString().split('T')[0], domain, score, notes || null, recorded_by || null]
    );
    return result.rows[0];
  }

  static async deleteWellbeing(id: string) {
    await query('DELETE FROM su_wellbeing WHERE id = $1', [id]);
  }

  static async findCommunicationLog(serviceUserId: string) {
    const result = await query(
      `SELECT cl.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cl.recorded_by) AS recorded_by_name
       FROM su_communication_log cl WHERE cl.service_user_id = $1
       ORDER BY cl.recorded_date DESC, cl.created_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createCommunicationLog(data: any) {
    const { service_user_id, contact_name, relationship, contact_method, direction, summary, follow_up_actions, recorded_date, recorded_by } = data;
    const result = await query(
      `INSERT INTO su_communication_log (service_user_id, contact_name, relationship, contact_method, direction, summary, follow_up_actions, recorded_date, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [service_user_id, contact_name || null, relationship || null, contact_method, direction, summary, follow_up_actions || null, recorded_date || new Date().toISOString().split('T')[0], recorded_by || null]
    );
    return result.rows[0];
  }

  static async deleteCommunicationLog(id: string) {
    await query('DELETE FROM su_communication_log WHERE id = $1', [id]);
  }

  static async findCapacityAssessments(serviceUserId: string) {
    const result = await query(
      `SELECT ca.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = ca.recorded_by) AS recorded_by_name
       FROM su_capacity_assessments ca WHERE ca.service_user_id = $1
       ORDER BY ca.assessment_date DESC, ca.created_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createCapacityAssessment(data: any) {
    const { service_user_id, assessment_date, decision_to_be_made, capacity_found, capacity_status, best_interest_decision, best_interest_meeting_date, independent_advocate, relevant_people_informed, review_date, recorded_by } = data;
    const result = await query(
      `INSERT INTO su_capacity_assessments (service_user_id, assessment_date, decision_to_be_made, capacity_found, capacity_status, best_interest_decision, best_interest_meeting_date, independent_advocate, relevant_people_informed, review_date, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [service_user_id, assessment_date || new Date().toISOString().split('T')[0], decision_to_be_made, capacity_found ?? null, capacity_status || null, best_interest_decision || null, best_interest_meeting_date || null, independent_advocate || null, relevant_people_informed || null, review_date || null, recorded_by || null]
    );
    return result.rows[0];
  }

  static async updateCapacityAssessment(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.CAPACITY_ASSESSMENT_UPDATE_COLUMNS.has(k)) continue;
      const val = v === '' ? null : v;
      fields.push(`${k} = $${idx++}`); params.push(val);
    }
    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(`UPDATE su_capacity_assessments SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteCapacityAssessment(id: string) {
    await query('DELETE FROM su_capacity_assessments WHERE id = $1', [id]);
  }

  static async findCarePathways(serviceUserId: string) {
    const result = await query(
      `SELECT cp.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cp.recorded_by) AS recorded_by_name
       FROM su_care_pathways cp WHERE cp.service_user_id = $1
       ORDER BY cp.start_date DESC, cp.created_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createCarePathway(data: any) {
    const { service_user_id, pathway_type, title, start_date, end_date, location_name, referral_reason, discharge_notes, status, recorded_by } = data;
    const result = await query(
      `INSERT INTO su_care_pathways (service_user_id, pathway_type, title, start_date, end_date, location_name, referral_reason, discharge_notes, status, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [service_user_id, pathway_type, title, start_date, end_date || null, location_name || null, referral_reason || null, discharge_notes || null, status || 'active', recorded_by || null]
    );
    return result.rows[0];
  }

  static async updateCarePathway(id: string, data: any) {
    const fields: string[] = []; const params: any[] = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (!ServiceUserRepository.CARE_PATHWAY_UPDATE_COLUMNS.has(k)) continue;
      const val = v === '' ? null : v;
      fields.push(`${k} = $${idx++}`); params.push(val);
    }
    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);
    params.push(id);
    const result = await query(`UPDATE su_care_pathways SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    return result.rows[0] || null;
  }

  static async deleteCarePathway(id: string) {
    await query('DELETE FROM su_care_pathways WHERE id = $1', [id]);
  }

  static async findDischargeChecklist(serviceUserId: string) {
    const result = await query(
      `SELECT dc.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dc.completed_by) AS completed_by_name
       FROM su_discharge_checklist dc WHERE dc.service_user_id = $1
       ORDER BY dc.category, dc.created_at`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async createDischargeChecklistItem(data: any) {
    const { service_user_id, item, category } = data;
    const result = await query(
      `INSERT INTO su_discharge_checklist (service_user_id, item, category) VALUES ($1,$2,$3) RETURNING *`,
      [service_user_id, item, category]
    );
    return result.rows[0];
  }

  static async updateDischargeChecklistItem(id: string, data: any) {
    const result = await query(
      `UPDATE su_discharge_checklist SET is_complete = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END, completed_by = CASE WHEN $1 THEN $2 ELSE NULL END WHERE id = $3 RETURNING *`,
      [data.is_complete, data.completed_by || null, id]
    );
    return result.rows[0] || null;
  }

  static async deleteDischargeChecklistItem(id: string) {
    await query('DELETE FROM su_discharge_checklist WHERE id = $1', [id]);
  }
}
