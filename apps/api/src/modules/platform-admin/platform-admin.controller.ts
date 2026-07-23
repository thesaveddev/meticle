import { Request, Response } from 'express';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

export class PlatformAdminController {
  static async getStats(_req: Request, res: Response) {
    const [orgs, users, subs, recentSignups] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as total FROM organizations`),
      pool.query(`SELECT COUNT(*)::int as total FROM users`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int as active,
          COUNT(*) FILTER (WHERE subscription_status = 'trial')::int as trial,
          COUNT(*) FILTER (WHERE subscription_status = 'past_due')::int as past_due,
          COUNT(*) FILTER (WHERE subscription_status = 'canceled')::int as canceled,
          COUNT(*) FILTER (WHERE subscription_status = 'expired')::int as expired
        FROM organizations
      `),
      pool.query(`SELECT COUNT(*)::int as total FROM users WHERE created_at > NOW() - INTERVAL '30 days'`),
    ]);

    // MRR from active plans
    const mrr = await pool.query(`
      SELECT COALESCE(SUM(CASE WHEN plan = 'professional' THEN 299 WHEN plan = 'starter' THEN 99 ELSE 0 END), 0) as mrr
      FROM organizations WHERE subscription_status = 'active'
    `);

    res.json({
      totalOrganizations: orgs.rows[0].total,
      totalUsers: users.rows[0].total,
      mrr: mrr.rows[0].mrr,
      recentSignups: recentSignups.rows[0].total,
      subscriptions: subs.rows[0],
    });
  }

  static async listOrganizations(req: Request, res: Response) {
    const { status, plan, search, page = '1', limit = '50' } = req.query;
    const offset = (Math.max(1, parseInt(page as string)) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status) { conditions.push(`o.subscription_status = $${idx++}`); params.push(status); }
    if (plan) { conditions.push(`o.plan = $${idx++}`); params.push(plan); }
    if (search) { conditions.push(`(o.name ILIKE $${idx} OR EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id AND u.email ILIKE $${idx}))`); params.push(`%${search}%`); idx++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT o.id, o.name, o.plan, COALESCE(o.subscription_status, 'trial') as subscription_status,
        o.created_at, o.stripe_customer_id,
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) as user_count,
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.status = 'active') as active_user_count
      FROM organizations o
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ${parseInt(limit as string)} OFFSET $${idx}
    `, [...params, offset]);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM organizations o ${where}`,
      params
    );

    res.json({ organizations: result.rows, total: countResult.rows[0].total });
  }

  static async getOrganization(req: Request, res: Response) {
    const { id } = req.params;

    const orgResult = await pool.query(`
      SELECT id, name, plan, COALESCE(subscription_status, 'trial') as subscription_status,
        trial_ends_at, stripe_customer_id, created_at, updated_at,
        COALESCE(addons, '[]') as addons
      FROM organizations WHERE id = $1
    `, [id]);

    if (orgResult.rows.length === 0) throw new AppError(404, 'Organization not found');

    const orgData = orgResult.rows[0];

    // Fetch users
    try {
      const usersResult = await pool.query(`
        SELECT id, email, role, status, created_at, mfa_enabled
        FROM users WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [id]);
      orgData.users = usersResult.rows;
      orgData.stats = {
        totalUsers: usersResult.rows.length,
        activeUsers: usersResult.rows.filter((u: any) => u.status === 'active').length,
      };
    } catch {
      orgData.users = [];
      orgData.stats = { totalUsers: 0, activeUsers: 0 };
    }

    // Fetch invoices (may fail if table doesn't exist)
    try {
      const invoicesResult = await pool.query(`
        SELECT * FROM invoices WHERE organization_id = $1
        ORDER BY created_at DESC LIMIT 10
      `, [id]);
      orgData.invoices = invoicesResult.rows;
    } catch {
      orgData.invoices = [];
    }

    // Fetch recent shifts count
    try {
      const shiftsResult = await pool.query(`
        SELECT COUNT(*)::int as total
        FROM shifts s
        WHERE s.organization_id = $1 AND s.start_time > NOW() - INTERVAL '30 days'
      `, [id]);
      orgData.stats.recentShifts = shiftsResult.rows[0].total;
    } catch {
      orgData.stats.recentShifts = 0;
    }

    res.json(orgData);
  }

  static async updateOrganizationStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'suspended'];
    if (!validStatuses.includes(status)) throw new AppError(400, 'Invalid status. Must be "active" or "suspended"');

    const org = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [id]);
    if (org.rows.length === 0) throw new AppError(404, 'Organization not found');

    await pool.query('UPDATE organizations SET subscription_status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

    res.json({ message: `Organization ${status === 'suspended' ? 'suspended' : 'reactivated'}`, status });
  }

  static async listUsers(req: Request, res: Response) {
    const { role, status, search, organization_id, page = '1', limit = '50' } = req.query;
    const offset = (Math.max(1, parseInt(page as string)) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (role) { conditions.push(`u.role = $${idx++}`); params.push(role); }
    if (status) { conditions.push(`u.status = $${idx++}`); params.push(status); }
    if (organization_id) { conditions.push(`u.organization_id = $${idx++}`); params.push(organization_id); }
    if (search) { conditions.push(`(u.email ILIKE $${idx} OR EXISTS (SELECT 1 FROM staff_profiles sp WHERE sp.user_id = u.id AND (sp.first_name ILIKE $${idx} OR sp.last_name ILIKE $${idx})))`); params.push(`%${search}%`); idx++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT u.id, u.email, u.role, u.status, u.created_at, u.mfa_enabled,
        o.name as organization_name, o.id as organization_id
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ${parseInt(limit as string)} OFFSET $${idx}
    `, [...params, offset]);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM users u LEFT JOIN organizations o ON u.organization_id = o.id ${where}`,
      params
    );

    res.json({ users: result.rows, total: countResult.rows[0].total });
  }
}
