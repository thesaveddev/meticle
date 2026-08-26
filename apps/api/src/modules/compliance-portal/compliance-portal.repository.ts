import { query } from '../../shared/database';

export class CompliancePortalRepository {
  // ── Token Management ──

  static async createToken(data: {
    organization_id: string;
    location_id: string;
    officer_name: string;
    email: string;
    expires_hours: number;
    created_by: string;
  }) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expires_hours);

    const result = await query(
      `INSERT INTO compliance_portal_tokens
        (organization_id, location_id, officer_name, email, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.organization_id, data.location_id, data.officer_name, data.email, expiresAt.toISOString(), data.created_by]
    );
    return result.rows[0];
  }

  static async revokeToken(id: string, orgId: string) {
    const result = await query(
      `UPDATE compliance_portal_tokens SET revoked = true, revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, orgId]
    );
    return result.rows[0] || null;
  }

  static async listTokens(orgId: string) {
    const result = await query(
      `SELECT cpt.*, l.name as location_name,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = cpt.created_by) AS created_by_name
       FROM compliance_portal_tokens cpt
       JOIN locations l ON l.id = cpt.location_id
       WHERE cpt.organization_id = $1
       ORDER BY cpt.created_at DESC`,
      [orgId]
    );
    return result.rows;
  }

  // ── Audit Dashboard (location-scoped, read-only) ──

  static async getComplianceOverview(orgId: string, locationId: string) {
    // Staff compliance at this location
    const staffCompliance = await query(`
      SELECT u.id as user_id, sp.first_name || ' ' || sp.last_name AS name,
        COALESCE(
          (SELECT ROUND(AVG(CASE WHEN cr.status = 'complete' THEN 100.0
                WHEN cr.status = 'expired' THEN 0.0
                WHEN cr.status = 'pending_review' THEN 50.0
                ELSE 25.0 END), 0) FROM compliance_records cr
           WHERE cr.staff_id = sp.id),
          0
        )::int AS score,
        (SELECT COUNT(*)::int FROM compliance_records cr WHERE cr.staff_id = sp.id AND cr.status = 'complete') AS completed,
        (SELECT COUNT(*)::int FROM compliance_records cr WHERE cr.staff_id = sp.id AND cr.status != 'complete') AS incomplete,
        (SELECT COUNT(*)::int FROM compliance_records cr WHERE cr.staff_id = sp.id
         AND cr.expires_at IS NOT NULL AND cr.expires_at < CURRENT_DATE + interval '30 days'
         AND cr.status = 'complete') AS expiring_soon
      FROM users u
      JOIN staff_profiles sp ON sp.user_id = u.id
      JOIN departments d ON d.id = sp.department_id
      JOIN locations l ON l.id = d.location_id
      WHERE u.organization_id = $1 AND l.id = $2 AND u.status = 'active'
      ORDER BY score ASC, sp.first_name
    `, [orgId, locationId]);

    // Overall compliance percentage
    const overallScore = staffCompliance.rows.length > 0
      ? Math.round(staffCompliance.rows.reduce((sum: number, r: any) => sum + r.score, 0) / staffCompliance.rows.length)
      : 0;

    // Training records expiring soon
    const expiringTraining = await query(`
      SELECT tr.id, tm.name AS module_name, sp.first_name || ' ' || sp.last_name AS staff_name,
        tr.expires_at, tr.status
      FROM training_records tr
      JOIN training_modules tm ON tr.module_id = tm.id
      JOIN staff_profiles sp ON tr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN departments d ON d.id = sp.department_id
      JOIN locations l ON l.id = d.location_id
      WHERE u.organization_id = $1 AND l.id = $2
        AND tr.expires_at IS NOT NULL
        AND tr.expires_at <= CURRENT_DATE + interval '30 days'
        AND tr.status = 'completed'
      ORDER BY tr.expires_at ASC
    `, [orgId, locationId]);

    // Open incidents at this location
    const openIncidents = await query(`
      SELECT i.id, i.title, i.severity, i.status, i.incident_date, i.location,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = i.reported_by) AS reported_by
      FROM incidents i
      WHERE i.organization_id = $1
        AND i.status IN ('reported', 'investigating')
        AND (i.location = (SELECT name FROM locations WHERE id = $2) OR i.location IS NULL)
      ORDER BY
        CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        i.incident_date DESC
    `, [orgId, locationId]);

    // People at this location
    const people = await query(`
      SELECT p.id, p.first_name, p.last_name, p.room_number, p.status, p.dietary_requirements, p.allergies,
        (SELECT COUNT(*) FROM care_plans cp WHERE cp.person_id = p.id AND cp.status = 'active')::int AS active_care_plans,
        (SELECT COUNT(*) FROM emedication_records er WHERE er.person_id = p.id AND er.status = 'active')::int AS active_mar,
        (SELECT COUNT(*) FROM incidents i JOIN incident_involved_residents iir ON iir.incident_id = i.id
         WHERE iir.person_id = p.id AND i.status IN ('reported','investigating'))::int AS open_incidents
      FROM people p
      WHERE p.location_id = $2 AND p.organization_id = $1 AND p.status = 'active'
      ORDER BY p.last_name, p.first_name
    `, [orgId, locationId]);

    // Compliance records summary by status
    const recordsByStatus = await query(`
      SELECT cr.status, COUNT(*)::int as count
      FROM compliance_records cr
      JOIN staff_profiles sp ON cr.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      JOIN departments d ON d.id = sp.department_id
      JOIN locations l ON l.id = d.location_id
      WHERE u.organization_id = $1 AND l.id = $2
      GROUP BY cr.status
    `, [orgId, locationId]);

    // Policies
    const policies = await query(`
      SELECT id, title, category, status, version, review_due_at
      FROM policies
      WHERE organization_id = $1
      ORDER BY category, title
    `, [orgId]);

    // Location info
    const location = await query(
      `SELECT id, name, address, service_type, cqc_rating, last_cqc_inspection, food_hygiene_rating
       FROM locations WHERE id = $1 AND organization_id = $2`,
      [locationId, orgId]
    );

    // Nutrition overview for this location
    const nutrition = await query(`
      SELECT p.id, p.first_name || ' ' || p.last_name AS person_name,
        dp.appetite_level, dp.dietary_type, dp.texture_modified,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date = CURRENT_DATE) ::int AS meals_today,
        (SELECT COUNT(*) FROM meal_records mr WHERE mr.person_id = p.id
         AND mr.meal_date = CURRENT_DATE AND mr.refused = true) ::int AS refused_today,
        (SELECT COALESCE(SUM(mr.fluid_ml), 0) FROM meal_records mr
         WHERE mr.person_id = p.id AND mr.meal_date = CURRENT_DATE) ::int AS fluid_today,
        dp.fluid_daily_target_ml
      FROM people p
      LEFT JOIN dietary_profiles dp ON dp.person_id = p.id
      WHERE p.location_id = $2 AND p.organization_id = $1 AND p.status = 'active'
      ORDER BY p.last_name, p.first_name
    `, [orgId, locationId]);

    // Nutrition alerts for this location (low intake, refused meals, appetite decline)
    const nutritionAlerts = await query(`
      SELECT na.id, na.alert_type, na.severity, na.title, na.message, na.created_at, na.dismissed,
        p.id AS person_id, p.first_name || ' ' || p.last_name AS person_name,
        p.room_number
      FROM mission_control_alerts na
      JOIN people p ON na.person_id = p.id
      WHERE na.organization_id = $1
        AND p.location_id = $2
        AND na.alert_type IN ('nutrition.appetite_decline', 'nutrition.refused_meal', 'fluid.intake_below_target')
        AND na.dismissed = FALSE
      ORDER BY
        CASE na.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        na.created_at DESC
      LIMIT 25
    `, [orgId, locationId]);

    // MAR records at this location (recent)
    const recentMar = await query(`
      SELECT a.id, a.status, a.scheduled_time, a.administered_time,
        mi.name AS medication_name, mi.dosage, mi.unit,
        r.person_id,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name
      FROM emedication_administrations a
      JOIN emedication_items mi ON a.emedication_item_id = mi.id
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      WHERE r.organization_id = $1 AND r.person_id IN
        (SELECT id FROM people WHERE location_id = $2 AND organization_id = $1)
        AND a.scheduled_time >= CURRENT_DATE - interval '7 days'
      ORDER BY a.scheduled_time DESC
      LIMIT 50
    `, [orgId, locationId]);

    return {
      overallScore,
      staffCompliance: staffCompliance.rows,
      expiringTraining: expiringTraining.rows,
      openIncidents: openIncidents.rows,
      people: people.rows.map((p: any) => ({
        ...p,
        allergies: typeof p.allergies === 'string' ? JSON.parse(p.allergies) : p.allergies || [],
      })),
      recordsByStatus: recordsByStatus.rows,
      policies: policies.rows,
      location: location.rows[0] || null,
      nutrition: nutrition.rows,
      nutritionAlerts: nutritionAlerts.rows,
      recentMar: recentMar.rows,
    };
  }

  static async getPersonDetail(orgId: string, locationId: string, personId: string) {
    // Verify person belongs to location
    const personCheck = await query(
      `SELECT id FROM people WHERE id = $1 AND location_id = $2 AND organization_id = $3`,
      [personId, locationId, orgId]
    );
    if (personCheck.rows.length === 0) return null;

    const person = await query(`
      SELECT p.*,
        (SELECT json_agg(cp ORDER BY cp.created_at DESC) FROM care_plans cp WHERE cp.person_id = p.id) AS care_plans,
        (SELECT json_agg(ra ORDER BY ra.created_at DESC) FROM risk_assessments ra WHERE ra.person_id = p.id) AS risk_assessments
      FROM people p WHERE p.id = $1
    `, [personId]);

    const dailyNotes = await query(`
      SELECT dn.*, (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = dn.author_id) AS author_name
      FROM daily_notes dn WHERE dn.person_id = $1
      ORDER BY dn.note_date DESC, dn.created_at DESC LIMIT 30
    `, [personId]);

    const meals = await query(`
      SELECT m.*,
        (SELECT first_name || ' ' || last_name FROM staff_profiles WHERE user_id = m.recorded_by) AS recorded_by_name,
        (SELECT json_agg(mi) FROM meal_items mi WHERE mi.meal_id = m.id) AS items
      FROM meal_records m WHERE m.person_id = $1
      ORDER BY m.meal_date DESC, m.meal_time DESC LIMIT 30
    `, [personId]);

    const dietaryProfile = await query(
      `SELECT * FROM dietary_profiles WHERE person_id = $1`, [personId]);

    const incidents = await query(`
      SELECT i.id, i.title, i.description, i.severity, i.status, i.incident_date, i.location
      FROM incidents i
      JOIN incident_involved_residents iir ON iir.incident_id = i.id
      WHERE iir.person_id = $1
      ORDER BY i.incident_date DESC
    `, [personId]);

    return {
      person: person.rows[0] ? {
        ...person.rows[0],
        allergies: typeof person.rows[0].allergies === 'string' ? JSON.parse(person.rows[0].allergies) : person.rows[0].allergies || [],
      } : null,
      dailyNotes: dailyNotes.rows,
      meals: meals.rows.map((m: any) => ({
        ...m,
        items: m.items || [],
      })),
      dietaryProfile: dietaryProfile.rows[0] || null,
      incidents: incidents.rows,
    };
  }

  static async getMedicationDetail(orgId: string, locationId: string, personId: string) {
    const records = await query(`
      SELECT r.*,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name
      FROM emedication_records r
      WHERE r.organization_id = $1 AND r.person_id = $2
      ORDER BY r.start_date DESC
    `, [orgId, personId]);

    const items = await query(`
      SELECT mi.*, r.title AS chart_title,
        (SELECT first_name || ' ' || last_name FROM people WHERE id = r.person_id) AS person_name
      FROM emedication_items mi
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      WHERE r.organization_id = $1 AND r.person_id = $2
      ORDER BY mi.is_prn ASC, mi.name
    `, [orgId, personId]);

    const administrations = await query(`
      SELECT a.*, mi.name AS medication_name, mi.dosage, mi.unit
      FROM emedication_administrations a
      JOIN emedication_items mi ON a.emedication_item_id = mi.id
      JOIN emedication_records r ON mi.emedication_record_id = r.id
      WHERE r.organization_id = $1 AND r.person_id = $2
        AND a.scheduled_time >= CURRENT_DATE - interval '30 days'
      ORDER BY a.scheduled_time DESC
    `, [orgId, personId]);

    return {
      records: records.rows,
      items: items.rows,
      administrations: administrations.rows,
    };
  }
}
