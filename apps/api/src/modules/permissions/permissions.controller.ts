import { Request, Response } from 'express';
import { query, transaction, migrateQuery } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';

const MODULES = [
  'dashboard',
  'staff_directory',
  'compliance',
  'scheduling',
  'marketplace',
  'reporting',
  'settings',
  'leave',
];

const ROLE_DEFAULTS: Record<string, Record<string, string>> = {
  ORG_ADMIN: { dashboard: 'edit', staff_directory: 'edit', compliance: 'edit', scheduling: 'edit', marketplace: 'edit', reporting: 'edit', settings: 'edit', leave: 'edit' },
  MANAGER: { dashboard: 'edit', staff_directory: 'edit', compliance: 'edit', scheduling: 'edit', marketplace: 'edit', reporting: 'edit', settings: 'view', leave: 'edit' },
  CARE_WORKER: { dashboard: 'view', staff_directory: 'none', compliance: 'view', scheduling: 'view', marketplace: 'view', reporting: 'none', settings: 'view', leave: 'view' },
  COMPLIANCE_OFFICER: { dashboard: 'view', staff_directory: 'view', compliance: 'edit', scheduling: 'none', marketplace: 'none', reporting: 'view', settings: 'view', leave: 'view' },
};

export class PermissionsController {
  static async getUserPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    // Users can see their own permissions; ORG_ADMIN and MANAGER can see anyone's
    if (userId !== requesterId && requesterRole !== 'ORG_ADMIN' && requesterRole !== 'MANAGER') {
      throw new AppError(403, 'You can only view your own permissions');
    }

    const user = await query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    const result = await query(
      'SELECT module, permission_level FROM user_permissions WHERE user_id = $1',
      [userId]
    );

    const defaults = ROLE_DEFAULTS[user.rows[0].role] || {};
    const overrides = Object.fromEntries(result.rows.map((r: any) => [r.module, r.permission_level]));

    const permissions = MODULES.map(m => ({
      module: m,
      permission_level: overrides[m] ?? defaults[m] ?? 'none',
    }));

    res.json({ permissions, role: user.rows[0].role });
  }

  static async updateUserPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const { permissions } = req.body;
    const orgId = req.user!.organizationId;
    const requesterRole = req.user!.role;

    if (requesterRole !== 'ORG_ADMIN' && requesterRole !== 'MANAGER') {
      throw new AppError(403, 'Only admins and managers can update permissions');
    }

    const user = await query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    await transaction(async (client) => {
      await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
      for (const perm of permissions) {
        await client.query(
          'INSERT INTO user_permissions (user_id, module, permission_level) VALUES ($1, $2, $3) ON CONFLICT (user_id, module) DO UPDATE SET permission_level = $3',
          [userId, perm.module, perm.permission_level]
        );
      }
    });

    res.json({ message: 'Permissions updated' });
  }

  static async getModules(_req: Request, res: Response) {
    res.json({ modules: MODULES });
  }

  static async setDefaultPermissions(userId: string, role: string) {
    const defaults = ROLE_DEFAULTS[role] || {};
    const entries = Object.entries(defaults).filter(([, level]) => level !== 'none');
    if (entries.length === 0) return;
    // Runs via the superuser pool: it is invoked from public auth routes (no RLS
    // session context) and from staff creation. The userId is always scoped to an
    // organization the caller already controls, so RLS bypass is safe here.
    for (const [module, level] of entries) {
      await migrateQuery(
        'INSERT INTO user_permissions (user_id, module, permission_level) VALUES ($1, $2, $3) ON CONFLICT (user_id, module) DO NOTHING',
        [userId, module, level]
      );
    }
  }
}

export { MODULES, ROLE_DEFAULTS };
