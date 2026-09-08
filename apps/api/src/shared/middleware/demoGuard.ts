import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import pool from '../database';

/**
 * In-memory cache: orgId → is_demo.
 * Populated lazily on first request per org, and explicitly by markOrgAsDemo().
 */
export const demoOrgCache = new Map<string, boolean>();

/**
 * Middleware that blocks mutation requests (POST, PUT, PATCH, DELETE)
 * for demo organizations. Read-only access is preserved.
 *
 * Must run AFTER authenticate middleware (needs req.user.organizationId).
 */
export async function demoGuard(req: Request, _res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();

  // Only block mutations
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const user = (req as any).user;
  if (!user?.organizationId) return next();

  const orgId = user.organizationId as string;

  // Check cache first
  if (demoOrgCache.get(orgId) === true) {
    throw new AppError(403, 'This is a demo account. Write operations are disabled in the demo environment. Sign up for a free trial to create your own data.');
  }

  if (demoOrgCache.get(orgId) === false) {
    return next();
  }

  // Cache miss — query the database
  try {
    const result = await pool.query(
      `SELECT is_demo FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_demo) {
      demoOrgCache.set(orgId, false);
      return next();
    }

    demoOrgCache.set(orgId, true);
    throw new AppError(403, 'This is a demo account. Write operations are disabled in the demo environment. Sign up for a free trial to create your own data.');
  } catch (err) {
    if (err instanceof AppError) throw err;
    next();
  }
}

/**
 * Mark an organization as demo in the cache.
 */
export function markOrgAsDemo(orgId: string) {
  demoOrgCache.set(orgId, true);
}

/**
 * Mark an organization as non-demo in the cache.
 */
export function markOrgAsNormal(orgId: string) {
  demoOrgCache.set(orgId, false);
}
