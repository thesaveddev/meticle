import crypto from 'crypto';
import { query } from '../../shared/database';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class SurveysRepository {
  // ── Survey Invitations (email-based feedback) ──
  static async createInvitation(orgId: string, type: 'satisfaction' | 'engagement', email: string, serviceUserId?: string, serviceUserName?: string) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const result = await query(
      `INSERT INTO survey_invitations (organization_id, type, email, token, service_user_id, service_user_name, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, type, email, token, serviceUserId || null, serviceUserName || null, expiresAt]
    );
    return { ...result.rows[0], token };
  }

  static async getInvitationByToken(token: string) {
    const result = await query(
      `SELECT si.*, o.name as org_name
       FROM survey_invitations si
       JOIN organizations o ON si.organization_id = o.id
       WHERE si.token = $1 AND si.used = false AND si.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );
    return result.rows[0] || null;
  }

  static async completeInvitation(token: string, data: {
    respondent_name: string; relationship: string;
    rating: number; comments?: string;
  }) {
    // Get the invitation
    const inv = await this.getInvitationByToken(token);
    if (!inv) return null;
    // Create the satisfaction survey record
    const survey = await query(
      `INSERT INTO satisfaction_surveys (organization_id, service_user_id, respondent_name, relationship, rating, comments, invitation_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [inv.organization_id, inv.service_user_id || null, data.respondent_name || null, data.relationship || null, data.rating, data.comments || null, token]
    );
    // Mark invitation as used
    await query(
      `UPDATE survey_invitations SET used = true, respondent_name = $1, relationship = $2, completed_at = CURRENT_TIMESTAMP WHERE token = $3`,
      [data.respondent_name || null, data.relationship || null, token]
    );
    return survey.rows[0];
  }

  static async getInvitations(orgId: string, type?: 'satisfaction' | 'engagement') {
    const typeFilter = type ? ' AND si.type = $2' : '';
    const params = type ? [orgId, type] : [orgId];
    const result = await query(
      `SELECT si.*, su.first_name as service_user_first_name, su.last_name as service_user_last_name
       FROM survey_invitations si
       LEFT JOIN service_users su ON si.service_user_id = su.id
       WHERE si.organization_id = $1${typeFilter}
       ORDER BY si.created_at DESC`,
      params
    );
    return result.rows;
  }

  // ── Engagement Templates ──
  static async createEngagementTemplate(orgId: string, data: {
    name: string; questions: Record<string, any>[];
  }) {
    const result = await query(
      `INSERT INTO engagement_templates (organization_id, name, questions)
       VALUES ($1, $2, $3) RETURNING *`,
      [orgId, data.name, JSON.stringify(data.questions)]
    );
    return result.rows[0];
  }

  static async getEngagementTemplates(orgId: string, search?: string) {
    const params: any[] = [orgId];
    let searchFilter = '';
    if (search) {
      searchFilter = ` AND LOWER(name) LIKE LOWER($${params.length + 1})`;
      params.push(`%${search}%`);
    }
    const result = await query(
      `SELECT * FROM engagement_templates WHERE organization_id = $1${searchFilter} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  }

  static async updateEngagementTemplate(id: string, orgId: string, data: {
    name?: string; questions?: Record<string, any>[]; is_active?: boolean;
  }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
    if (data.questions !== undefined) { sets.push(`questions = $${idx++}`); params.push(JSON.stringify(data.questions)); }
    if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.is_active); }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, orgId);
    const result = await query(
      `UPDATE engagement_templates SET ${sets.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  static async deleteEngagementTemplate(id: string, orgId: string) {
    await query(`DELETE FROM engagement_templates WHERE id = $1 AND organization_id = $2`, [id, orgId]);
  }

  static async getEngagementTemplate(id: string) {
    const result = await query(`SELECT * FROM engagement_templates WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  // ── Send engagement survey to all active staff ──
  static async sendEngagementSurveyToStaff(templateId: string, orgId: string, roles?: string[]) {
    const template = await this.getEngagementTemplate(templateId);
    if (!template) return null;
    let roleFilter = '';
    const params: any[] = [orgId];
    if (roles && roles.length > 0) {
      roleFilter = ` AND u.role = ANY($${params.length + 1}::user_role[])`;
      params.push(roles);
    }
    const staff = await query(
      `SELECT u.id as user_id, u.email, sp.first_name, sp.last_name
       FROM users u
       JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.organization_id = $1 AND u.status = 'active'${roleFilter}`,
      params
    );
    const invitations: any[] = [];
    for (const s of staff.rows) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const inv = await query(
        `INSERT INTO survey_invitations (organization_id, type, email, token, service_user_name, expires_at, template_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [orgId, 'engagement', s.email, token, `${s.first_name || ''} ${s.last_name || ''}`.trim(), expiresAt, templateId]
      );
      invitations.push({ ...inv.rows[0], userId: s.user_id, email: s.email, name: `${s.first_name || ''} ${s.last_name || ''}`.trim() });
    }
    return { template, invitations };
  }

  // ── Complete engagement survey via token ──
  static async completeEngagementInvitation(token: string, data: {
    ratings: Record<string, number>; comments?: string; respondent_id?: string; is_anonymous?: boolean;
  }) {
    const inv = await this.getInvitationByToken(token);
    if (!inv) return null;
    // Create the engagement survey record
    const survey = await query(
      `INSERT INTO staff_engagement_surveys (organization_id, respondent_id, ratings, comments, is_anonymous, template_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [inv.organization_id, data.respondent_id || null, JSON.stringify(data.ratings), data.comments || null, data.is_anonymous ?? true, inv.template_id || null]
    );
    // Mark invitation as used
    await query(
      `UPDATE survey_invitations SET used = true, completed_at = CURRENT_TIMESTAMP WHERE token = $1`,
      [token]
    );
    return survey.rows[0];
  }

  // ── Satisfaction Surveys (Caring domain) ──
  static async createSatisfaction(orgId: string, data: {
    service_user_id?: string; respondent_name?: string; relationship?: string;
    rating: number; comments?: string; invitation_token?: string;
  }) {
    const result = await query(
      `INSERT INTO satisfaction_surveys (organization_id, service_user_id, respondent_name, relationship, rating, comments, invitation_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, data.service_user_id || null, data.respondent_name || null, data.relationship || null, data.rating, data.comments || null, data.invitation_token || null]
    );
    return result.rows[0];
  }

  static async getSatisfactionSurveys(orgId: string, filters?: {
    serviceUserId?: string; search?: string; startDate?: string; endDate?: string;
  }) {
    const conditions = ['ss.organization_id = $1'];
    const params: any[] = [orgId];
    let idx = 2;
    if (filters?.serviceUserId) { conditions.push(`ss.service_user_id = $${idx++}`); params.push(filters.serviceUserId); }
    if (filters?.search) { conditions.push(`(LOWER(ss.respondent_name) LIKE LOWER($${idx}) OR LOWER(ss.comments) LIKE LOWER($${idx++}))`); params.push(`%${filters.search}%`); }
    if (filters?.startDate) { conditions.push(`ss.created_at >= $${idx++}`); params.push(filters.startDate); }
    if (filters?.endDate) { conditions.push(`ss.created_at < $${idx++}::date + 1`); params.push(filters.endDate); }
    const result = await query(
      `SELECT ss.*, su.first_name, su.last_name
       FROM satisfaction_surveys ss
       LEFT JOIN service_users su ON ss.service_user_id = su.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ss.created_at DESC`,
      params
    );
    return result.rows;
  }

  static async updateSatisfactionNotes(id: string, orgId: string, manager_notes: string) {
    const result = await query(
      `UPDATE satisfaction_surveys SET manager_notes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [manager_notes || null, id, orgId]
    );
    return result.rows[0] || null;
  }

  static async getSatisfactionAggregate(orgId: string) {
    const result = await query(
      `SELECT COUNT(*)::int as total,
              ROUND(AVG(rating)::numeric, 2) as average_rating,
              COUNT(*) FILTER (WHERE rating >= 4)::int as positive_count,
              COUNT(*) FILTER (WHERE rating <= 2)::int as negative_count
       FROM satisfaction_surveys
       WHERE organization_id = $1`,
      [orgId]
    );
    return result.rows[0] || { total: 0, average_rating: 0, positive_count: 0, negative_count: 0 };
  }

  // ── Staff Engagement Surveys (Well-led domain) ──
  static async createEngagement(orgId: string, data: {
    respondent_id?: string; ratings: Record<string, number>;
    comments?: string; is_anonymous?: boolean;
  }) {
    const result = await query(
      `INSERT INTO staff_engagement_surveys (organization_id, respondent_id, ratings, comments, is_anonymous)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, data.respondent_id || null, JSON.stringify(data.ratings), data.comments || null, data.is_anonymous ?? true]
    );
    return result.rows[0];
  }

  static async getEngagementSurveys(orgId: string, templateId?: string) {
    let sql = `SELECT ses.*, u.email as respondent_email,
               et.name as template_name
        FROM staff_engagement_surveys ses
        LEFT JOIN users u ON ses.respondent_id = u.id
        LEFT JOIN engagement_templates et ON ses.template_id = et.id
        WHERE ses.organization_id = $1`;
    const params: any[] = [orgId];
    if (templateId) { sql += ` AND ses.template_id = $2`; params.push(templateId); }
    sql += ` ORDER BY ses.created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
  }

  static async getEngagementAggregate(orgId: string) {
    const result = await query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE is_anonymous = false)::int as named_count,
              COUNT(*) FILTER (WHERE is_anonymous = true)::int as anonymous_count
       FROM staff_engagement_surveys
       WHERE organization_id = $1`,
      [orgId]
    );
    const total = parseInt(result.rows[0]?.total || '0');
    if (total === 0) {
      return { total: 0, average_scores: {}, named_count: 0, anonymous_count: 0 };
    }
    // Extract average per rating key by aggregating JSONB
    const allRatings = await query(
      `SELECT ratings FROM staff_engagement_surveys WHERE organization_id = $1`,
      [orgId]
    );
    const avgScores: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const row of allRatings.rows) {
      const r = row.ratings || {};
      for (const [key, val] of Object.entries(r)) {
        if (!avgScores[key]) { avgScores[key] = 0; counts[key] = 0; }
        avgScores[key] += val as number;
        counts[key]++;
      }
    }
    for (const key of Object.keys(avgScores)) {
      avgScores[key] = Math.round((avgScores[key] / counts[key]) * 10) / 10;
    }
    return {
      total, average_scores: avgScores,
      named_count: parseInt(result.rows[0].named_count),
      anonymous_count: parseInt(result.rows[0].anonymous_count),
    };
  }
}
