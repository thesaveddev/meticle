import { query } from '../../shared/database';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

export interface OrganizationRow {
  id: string;
  name: string;
  status: string;
  plan: string;
  subscription_status: string;
  trial_ends_at: Date | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  force_mfa: boolean;
  created_at: Date;
}

export interface LocationRow {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  created_at: Date;
}

export interface DepartmentRow {
  id: string;
  location_id: string;
  name: string;
  created_at: Date;
}

export class OrgRepository {
  static async createOrg(name: string): Promise<OrganizationRow> {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    try {
      const result = await query(
        `INSERT INTO organizations (name, plan, subscription_status, trial_ends_at, onboarding_step, onboarding_completed)
         VALUES ($1, 'starter', 'trial', $2, 0, false) RETURNING *`,
        [name, trialEndsAt]
      );
      const orgId = result.rows[0].id;
      await this.seedDefaultLeaveTypes(orgId);
      return result.rows[0];
    } catch (err: any) {
      if (err?.code === '23505' || (err?.message && err.message.includes('uq_organizations_name'))) {
        throw new AppError(409, 'An organization with this name already exists');
      }
      throw err;
    }
  }

  static async seedDefaultLeaveTypes(orgId: string) {
    const defaults = [
      { name: 'Annual Leave', color: '#0F4C81', days_allowed: 28, hours_allowed: 210, duration_type: 'days' },
      { name: 'Sick Leave', color: '#DC2626', days_allowed: 10, hours_allowed: 75, duration_type: 'days' },
      { name: 'Personal Leave', color: '#D97706', days_allowed: 5, hours_allowed: 37.5, duration_type: 'days' },
      { name: 'Training', color: '#7C3AED', days_allowed: 5, hours_allowed: 37.5, duration_type: 'days' },
      { name: 'Emergency Leave', color: '#EF4444', days_allowed: 3, hours_allowed: 22.5, duration_type: 'days' },
    ];
    for (const lt of defaults) {
      await query(
        `INSERT INTO leave_types (organization_id, name, color, days_allowed, hours_allowed, duration_type)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [orgId, lt.name, lt.color, lt.days_allowed, lt.hours_allowed, lt.duration_type]
      );
    }
  }

  static async createLocation(orgId: string, name: string, address?: string): Promise<LocationRow> {
    const result = await query(
      'INSERT INTO locations (organization_id, name, address) VALUES ($1, $2, $3) RETURNING *',
      [orgId, name, address]
    );
    return result.rows[0];
  }

  static async createDepartment(locationId: string, name: string): Promise<DepartmentRow> {
    const result = await query(
      'INSERT INTO departments (location_id, name) VALUES ($1, $2) RETURNING *',
      [locationId, name]
    );
    return result.rows[0];
  }

  static async getDepartmentsByLocation(locationId: string): Promise<DepartmentRow[]> {
    const result = await query('SELECT * FROM departments WHERE location_id = $1 ORDER BY name', [locationId]);
    return result.rows;
  }

  static async getDepartmentById(id: string): Promise<DepartmentRow | null> {
    const result = await query('SELECT * FROM departments WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async updateDepartment(id: string, name: string): Promise<DepartmentRow> {
    const result = await query('UPDATE departments SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    return result.rows[0];
  }

  static async deleteDepartment(id: string): Promise<void> {
    await query('DELETE FROM departments WHERE id = $1', [id]);
  }

  static async getOrgById(id: string): Promise<OrganizationRow | null> {
    const result = await query('SELECT * FROM organizations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async getLocationsByOrg(orgId: string): Promise<LocationRow[]> {
    const result = await query('SELECT * FROM locations WHERE organization_id = $1', [orgId]);
    return result.rows;
  }

  static async getTeamsByOrg(orgId: string) {
    const result = await query('SELECT * FROM teams WHERE organization_id = $1 ORDER BY name', [orgId]);
    return result.rows;
  }

  static async createTeam(orgId: string, name: string, description?: string) {
    const result = await query(
      'INSERT INTO teams (organization_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [orgId, name, description]
    );
    return result.rows[0];
  }

  static async updateTeam(id: string, name: string, description?: string) {
    const result = await query(
      'UPDATE teams SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  }

  static async deleteTeam(id: string) {
    await query('DELETE FROM teams WHERE id = $1', [id]);
  }

  static async addTeamMember(teamId: string, userId: string, role?: string) {
    const result = await query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) RETURNING *',
      [teamId, userId, role || 'member']
    );
    return result.rows[0];
  }

  static async removeTeamMember(teamId: string, userId: string) {
    await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  }

  static async getTeamMembers(teamId: string) {
    const result = await query(
      `SELECT tm.*, u.email, sp.first_name, sp.last_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN staff_profiles sp ON sp.user_id = tm.user_id
       WHERE tm.team_id = $1`,
      [teamId]
    );
    return result.rows;
  }

  static async updateOrg(id: string, updates: Partial<{
    name: string;
    status: string;
    plan: string;
    regulator: string;
    subscription_status: string;
    onboarding_step: number;
    onboarding_completed: boolean;
    force_mfa: boolean;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
  }>): Promise<OrganizationRow> {
    const allowedFields = new Set(['name', 'status', 'plan', 'regulator', 'onboarding_step', 'onboarding_completed', 'force_mfa', 'logo_url', 'primary_color', 'secondary_color', 'accent_color', 'auto_approve_documents', 'compliance_digest_enabled', 'predictive_alerts_enabled']);
    const fields = Object.keys(updates).filter(f => allowedFields.has(f));
    if (fields.length === 0) {
      return this.getOrgById(id) as Promise<OrganizationRow>;
    }
    const values = fields.map(f => (updates as any)[f]);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const result = await query(
      `UPDATE organizations SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }
}
