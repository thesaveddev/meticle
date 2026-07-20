import { query } from '../../shared/database';

export class CompetencyRepository {
  static async getTemplates(organizationId: string) {
    const result = await query(
      `SELECT ct.*,
        (SELECT COUNT(*) FROM competency_assessments ca WHERE ca.template_id = ct.id AND ca.passed = true) as passed_count,
        (SELECT COUNT(*) FROM competency_assessments ca WHERE ca.template_id = ct.id) as total_count
       FROM competency_templates ct
       WHERE ct.organization_id = $1
       ORDER BY ct.name`,
      [organizationId]
    );
    return result.rows;
  }

  static async createTemplate(data: {
    organization_id: string; name: string; category?: string;
    description?: string; criteria?: string; requires_reassessment_days?: number;
    cqc_statement_id?: string; rubric_definition?: any[]; required_for_roles?: string[];
  }) {
    const result = await query(
      `INSERT INTO competency_templates (organization_id, name, category, description, criteria, requires_reassessment_days, cqc_statement_id, rubric_definition, required_for_roles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.organization_id, data.name, data.category || null, data.description || null,
       data.criteria || null, data.requires_reassessment_days || 365, data.cqc_statement_id || null,
       data.rubric_definition ? JSON.stringify(data.rubric_definition) : '[]',
       data.required_for_roles ? JSON.stringify(data.required_for_roles) : '[]']
    );
    return result.rows[0];
  }

  static async updateTemplate(id: string, organizationId: string, data: any) {
    const result = await query(
      `UPDATE competency_templates SET
        name = COALESCE($1, name), category = COALESCE($2, category),
        description = COALESCE($3, description), criteria = COALESCE($4, criteria),
        requires_reassessment_days = COALESCE($5, requires_reassessment_days),
        is_active = COALESCE($6, is_active),
        cqc_statement_id = COALESCE($7, cqc_statement_id),
        rubric_definition = COALESCE($8, rubric_definition),
        required_for_roles = COALESCE($9, required_for_roles)
       WHERE id = $10 AND organization_id = $11 RETURNING *`,
      [data.name, data.category, data.description, data.criteria,
       data.requires_reassessment_days, data.is_active, data.cqc_statement_id,
       data.rubric_definition ? JSON.stringify(data.rubric_definition) : undefined,
       data.required_for_roles ? JSON.stringify(data.required_for_roles) : undefined, id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async deleteTemplate(id: string, organizationId: string) {
    const result = await query(
      'DELETE FROM competency_templates WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async getAssessments(organizationId: string, templateId?: string, staffId?: string) {
    let sql = `SELECT ca.*, ct.name as template_name, ct.category as template_category,
               sp.first_name, sp.last_name,
               asp.first_name as assessor_first_name, asp.last_name as assessor_last_name
               FROM competency_assessments ca
               JOIN competency_templates ct ON ca.template_id = ct.id
               JOIN staff_profiles sp ON ca.staff_id = sp.id
               LEFT JOIN users a ON ca.assessor_id = a.id
               LEFT JOIN staff_profiles asp ON a.id = asp.user_id
               WHERE ct.organization_id = $1`
    const params: any[] = [organizationId]
    let idx = 2
    if (templateId) { sql += ` AND ca.template_id = $${idx}`; params.push(templateId); idx++ }
    if (staffId) { sql += ` AND ca.staff_id = $${idx}`; params.push(staffId) }
    sql += ' ORDER BY ca.assessed_at DESC'
    const result = await query(sql, params)
    return result.rows
  }

  static async createAssessment(data: {
    template_id: string; staff_id: string; assessor_id?: string;
    passed: boolean; assessed_at?: string; reassessment_date?: string;
    involved_parties?: string; notes?: string;
    score?: number; max_score?: number; rubric_responses?: any[];
    evidence_url?: string;
  }) {
    const result = await query(
      `INSERT INTO competency_assessments (template_id, staff_id, assessor_id, passed, assessed_at, reassessment_date, involved_parties, notes, score, max_score, rubric_responses, evidence_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.template_id, data.staff_id, data.assessor_id || null,
       data.passed, data.assessed_at || new Date().toISOString().split('T')[0],
       data.reassessment_date || null, data.involved_parties || null, data.notes || null,
       data.score || null, data.max_score || null,
       data.rubric_responses ? JSON.stringify(data.rubric_responses) : '[]',
       data.evidence_url || null]
    );
    return result.rows[0];
  }

  static async deleteAssessment(id: string, organizationId: string) {
    const result = await query(
      `DELETE FROM competency_assessments WHERE id = $1 AND template_id IN
        (SELECT id FROM competency_templates WHERE organization_id = $2) RETURNING id`,
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async getPending(organizationId: string) {
    // Staff that have either never been assessed on a template, or whose assessment is overdue
    const result = await query(
      `SELECT sp.id as staff_id, sp.first_name, sp.last_name,
              ct.id as template_id, ct.name as template_name, ct.category,
              ct.rubric_definition,
              ca.assessed_at, ca.passed, ca.reassessment_date, ca.score, ca.max_score
       FROM competency_templates ct
       CROSS JOIN staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT * FROM competency_assessments ca2
         WHERE ca2.template_id = ct.id AND ca2.staff_id = sp.id
         ORDER BY ca2.assessed_at DESC LIMIT 1
       ) ca ON true
        WHERE ct.organization_id = $1 AND ct.is_active = true
          AND u.organization_id = $1 AND u.status = 'active'
          AND (ct.required_for_roles IS NULL OR ct.required_for_roles = '[]'::jsonb OR u.role::text = ANY(SELECT jsonb_array_elements_text(ct.required_for_roles)))
          AND (ca.id IS NULL OR ca.passed = false OR ca.reassessment_date <= CURRENT_DATE)
       ORDER BY sp.last_name, ct.name`,
      [organizationId]
    );
    return result.rows;
  }
}
