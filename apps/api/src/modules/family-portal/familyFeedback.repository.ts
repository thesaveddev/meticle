import { migrateQuery } from '../../shared/database';

export class FamilyFeedbackRepository {
  /**
   * Create a feedback token for a completed visit.
   * Called automatically when a visit status changes to 'completed'.
   */
  static async createFeedbackToken(data: {
    organization_id: string;
    visit_id: string;
    person_id: string;
    family_member_name: string;
    family_member_email?: string;
    relationship?: string;
  }) {
    const token = crypto.randomUUID();
    const result = await migrateQuery(
      `INSERT INTO family_feedback (organization_id, visit_id, person_id, family_member_name, family_member_email, relationship, access_token, token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [data.organization_id, data.visit_id, data.person_id, data.family_member_name, data.family_member_email || null, data.relationship || null, token]
    );
    return result.rows[0] || null;
  }

  /**
   * Validate a feedback token and return the associated data.
   */
  static async validateToken(token: string) {
    const result = await migrateQuery(
      `SELECT ff.*,
              hv.label as visit_label, hv.scheduled_start, hv.scheduled_end, hv.status as visit_status,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as carer_name,
              p.first_name as person_first_name, p.last_name as person_last_name,
              o.name as org_name
       FROM family_feedback ff
       JOIN homecare_visits hv ON hv.id = ff.visit_id
       JOIN people p ON p.id = ff.person_id
       JOIN organizations o ON o.id = ff.organization_id
       LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
       LEFT JOIN users u ON u.id = sp.user_id
       WHERE ff.access_token = $1 AND ff.submitted_at IS NULL AND ff.token_expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  /**
   * Submit feedback for a visit.
   */
  static async submitFeedback(token: string, data: {
    overall_rating: number;
    care_quality_rating?: number;
    communication_rating?: number;
    punctuality_rating?: number;
    feedback_text?: string;
    would_recommend?: boolean;
  }) {
    const result = await migrateQuery(
      `UPDATE family_feedback
       SET overall_rating = $2, care_quality_rating = $3, communication_rating = $4,
           punctuality_rating = $5, feedback_text = $6, would_recommend = $7,
           submitted_at = NOW(), updated_at = NOW()
       WHERE access_token = $1 AND submitted_at IS NULL AND token_expires_at > NOW()
       RETURNING *`,
      [token, data.overall_rating, data.care_quality_rating || null, data.communication_rating || null, data.punctuality_rating || null, data.feedback_text || null, data.would_recommend ?? null]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all submitted feedback for an organisation (manager view).
   */
  static async getOrgFeedback(organizationId: string, options: { limit?: number; offset?: number; personId?: string } = {}) {
    const { limit = 50, offset = 0, personId } = options;
    let sql = `
      SELECT ff.id, ff.visit_id, ff.person_id, ff.family_member_name, ff.relationship,
             ff.overall_rating, ff.care_quality_rating, ff.communication_rating, ff.punctuality_rating,
             ff.feedback_text, ff.would_recommend, ff.submitted_at,
             hv.label as visit_label, hv.scheduled_start,
             COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as carer_name,
             p.first_name as person_first_name, p.last_name as person_last_name
      FROM family_feedback ff
      JOIN homecare_visits hv ON hv.id = ff.visit_id
      JOIN people p ON p.id = ff.person_id
      LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
      LEFT JOIN users u ON u.id = sp.user_id
      WHERE ff.organization_id = $1 AND ff.submitted_at IS NOT NULL
    `;
    const params: any[] = [organizationId];
    let idx = 2;

    if (personId) {
      sql += ` AND ff.person_id = $${idx}`;
      params.push(personId);
      idx++;
    }

    sql += ` ORDER BY ff.submitted_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await migrateQuery(sql, params);

    // Get summary stats
    const statsResult = await migrateQuery(
      `SELECT
         COUNT(*)::int as total_feedback,
         ROUND(AVG(overall_rating)::numeric, 1) as avg_overall,
         ROUND(AVG(care_quality_rating)::numeric, 1) as avg_care_quality,
         ROUND(AVG(communication_rating)::numeric, 1) as avg_communication,
         ROUND(AVG(punctuality_rating)::numeric, 1) as avg_punctuality,
         COUNT(*) FILTER (WHERE would_recommend = true)::int as would_recommend_count
       FROM family_feedback
       WHERE organization_id = $1 AND submitted_at IS NOT NULL`,
      [organizationId]
    );

    return {
      feedback: result.rows,
      stats: statsResult.rows[0] || { total_feedback: 0, avg_overall: 0, avg_care_quality: 0, avg_communication: 0, avg_punctuality: 0, would_recommend_count: 0 },
    };
  }
}
