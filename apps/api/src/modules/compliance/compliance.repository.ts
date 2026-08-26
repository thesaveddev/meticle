import { query } from '../../shared/database';

const IDENTITY_TYPES = ['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK'];

export class ComplianceRepository {
  static async createDocument(data: any) {
    const { staff_id, type, url, expiry_date } = data;
    const result = await query(
      'INSERT INTO documents (staff_id, type, url, expiry_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [staff_id, type, url, expiry_date]
    );
    return result.rows[0];
  }

  static async getStaffCompliance(staffId: string) {
    const docs = await query('SELECT * FROM documents WHERE staff_id = $1', [staffId]);
    const records = await query('SELECT * FROM compliance_records WHERE staff_id = $1', [staffId]);
    return { documents: docs.rows, records: records.rows };
  }

  static async getExpiringDocuments(days: number = 30, orgId?: string) {
    const orgFilter = orgId ? ` JOIN users u ON sp.user_id = u.id AND u.organization_id = $2` : '';
    const params: any[] = [days];
    if (orgId) params.push(orgId);
    const result = await query(
      `SELECT d.*, sp.first_name, sp.last_name FROM documents d LEFT JOIN staff_profiles sp ON sp.id = d.staff_id${orgFilter} WHERE d.expiry_date <= CURRENT_DATE + interval '1 day' * $1 AND d.status != 'expired'`,
      params
    );
    return result.rows;
  }

