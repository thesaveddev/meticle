import { Request, Response } from 'express';
import { query, transaction, migrateQuery } from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { clearPermissionCacheForUser } from '../../shared/middleware/requirePermission';

const MODULES = [
  'dashboard',
  'people',
  'emedication',
  'staff_directory',
  'scheduling',
  'marketplace',
  'agencies',
  'leave',
  'compliance',
  'training',
  'policies',
  'incidents',
  'reporting',
  'chat',
  'tasks',
  'appointments',
  'expenses',
  'homecare',
  'call_scheduling',
  'mileage_travel',
  'payroll_export',
  'client_billing',
  'room_checks',
  'settings',
  'billing',
  'learn',
];

const MODULE_SERVICE_TYPES: Record<string, string[]> = {
  emedication: ['supported_living', 'residential'],
  scheduling: ['supported_living', 'residential'],
  agencies: ['supported_living', 'residential'],
  tasks: ['supported_living', 'residential'],
  appointments: ['supported_living', 'residential'],
  expenses: ['supported_living', 'residential'],
  room_checks: ['supported_living', 'residential'],
  homecare: ['domiciliary', 'live_in'],
  call_scheduling: ['domiciliary', 'live_in'],
  mileage_travel: ['domiciliary', 'live_in'],
  payroll_export: ['domiciliary', 'live_in'],
  client_billing: ['domiciliary', 'live_in'],
};

export function getAvailableModules(serviceTypes: string[], primaryServiceType?: string | null) {
  const effectiveTypes = primaryServiceType ? [primaryServiceType] : serviceTypes;
  return MODULES.filter(module => {
    const allowedTypes = MODULE_SERVICE_TYPES[module];
    return !allowedTypes || effectiveTypes.some(type => allowedTypes.includes(type));
  });
}

const ROLE_DEFAULTS: Record<string, Record<string, string>> = {
  ORG_ADMIN: { dashboard: 'edit', people: 'edit', emedication: 'edit', staff_directory: 'edit', scheduling: 'edit', marketplace: 'edit', agencies: 'edit', leave: 'edit', compliance: 'edit', training: 'edit', policies: 'edit', incidents: 'edit', reporting: 'edit', chat: 'edit', tasks: 'edit', appointments: 'edit', expenses: 'edit', homecare: 'edit', call_scheduling: 'edit', mileage_travel: 'edit', payroll_export: 'edit', client_billing: 'edit', room_checks: 'edit', settings: 'edit', billing: 'edit', learn: 'edit' },
  MANAGER: { dashboard: 'edit', people: 'edit', emedication: 'edit', staff_directory: 'edit', scheduling: 'edit', marketplace: 'edit', agencies: 'edit', leave: 'edit', compliance: 'edit', training: 'edit', policies: 'edit', incidents: 'edit', reporting: 'edit', chat: 'edit', tasks: 'edit', appointments: 'edit', expenses: 'view', homecare: 'edit', call_scheduling: 'edit', mileage_travel: 'edit', payroll_export: 'edit', client_billing: 'edit', room_checks: 'edit', settings: 'view', billing: 'view', learn: 'view' },
  CARE_WORKER: { dashboard: 'view', people: 'none', emedication: 'view', staff_directory: 'none', scheduling: 'view', marketplace: 'view', agencies: 'none', leave: 'view', compliance: 'view', training: 'none', policies: 'none', incidents: 'none', reporting: 'none', chat: 'view', tasks: 'none', appointments: 'view', expenses: 'view', homecare: 'view', call_scheduling: 'view', mileage_travel: 'view', payroll_export: 'none', client_billing: 'none', room_checks: 'none', settings: 'view', billing: 'none', learn: 'view' },
  COMPLIANCE_OFFICER: { dashboard: 'view', people: 'view', emedication: 'view', staff_directory: 'view', scheduling: 'none', marketplace: 'none', agencies: 'none', leave: 'view', compliance: 'edit', training: 'edit', policies: 'view', incidents: 'view', reporting: 'view', chat: 'view', tasks: 'view', appointments: 'view', expenses: 'none', homecare: 'none', call_scheduling: 'none', mileage_travel: 'none', payroll_export: 'none', client_billing: 'none', room_checks: 'view', settings: 'view', billing: 'none', learn: 'view' },
};

export class PermissionsController {
  static async getUserPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const orgId = req.user!.organizationId;
    const requesterId = req.user!.userId;
    const requesterRole = req.user!.role;

