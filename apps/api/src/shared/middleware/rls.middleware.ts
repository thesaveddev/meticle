import { Request, Response, NextFunction } from 'express';
import pool from '../database';
import logger from '../utils/logger';

export function rlsMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    next();
    return;
  }

  const queries: string[] = [];
  const params: any[] = [];

  if (user.organizationId) {
    queries.push(`SELECT set_config('app.current_org_id', $1, false)`);
    params.push(user.organizationId);
  }
  if (user.userId) {
    queries.push(`SELECT set_config('app.current_user_id', $1, false)`);
    params.push(user.userId);
  }
  if (user.role) {
    queries.push(`SELECT set_config('app.current_user_role', $1, false)`);
    params.push(user.role);
  }

  if (queries.length === 0) {
    next();
    return;
  }

  const sql = queries.join('; ');
  pool.query(sql, params).then(() => {
    next();
  }).catch((err) => {
    logger.warn({ err }, 'Failed to set RLS session variables');
    next();
  });

  // Reset session variables after response
  res.on('finish', () => {
    pool.query(
      `SELECT set_config('app.current_org_id', '', false);
       SELECT set_config('app.current_user_id', '', false);
       SELECT set_config('app.current_user_role', '', false);`
    ).catch(() => {});
  });
}