  static async getAllDocuments(orgId?: string, page: number = 0, limit: number = 50) {
    const orgFilter = orgId ? ` JOIN users u ON sp.user_id = u.id AND u.organization_id = $1` : '';
    const params: any[] = orgId ? [orgId] : [];
    const offset = page * limit;
    const result = await query(
      `SELECT d.*, sp.first_name, sp.last_name FROM documents d LEFT JOIN staff_profiles sp ON sp.id = d.staff_id${orgFilter} ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return result.rows;
  }

  static async getIdentityDashboard(orgId: string) {
    // All active staff with their identity documents, grouped by staff
    const staff = await query(
      `SELECT sp.id, sp.first_name, sp.last_name, u.email
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'
       ORDER BY sp.first_name`,
      [orgId]
    );

    const docs = await query(
      `SELECT d.*, sp.first_name, sp.last_name
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND d.type = ANY($2)
       ORDER BY d.expiry_date`,
      [orgId, IDENTITY_TYPES]
    );

    // Build staff status overview
    const dashboard = staff.rows.map((s: any) => {
      const staffDocs = docs.rows.filter((d: any) => d.staff_id === s.id);
      const statuses: Record<string, any> = {};
      let hasExpiring = false, hasExpired = false, hasMissing = false;

      for (const type of IDENTITY_TYPES) {
        const doc = staffDocs.find((d: any) => d.type === type);
        if (!doc) {
          statuses[type] = { status: 'missing' };
          hasMissing = true;
        } else if (doc.expiry_date && new Date(doc.expiry_date) < new Date()) {
          statuses[type] = { status: 'expired', doc };
          hasExpired = true;
        } else if (doc.expiry_date && new Date(doc.expiry_date) <= new Date(Date.now() + 30 * 86400000)) {
          statuses[type] = { status: 'expiring', doc };
          hasExpiring = true;
        } else {
          statuses[type] = { status: 'valid', doc };
        }
      }

      return {
        ...s,
        documents: staffDocs,
        statuses,
        overall: hasExpired ? 'expired' : hasExpiring ? 'expiring' : hasMissing ? 'incomplete' : 'compliant'
      };
    });

    const counts = {
      compliant: dashboard.filter((s: any) => s.overall === 'compliant').length,
      incomplete: dashboard.filter((s: any) => s.overall === 'incomplete').length,
      expiring: dashboard.filter((s: any) => s.overall === 'expiring').length,
      expired: dashboard.filter((s: any) => s.overall === 'expired').length,
    };

    return { staff: dashboard, counts, total: staff.rows.length };
  }

  static async getEvidencePack(orgId: string, staffId?: string) {
    const staffFilter = staffId ? ' AND sp.id = $2' : '';
    const staffParams = staffId ? [orgId, staffId] : [orgId];

    const training = await query(
      `SELECT tr.*, tm.name as module_name, tm.category as module_category,
              sp.first_name, sp.last_name
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1${staffFilter}
       ORDER BY sp.last_name, tm.name`,
      staffParams
    );

    const documents = await query(
      `SELECT d.*, sp.first_name, sp.last_name
       FROM documents d
       JOIN staff_profiles sp ON d.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1${staffFilter}
       ORDER BY sp.last_name, d.type`,
      staffParams
    );

    const competency = await query(
      `SELECT ca.*, ct.name as template_name, ct.category as template_category,
              sp.first_name, sp.last_name, asp.first_name as assessor_first, asp.last_name as assessor_last
       FROM competency_assessments ca
       JOIN competency_templates ct ON ca.template_id = ct.id
       JOIN staff_profiles sp ON ca.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN users a ON ca.assessor_id = a.id
       LEFT JOIN staff_profiles asp ON a.id = asp.user_id
       WHERE u.organization_id = $1${staffFilter}
       ORDER BY sp.last_name, ca.assessed_at DESC`,
      staffParams
    );

    const staffSql = staffId
      ? `SELECT sp.id, sp.first_name, sp.last_name, u.email, cp.name as compliance_profile,
              (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0)
               FROM compliance_records cr WHERE cr.staff_id = sp.id) as compliance_rate
         FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         LEFT JOIN compliance_profiles cp ON sp.compliance_profile_id = cp.id
         WHERE u.organization_id = $1 AND u.status = 'active' AND sp.id = $2
         ORDER BY sp.last_name`
      : `SELECT sp.id, sp.first_name, sp.last_name, u.email, cp.name as compliance_profile,
              (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'complete')::numeric / NULLIF(COUNT(*), 0) * 100, 0)
               FROM compliance_records cr WHERE cr.staff_id = sp.id) as compliance_rate
         FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         LEFT JOIN compliance_profiles cp ON sp.compliance_profile_id = cp.id
         WHERE u.organization_id = $1 AND u.status = 'active'
         ORDER BY sp.last_name`;
    const staff = await query(staffSql, staffId ? [orgId, staffId] : [orgId]);

    // Person evidence
    const people = await query(
      `SELECT su.id, su.first_name, su.last_name, su.room_number, su.status,
              (SELECT COUNT(*) FROM care_plans WHERE person_id = su.id AND status = 'active')::int as active_care_plans,
              (SELECT COUNT(*) FROM risk_assessments WHERE person_id = su.id AND risk_level IN ('high','critical'))::int as open_risks,
              (SELECT COUNT(*) FROM person_goals WHERE person_id = su.id)::int as total_goals
       FROM people su
       WHERE su.organization_id = $1
       ORDER BY su.last_name, su.first_name`,
      [orgId]
    );

    const carePlans = await query(
      `SELECT cp.*, su.first_name, su.last_name
       FROM care_plans cp
       JOIN people su ON cp.person_id = su.id
       WHERE su.organization_id = $1
       ORDER BY su.last_name, cp.created_at DESC`,
      [orgId]
    );

    const incidents = await query(
      `SELECT i.id, i.title, i.severity, i.status, i.incident_date,
               string_agg(su.first_name || ' ' || su.last_name, ', ') as involved_people
        FROM incidents i
        LEFT JOIN incident_involved_residents iir ON i.id = iir.incident_id
        LEFT JOIN people su ON iir.person_id = su.id
        WHERE i.organization_id = $1
        GROUP BY i.id
        ORDER BY i.incident_date DESC
        LIMIT 50`,
      [orgId]
    );

    const satisfactionAgg = await query(
      `SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE rating >= 4)::int as positive
       FROM satisfaction_surveys
       WHERE organization_id = $1`,
      [orgId]
    );

    // Nutrition data for CQC evidence pack
    const nutrition = await query(
      `SELECT p.id, p.first_name || ' ' || p.last_name AS person_name,
        dp.dietary_type, dp.texture_modified, dp.appetite_level,
        dp.food_preferences, dp.food_dislikes, dp.other_allergies,
        dp.fluid_daily_target_ml, dp.vegetarian, dp.vegan, dp.halal,
        dp.kosher, dp.gluten_free, dp.dairy_free, dp.nut_allergy,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date >= CURRENT_DATE - interval '7 days')::int AS meals_last_7d,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date >= CURRENT_DATE - interval '7 days' AND mr.refused = true)::int AS refused_last_7d,
        (SELECT ROUND(AVG(consumed_percent)::numeric, 0) FROM meal_records mr
         WHERE mr.person_id = p.id AND mr.meal_date >= CURRENT_DATE - interval '7 days')::int AS avg_consumed_7d,
        (SELECT COALESCE(SUM(fluid_ml), 0) FROM meal_records mr
         WHERE mr.person_id = p.id AND mr.meal_date >= CURRENT_DATE - interval '7 days')::int AS total_fluid_7d,
        (SELECT COUNT(*) FROM meal_records mr
         WHERE mr.person_id = p.id AND mr.meal_date >= CURRENT_DATE - interval '7 days' AND mr.staff_concerns IS NOT NULL)::int AS nutrition_concerns_7d
       FROM people p
       LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
       WHERE p.organization_id = $1 AND p.status = 'active'
       ORDER BY p.last_name, p.first_name`,
      [orgId]
    );

    let mappings: any[] = [];
    try {
      mappings = (await query('SELECT * FROM evidence_mappings WHERE organization_id = $1', [orgId])).rows;
    } catch { /* table may not exist yet */ }

    return {
      generated_at: new Date().toISOString(),
      mappings,
      staff: staff.rows,
      training: training.rows,
      documents: documents.rows,
      competency: competency.rows,
      people: people.rows,
      care_plans: carePlans.rows,
      incidents: incidents.rows,
      nutrition: nutrition.rows,
      satisfaction: satisfactionAgg.rows[0] || { avg_rating: null, total: 0, positive: 0 },
      summary: {
        total_staff: staff.rows.length,
        total_people: people.rows.length,
        active_people: people.rows.filter((r: any) => r.status === 'active').length,
        training_records: training.rows.length,
        documents: documents.rows.length,
        competency_records: competency.rows.length,
        incidents: incidents.rows.length,
        people_with_dietary_profiles: nutrition.rows.filter((r: any) => r.dietary_type).length,
        people_with_nutrition_concerns: nutrition.rows.filter((r: any) => (r.nutrition_concerns_7d || 0) > 0).length,
        satisfaction_avg: satisfactionAgg.rows[0]?.avg_rating || null,
      }
    };
  }

  static async updateDocumentStatus(id: string, orgId: string, status: string) {
    const result = await query(
      `UPDATE documents d SET status = $1
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       WHERE d.id = $2 AND d.staff_id = sp.id AND u.organization_id = $3
       RETURNING d.*`,
      [status, id, orgId]
    );
    return result.rows[0] || null;
  }

  static async updateRecord(id: string, staffId: string, data: { status?: string; notes?: string; last_checked_at?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
    if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
    if (data.last_checked_at !== undefined) { fields.push(`last_checked_at = $${idx++}`); values.push(data.last_checked_at); }
    if (fields.length === 0) return null;
    values.push(id, staffId);
    const result = await query(
      `UPDATE compliance_records SET ${fields.join(', ')} WHERE id = $${idx++} AND staff_id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  // ---- Evidence Mappings ----
  static async getEvidenceMappings(orgId: string) {
    const result = await query(
      `SELECT * FROM evidence_mappings WHERE organization_id = $1 ORDER BY source_type, source_category`,
      [orgId]
    );
    return result.rows;
  }

  static async upsertEvidenceMapping(orgId: string, data: { source_type: string; source_category?: string; target_domain: string }) {
    const cat = data.source_category || '';
    const result = await query(
      `INSERT INTO evidence_mappings (organization_id, source_type, source_category, target_domain)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, source_type, COALESCE(source_category, ''))
       DO UPDATE SET target_domain = EXCLUDED.target_domain
       RETURNING *`,
      [orgId, data.source_type, cat || null, data.target_domain]
    );
    return result.rows[0];
  }

  static async deleteEvidenceMapping(id: string, orgId: string) {
    const result = await query('DELETE FROM evidence_mappings WHERE id = $1 AND organization_id = $2 RETURNING id', [id, orgId]);
    return result.rows[0] || null;
  }

  /** Map a source item to a CQC domain using org config, falling back to built-in defaults */
  static resolveDomain(mappings: any[], sourceType: string, category: string, fallback: string): string {
    const exact = mappings.find((m: any) => m.source_type === sourceType && m.source_category === category);
    if (exact) return exact.target_domain;
    const wildcard = mappings.find((m: any) => m.source_type === sourceType && !m.source_category);
    if (wildcard) return wildcard.target_domain;
    return fallback;
  }

  /** Auto-assign compliance records from profiles to all active staff */
  static async seedRecords(orgId: string): Promise<number> {
    const profiles = await query(
      `SELECT cp.id as profile_id, cp.name, cp.role_name,
              array_agg(cpr.requirement_id) as requirement_ids
       FROM compliance_profiles cp
       JOIN compliance_profile_requirements cpr ON cp.id = cpr.profile_id
       WHERE cp.organization_id = $1
       GROUP BY cp.id`,
      [orgId]
    );

    let count = 0;
    for (const profile of profiles.rows) {
      const staff = await query(
        `SELECT sp.id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role = $2 AND u.status = 'active'`,
        [orgId, profile.role_name]
      );

      for (const s of staff.rows) {
        for (const reqId of profile.requirement_ids || []) {
          try {
            await query(
              `INSERT INTO compliance_records (staff_id, requirement_id, status)
               VALUES ($1, $2, 'incomplete')
               ON CONFLICT (staff_id, requirement_id) DO NOTHING`,
              [s.id, reqId]
            );
            count++;
          } catch { /* skip conflicts */ }
        }
      }
    }
    return count;
  }
}
