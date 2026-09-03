import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { query } from '../database';

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  level: string;
  expiresAt: number;
}

const permissionCache = new Map<string, CacheEntry>();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of permissionCache) {
    if (now > entry.expiresAt) permissionCache.delete(key);
  }
}, 60_000).unref();

// Role-level defaults mirroring PermissionsController.ROLE_DEFAULTS
const ROLE_DEFAULTS: Record<string, Record<string, string>> = {
  ORG_ADMIN: { dashboard: 'edit', people: 'edit', emedication: 'edit', staff_directory: 'edit', scheduling: 'edit', marketplace: 'edit', agencies: 'edit', leave: 'edit', compliance: 'edit', training: 'edit', policies: 'edit', incidents: 'edit', reporting: 'edit', chat: 'edit', tasks: 'edit', appointments: 'edit', expenses: 'edit', room_checks: 'edit', settings: 'edit', billing: 'edit', learn: 'edit' },
  MANAGER: { dashboard: 'edit', people: 'edit', emedication: 'edit', staff_directory: 'edit', scheduling: 'edit', marketplace: 'edit', agencies: 'edit', leave: 'edit', compliance: 'edit', training: 'edit', policies: 'edit', incidents: 'edit', reporting: 'edit', chat: 'edit', tasks: 'edit', appointments: 'edit', expenses: 'view', room_checks: 'edit', settings: 'view', billing: 'view', learn: 'view' },
  CARE_WORKER: { dashboard: 'view', people: 'none', emedication: 'view', staff_directory: 'none', scheduling: 'view', marketplace: 'view', agencies: 'none', leave: 'view', compliance: 'view', training: 'none', policies: 'none', incidents: 'none', reporting: 'none', chat: 'view', tasks: 'none', appointments: 'view', expenses: 'view', room_checks: 'none', settings: 'view', billing: 'none', learn: 'view' },
  COMPLIANCE_OFFICER: { dashboard: 'view', people: 'view', emedication: 'view', staff_directory: 'view', scheduling: 'none', marketplace: 'none', agencies: 'none', leave: 'view', compliance: 'edit', training: 'edit', policies: 'view', incidents: 'view', reporting: 'view', chat: 'view', tasks: 'view', appointments: 'view', expenses: 'none', room_checks: 'view', settings: 'view', billing: 'none', learn: 'view' },
};

export const requirePermission = (module: string, requiredLevel: 'view' | 'edit') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    const cacheKey = `${req.user.userId}:${module}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      if (cached.level === 'none' || (requiredLevel === 'edit' && cached.level !== 'edit')) {
        return next(new AppError(403, `You don't have permission to access ${module}`));
      }
      return next();
    }

    let result = await query(
      `SELECT permission_level FROM user_permissions WHERE user_id = $1 AND module = $2`,
      [req.user.userId, module]
    );
    let permission = result.rows[0]?.permission_level;

    // Fall back to role defaults if no DB row exists
    if (!permission) {
      permission = ROLE_DEFAULTS[req.user.role]?.[module] || 'none';
    }

    // If no direct permission, check delegations — a delegate inherits the primary manager's permissions
    if (permission === 'none') {
      const delResult = await query(
        `SELECT up.permission_level FROM manager_delegations md
         JOIN user_permissions up ON up.user_id = md.primary_manager_id
         WHERE md.delegate_manager_id = $1 AND md.is_active = true
           AND up.module = $2
           AND (md.ends_at IS NULL OR md.ends_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [req.user.userId, module]
      );
      if (delResult.rows.length > 0) {
        permission = delResult.rows[0].permission_level;
      }
    }

    permissionCache.set(cacheKey, { level: permission, expiresAt: Date.now() + CACHE_TTL_MS });

    if (!permission || permission === 'none') {
      return next(new AppError(403, `You don't have permission to access ${module}`));
    }
    if (requiredLevel === 'edit' && permission !== 'edit') {
      return next(new AppError(403, `You need edit permission for ${module}`));
    }
    next();
  };
};

export { ROLE_DEFAULTS };