    if (!orgId) throw new AppError(403, 'Organization context required');

    // Users can see their own permissions; ORG_ADMIN and MANAGER can see anyone's
    if (userId !== requesterId && requesterRole !== 'ORG_ADMIN' && requesterRole !== 'MANAGER') {
      throw new AppError(403, 'You can only view your own permissions');
    }

    const user = await query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');

    const [result, organization] = await Promise.all([
      query('SELECT module, permission_level FROM user_permissions WHERE user_id = $1', [userId]),
      query('SELECT service_types, primary_service_type FROM organizations WHERE id = $1', [orgId]),
    ]);

    const availableModules = getAvailableModules(
      organization.rows[0]?.service_types || [],
      organization.rows[0]?.primary_service_type || null,
    );
    const defaults = ROLE_DEFAULTS[user.rows[0].role] || {};
    const overrides = Object.fromEntries(result.rows.map((r: any) => [r.module, r.permission_level]));
    const permissions = availableModules.map(module => ({
      module,
      permission_level: overrides[module] ?? defaults[module] ?? 'none',
    }));
    const roleDefaults = Object.fromEntries(Object.entries(ROLE_DEFAULTS).map(([role, values]) => [
      role,
      Object.fromEntries(availableModules.map(module => [module, values[module] ?? 'none'])),
    ]));

    res.json({ permissions, role: user.rows[0].role, role_defaults: roleDefaults });
  }

  static async updateUserPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const { permissions } = req.body;
    const orgId = req.user!.organizationId;
    const requesterRole = req.user!.role;

    if (!orgId) throw new AppError(403, 'Organization context required');

    if (requesterRole !== 'ORG_ADMIN' && requesterRole !== 'MANAGER') {
      throw new AppError(403, 'Only admins and managers can update permissions');
    }
    if (requesterRole === 'MANAGER') {
      throw new AppError(403, 'Only organisation admins can update permissions');
    }

    const user = await query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [userId, orgId]);
    if (user.rows.length === 0) throw new AppError(404, 'User not found');
    const organization = await query('SELECT service_types, primary_service_type FROM organizations WHERE id = $1', [orgId]);
    const validModules = new Set(getAvailableModules(
      organization.rows[0]?.service_types || [],
      organization.rows[0]?.primary_service_type || null,
    ));
    for (const permission of permissions) {
      if (!validModules.has(permission.module)) {
        throw new AppError(400, `Module ${permission.module} is not available for this organisation`);
      }
      if (!['none', 'view', 'edit'].includes(permission.permission_level)) {
        throw new AppError(400, `Invalid permission level for ${permission.module}`);
      }
    }

    await transaction(async (client) => {
      await client.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
      for (const perm of permissions) {
        await client.query(
          'INSERT INTO user_permissions (user_id, module, permission_level) VALUES ($1, $2, $3) ON CONFLICT (user_id, module) DO UPDATE SET permission_level = $3',
          [userId, perm.module, perm.permission_level]
        );
      }
    });

    clearPermissionCacheForUser(userId);
    res.json({ message: 'Permissions updated' });
  }

  static async getModules(req: Request, res: Response) {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError(403, 'Organization context required');
    const organization = await query('SELECT service_types, primary_service_type FROM organizations WHERE id = $1', [orgId]);
    res.json({ modules: getAvailableModules(
      organization.rows[0]?.service_types || [],
      organization.rows[0]?.primary_service_type || null,
    ) });
  }

  static async setDefaultPermissions(userId: string, role: string) {
    const userOrg = await migrateQuery(
      `SELECT o.service_types, o.primary_service_type
       FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = $1`,
      [userId],
    );
    // Role defaults may have been seeded before the service model was set, or
    // under a previous role. Keep all permission records aligned to current org
    // availability and avoid carrying any stale disallowed grants forward.
    await migrateQuery('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
    const availableModules = getAvailableModules(
      userOrg.rows[0]?.service_types || [],
      userOrg.rows[0]?.primary_service_type || null,
    );
    const available = new Set(availableModules);
    const defaults = ROLE_DEFAULTS[role] || {};
    const entries = Object.entries(defaults).filter(([module, level]) => available.has(module) && level !== 'none');
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
    clearPermissionCacheForUser(userId);
  }
}

export { MODULES, ROLE_DEFAULTS };
