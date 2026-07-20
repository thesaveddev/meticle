import { query } from '../../shared/database';

export class TrainingRepository {
  static async getModules(organizationId: string) {
    const result = await query(
      `SELECT tm.*,
        (SELECT COUNT(*) FROM training_records WHERE module_id = tm.id AND status = 'completed') as completed_count,
        (SELECT COUNT(*) FROM training_records WHERE module_id = tm.id) as total_count
       FROM training_modules tm
       WHERE tm.organization_id = $1
       ORDER BY tm.name`,
      [organizationId]
    );
    return result.rows;
  }

  static async createModule(data: {
    organization_id: string; name: string; category?: string; description?: string;
    frequency_days?: number; is_mandatory?: boolean; requires_competency?: boolean;
    cqc_mandated?: boolean; cqc_mandated_for_roles?: string[];
  }) {
    const result = await query(
      `INSERT INTO training_modules (organization_id, name, category, description, frequency_days, is_mandatory, requires_competency, cqc_mandated, cqc_mandated_for_roles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.organization_id, data.name, data.category || null, data.description || null,
       data.frequency_days || null, data.is_mandatory ?? true, data.requires_competency ?? false,
       data.cqc_mandated ?? false, JSON.stringify(data.cqc_mandated_for_roles || [])]
    );
    return result.rows[0];
  }

  static async updateModule(id: string, organizationId: string, data: any) {
    const result = await query(
      `UPDATE training_modules SET
        name = COALESCE($1, name), category = COALESCE($2, category),
        description = COALESCE($3, description), frequency_days = COALESCE($4, frequency_days),
        is_mandatory = COALESCE($5, is_mandatory), requires_competency = COALESCE($6, requires_competency),
        cqc_mandated = COALESCE($7, cqc_mandated), cqc_mandated_for_roles = COALESCE($8, cqc_mandated_for_roles),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND organization_id = $10 RETURNING *`,
      [data.name, data.category, data.description, data.frequency_days,
       data.is_mandatory, data.requires_competency, data.cqc_mandated,
       data.cqc_mandated_for_roles ? JSON.stringify(data.cqc_mandated_for_roles) : null,
       id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async deleteModule(id: string, organizationId: string) {
    const result = await query(
      'DELETE FROM training_modules WHERE id = $1 AND organization_id = $2 RETURNING id',
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async getRecords(organizationId: string, moduleId?: string, staffId?: string) {
    let sql = `SELECT tr.*, tm.name as module_name, tm.category as module_category,
               sp.first_name, sp.last_name, u.email
               FROM training_records tr
               JOIN training_modules tm ON tr.module_id = tm.id
               JOIN staff_profiles sp ON tr.staff_id = sp.id
               JOIN users u ON sp.user_id = u.id
               WHERE tm.organization_id = $1`
    const params: any[] = [organizationId]
    let idx = 2
    if (moduleId) { sql += ` AND tr.module_id = $${idx}`; params.push(moduleId); idx++ }
    if (staffId) { sql += ` AND tr.staff_id = $${idx}`; params.push(staffId) }
    sql += ' ORDER BY tm.name, sp.first_name'
    const result = await query(sql, params)
    return result.rows
  }

  static async upsertRecord(data: {
    module_id: string; staff_id: string; completed_at?: string; expires_at?: string;
    status?: string; competency_passed?: boolean; trainer_name?: string;
    digital_signature?: string; notes?: string; file_url?: string;
  }) {
    const result = await query(
      `INSERT INTO training_records (module_id, staff_id, completed_at, expires_at, status, competency_passed, trainer_name, digital_signature, notes, file_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (module_id, staff_id)
       DO UPDATE SET
         completed_at = COALESCE($3, training_records.completed_at),
         expires_at = COALESCE($4, training_records.expires_at),
         status = COALESCE($5, training_records.status),
         competency_passed = COALESCE($6, training_records.competency_passed),
         trainer_name = COALESCE($7, training_records.trainer_name),
         digital_signature = COALESCE($8, training_records.digital_signature),
         notes = COALESCE($9, training_records.notes),
         file_url = COALESCE($10, training_records.file_url),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [data.module_id, data.staff_id, data.completed_at || null, data.expires_at || null,
       data.status || 'completed', data.competency_passed ?? null, data.trainer_name || null,
       data.digital_signature || null, data.notes || null, data.file_url || null]
    );
    return result.rows[0];
  }

  static async deleteRecord(id: string, organizationId: string) {
    const result = await query(
      `DELETE FROM training_records WHERE id = $1 AND module_id IN
        (SELECT id FROM training_modules WHERE organization_id = $2) RETURNING id`,
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async getMatrix(organizationId: string) {
    const modules = await query(
      'SELECT id, name, category, is_mandatory, cqc_mandated FROM training_modules WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    const staff = await query(
      `SELECT sp.id, sp.first_name, sp.last_name, sp.compliance_profile_id, cp.name as profile_name
       FROM staff_profiles sp
       JOIN users u ON sp.user_id = u.id
       LEFT JOIN compliance_profiles cp ON sp.compliance_profile_id = cp.id
       WHERE u.organization_id = $1 AND u.status = 'active'
       ORDER BY sp.first_name`,
      [organizationId]
    );
    const records = await query(
      `SELECT tr.module_id, tr.staff_id, tr.status, tr.completed_at, tr.expires_at, tr.competency_passed
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       WHERE tm.organization_id = $1`,
      [organizationId]
    );
    return { modules: modules.rows, staff: staff.rows, records: records.rows };
  }

  static async getExpiring(organizationId: string, days: number = 30) {
    const result = await query(
      `SELECT tr.*, tm.name as module_name, sp.first_name, sp.last_name, u.email
       FROM training_records tr
       JOIN training_modules tm ON tr.module_id = tm.id
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE tm.organization_id = $1
         AND tr.status = 'completed'
         AND tr.expires_at IS NOT NULL
         AND tr.expires_at <= CURRENT_DATE + $2::integer
       ORDER BY tr.expires_at`,
      [organizationId, days]
    );
    return result.rows;
  }

  static async bulkAssign(organizationId: string, staffId: string, moduleIds: string[]) {
    const results = []
    for (const moduleId of moduleIds) {
      const result = await query(
        `INSERT INTO training_records (module_id, staff_id, status)
         VALUES ($1, $2, 'incomplete')
         ON CONFLICT (module_id, staff_id) DO NOTHING
         RETURNING *`,
        [moduleId, staffId]
      );
      if (result.rows[0]) results.push(result.rows[0])
    }
    return results
  }

  static async getTrainingDashboard(organizationId: string) {
    const roleStats = await query(
      `SELECT u.role,
              COUNT(*) FILTER (WHERE tr.status = 'completed')::int as completed,
              COUNT(*)::int as total,
              ROUND(COUNT(*) FILTER (WHERE tr.status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as percentage
       FROM training_records tr
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1
       GROUP BY u.role
       ORDER BY percentage DESC NULLS LAST`,
      [organizationId]
    )

    const moduleStats = await query(
      `SELECT tm.id, tm.name, tm.category,
              COUNT(*) FILTER (WHERE tr.status = 'completed')::int as completed,
              COUNT(*)::int as total,
              ROUND(COUNT(*) FILTER (WHERE tr.status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as percentage
       FROM training_modules tm
       LEFT JOIN training_records tr ON tr.module_id = tm.id
       WHERE tm.organization_id = $1
       GROUP BY tm.id, tm.name, tm.category
       ORDER BY percentage ASC`,
      [organizationId]
    )

    const overall = await query(
      `SELECT COUNT(*) FILTER (WHERE tr.status = 'completed')::int as completed,
              COUNT(*)::int as total,
              ROUND(COUNT(*) FILTER (WHERE tr.status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as percentage
       FROM training_records tr
       JOIN staff_profiles sp ON tr.staff_id = sp.id
       JOIN users u ON sp.user_id = u.id
       WHERE u.organization_id = $1`,
      [organizationId]
    )

    const staffCount = await query(
      `SELECT COUNT(*)::int as count FROM users WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    )

    const moduleCount = await query(
      `SELECT COUNT(*)::int as count FROM training_modules WHERE organization_id = $1`,
      [organizationId]
    )

    return {
      overall: overall.rows[0] || { completed: 0, total: 0, percentage: 0 },
      byRole: roleStats.rows,
      byModule: moduleStats.rows,
      totalStaff: staffCount.rows[0]?.count || 0,
      totalModules: moduleCount.rows[0]?.count || 0,
    }
  }

  /** Auto-assign CQC-mandated training modules to staff matching their role */
  static async autoAssignByRole(orgId: string): Promise<number> {
    // Get all CQC-mandated modules with their target roles
    const modules = await query(
      `SELECT id, name, cqc_mandated_for_roles FROM training_modules
       WHERE organization_id = $1 AND cqc_mandated = true AND cqc_mandated_for_roles IS NOT NULL`,
      [orgId]
    );
    if (modules.rows.length === 0) return 0;

    let assigned = 0;
    for (const mod of modules.rows) {
      const roles: string[] = mod.cqc_mandated_for_roles || [];
      if (roles.length === 0) continue;

      // Get staff whose role matches and don't have a record for this module yet
      const staff = await query(
        `SELECT sp.id FROM staff_profiles sp
         JOIN users u ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role = ANY($2) AND u.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM training_records tr WHERE tr.module_id = $3 AND tr.staff_id = sp.id)`,
        [orgId, roles, mod.id]
      );

      for (const s of staff.rows) {
        try {
          await query(
            `INSERT INTO training_records (module_id, staff_id, status)
             VALUES ($1, $2, 'incomplete')
             ON CONFLICT (module_id, staff_id) DO NOTHING`,
            [mod.id, s.id]
          );
          assigned++;
        } catch { /* skip on conflict */ }
      }
    }
    return assigned;
  }
}
