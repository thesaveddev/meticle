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
      SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_login_at, u.mfa_enabled,
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

  static async getFinanceOverview(_req: Request, res: Response) {
    const [mrr, arr, revenue30d, churnRate, failedPayments, invoicesDue] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(CASE WHEN plan = 'professional' THEN 299 WHEN plan = 'starter' THEN 99 ELSE 0 END), 0) as mrr
        FROM organizations WHERE subscription_status = 'active'
      `),
      pool.query(`
        SELECT COALESCE(SUM(CASE WHEN plan = 'professional' THEN 299*12 WHEN plan = 'starter' THEN 99*12 ELSE 0 END), 0) as arr
        FROM organizations WHERE subscription_status = 'active'
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM invoices WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '30 days'
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status IN ('canceled','expired') AND updated_at > NOW() - INTERVAL '30 days')::float as churned,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::float as active
        FROM organizations
      `),
      pool.query(`
        SELECT id, name, plan, subscription_status, failed_payment_count, first_payment_failed_at
        FROM organizations
        WHERE failed_payment_count > 0 OR subscription_status = 'past_due'
        ORDER BY first_payment_failed_at DESC NULLS LAST
      `),
      pool.query(`
        SELECT COUNT(*)::int as count, COALESCE(SUM(amount), 0) as total
        FROM invoices WHERE status = 'open'
      `),
    ]);

    const churn = churnRate.rows[0].active > 0
      ? ((churnRate.rows[0].churned / (churnRate.rows[0].active + churnRate.rows[0].churned)) * 100).toFixed(1)
      : '0';

    // Revenue by plan
    const revenueByPlan = await pool.query(`
      SELECT plan,
        COUNT(*)::int as org_count,
        COALESCE(SUM(CASE WHEN plan = 'professional' THEN 299 WHEN plan = 'starter' THEN 99 ELSE 0 END), 0) as mrr
      FROM organizations WHERE subscription_status = 'active'
      GROUP BY plan
    `);

    // Recent revenue trend (last 6 months)
    const revenueTrend = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, issued_at)), 'Mon YYYY') as month,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*)::int as invoice_count
      FROM invoices
      WHERE COALESCE(paid_at, issued_at) > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', COALESCE(paid_at, issued_at)), TO_CHAR(DATE_TRUNC('month', COALESCE(paid_at, issued_at)), 'Mon YYYY')
      ORDER BY DATE_TRUNC('month', COALESCE(paid_at, issued_at))
    `);

    res.json({
      mrr: mrr.rows[0].mrr,
      arr: arr.rows[0].arr,
      revenue30d: revenue30d.rows[0].total,
      churnRate: parseFloat(churn),
      failedPayments: failedPayments.rows,
      openInvoices: invoicesDue.rows[0],
      revenueByPlan: revenueByPlan.rows,
      revenueTrend: revenueTrend.rows,
    });
  }

  static async getAuditLog(req: Request, res: Response) {
    const { page = '1', limit = '50' } = req.query;
    const offset = (Math.max(1, parseInt(page as string)) - 1) * parseInt(limit as string);

    const result = await pool.query(`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip_address, a.created_at,
        u.email as user_email, o.name as org_name
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY a.created_at DESC
      LIMIT ${parseInt(limit as string)} OFFSET $1
    `, [offset]);

    const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM audit_log`);

    res.json({ logs: result.rows, total: countResult.rows[0].total });
  }

  static async getSystemHealth(_req: Request, res: Response) {
    const [dbConn, dbSize, tableCounts, emailQueue, webhookEvents] = await Promise.all([
      pool.query(`SELECT now() - pg_postmaster_start() as uptime, version() as version`),
      pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as db_size`),
      pool.query(`
        SELECT 'users' as tbl, COUNT(*)::int as cnt FROM users
        UNION ALL SELECT 'organizations', COUNT(*)::int FROM organizations
        UNION ALL SELECT 'shifts', COUNT(*)::int FROM shifts
        UNION ALL SELECT 'incidents', COUNT(*)::int FROM incidents
        UNION ALL SELECT 'invoices', COUNT(*)::int FROM invoices
        UNION ALL SELECT 'audit_log', COUNT(*)::int FROM audit_log
        UNION ALL SELECT 'email_queue', COUNT(*)::int FROM email_queue
      `),
      pool.query(`
        SELECT status, COUNT(*)::int as count
        FROM email_queue GROUP BY status
      `),
      pool.query(`
        SELECT COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int as last_24h
        FROM stripe_webhook_events
      `),
    ]);

    res.json({
      database: {
        version: dbConn.rows[0].version,
        uptime: dbConn.rows[0].uptime,
        size: dbSize.rows[0].db_size,
      },
      tableCounts: tableCounts.rows,
      emailQueue: emailQueue.rows,
      webhookEvents: webhookEvents.rows[0],
    });
  }

  static async updateUserStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'deactivated'].includes(status))
      throw new AppError(400, 'Invalid status. Must be "active" or "deactivated"');

    const user = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);

    res.json({ message: `User ${status === 'deactivated' ? 'deactivated' : 'activated'}`, status });
  }

  static async updateOrgBilling(req: Request, res: Response) {
    const { id } = req.params;
    const { subscription_status, plan, trial_ends_at } = req.body;

    const org = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [id]);
    if (org.rows.length === 0) throw new AppError(404, 'Organization not found');

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (subscription_status) { updates.push(`subscription_status = $${idx++}`); params.push(subscription_status); }
    if (plan) { updates.push(`plan = $${idx++}`); params.push(plan); }
    if (trial_ends_at) { updates.push(`trial_ends_at = $${idx++}`); params.push(trial_ends_at); }

    if (updates.length === 0) throw new AppError(400, 'No fields to update');

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await pool.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    res.json({ message: 'Organization billing updated' });
  }
}
