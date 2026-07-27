import pool from '../../shared/database';

export class FamilyPortalRepository {
  private static readonly MEMBER_UPDATE_COLUMNS = new Set(['name', 'email', 'relationship', 'phone']);
  static async listMembers(serviceUserId: string, organizationId: string) {
    const result = await pool.query(
      `SELECT fm.*, su.first_name as su_first_name, su.last_name as su_last_name
       FROM family_members fm
       JOIN service_users su ON su.id = fm.service_user_id
       WHERE fm.service_user_id = $1 AND fm.organization_id = $2
       ORDER BY fm.created_at DESC`,
      [serviceUserId, organizationId]
    );
    return result.rows;
  }

  static async getMember(id: string, organizationId: string) {
    const result = await pool.query(
      `SELECT * FROM family_members WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async createMember(data: {
    organization_id: string; service_user_id: string; name: string; email: string;
    relationship?: string; phone?: string; created_by: string;
  }) {
    const token = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO family_members (organization_id, service_user_id, name, email, relationship, phone, access_token, token_expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '90 days', $8)
       RETURNING *`,
      [data.organization_id, data.service_user_id, data.name, data.email, data.relationship || null, data.phone || null, token, data.created_by]
    );
    return result.rows[0];
  }

  static async updateMember(id: string, organizationId: string, data: { name?: string; email?: string; relationship?: string; phone?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(data)) {
      if (!FamilyPortalRepository.MEMBER_UPDATE_COLUMNS.has(key)) continue;
      if (val !== undefined) { fields.push(`${key} = $${idx}`); values.push(val); idx++; }
    }
    if (fields.length === 0) return null;
    fields.push(`updated_at = NOW()`);
    values.push(id, organizationId);
    const result = await pool.query(
      `UPDATE family_members SET ${fields.join(', ')} WHERE id = $${idx} AND organization_id = $${idx + 1} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  static async revokeMember(id: string, organizationId: string) {
    const result = await pool.query(
      `UPDATE family_members SET status = 'revoked', access_token = NULL, token_expires_at = NULL, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organizationId]
    );
    return result.rows[0] || null;
  }

  static async resendInvite(id: string, organizationId: string) {
    const token = crypto.randomUUID();
    const result = await pool.query(
      `UPDATE family_members SET access_token = $3, token_expires_at = NOW() + INTERVAL '90 days', status = 'invited', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organizationId, token]
    );
    return result.rows[0] || null;
  }

  static async refreshToken(id: string, organizationId: string) {
    const token = crypto.randomUUID();
    const result = await pool.query(
      `UPDATE family_members SET access_token = $3, token_expires_at = NOW() + INTERVAL '90 days', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [id, organizationId, token]
    );
    return result.rows[0] || null;
  }

  static async deleteMember(id: string, organizationId: string) {
    await pool.query(
      `DELETE FROM family_members WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );
  }

  // ── Token-based access (public) ──
  static async validateToken(token: string) {
    const result = await pool.query(
      `SELECT fm.*, su.first_name as su_first_name, su.last_name as su_last_name,
              su.photo_url, su.date_of_birth, o.name as org_name
       FROM family_members fm
       JOIN service_users su ON su.id = fm.service_user_id
       JOIN organizations o ON o.id = fm.organization_id
       WHERE fm.access_token = $1 AND fm.status = 'active' AND fm.token_expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  // Used by controller to get service user info for invitation email (skips 'active' check)
  static async getMemberWithServiceUser(token: string) {
    const result = await pool.query(
      `SELECT fm.*, su.first_name as su_first_name, su.last_name as su_last_name,
              o.name as org_name
       FROM family_members fm
       JOIN service_users su ON su.id = fm.service_user_id
       JOIN organizations o ON o.id = fm.organization_id
       WHERE fm.access_token = $1 AND fm.token_expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  }

  static async recordAccess(id: string) {
    await pool.query(
      `UPDATE family_members SET last_accessed_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  static async getCareNotes(serviceUserId: string, limit = 20) {
    const result = await pool.query(
      `SELECT dn.id, dn.note_date, dn.shift, dn.category, dn.content, dn.created_at,
              COALESCE(sp.first_name || ' ' || sp.last_name, u.email) as author_name
       FROM daily_notes dn
       JOIN users u ON u.id = dn.author_id
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE dn.service_user_id = $1
       ORDER BY dn.created_at DESC LIMIT $2`,
      [serviceUserId, limit]
    );
    return result.rows;
  }

  static async getCarePlans(serviceUserId: string) {
    const result = await pool.query(
      `SELECT id, title, category, description, status, review_date,
              mobility_level, mobility_aids, communication_needs, sleep_pattern,
              likes_dislikes, personal_goals, cultural_needs,
              created_at, updated_at
       FROM care_plans WHERE service_user_id = $1 AND status = 'active'
       ORDER BY updated_at DESC`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async getGoals(serviceUserId: string) {
    const result = await pool.query(
      `SELECT id, title, description, target_date, status, progress, cqc_domain, goal_category
       FROM service_user_goals WHERE service_user_id = $1 AND status != 'cancelled'
       ORDER BY target_date ASC NULLS LAST`,
      [serviceUserId]
    );
    return result.rows;
  }

  static async getRecentObservations(serviceUserId: string, limit = 15) {
    const result = await pool.query(
      `SELECT id, observation_date, category, notes, severity, recorded_by, created_at
       FROM health_observations WHERE service_user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [serviceUserId, limit]
    );
    return result.rows;
  }
}
