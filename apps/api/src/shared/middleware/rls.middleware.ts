import { Request, Response, NextFunction } from 'express';
import pool, { requestDBStorage, resetRlsSessionVars } from '../database';
import logger from '../utils/logger';

/**
 * Per-request DB client middleware.
 *
 * Acquires a dedicated pg client from the pool for the lifetime of the
 * request and stores it in AsyncLocalStorage so that every `query()` call
 * within the same request uses the same connection.  This guarantees that
 * session-level PostgreSQL settings (set by `set_config`) — in particular
 * the RLS session variables `app.current_org_id`, `app.current_user_id`,
 * and `app.current_user_role` — persist across all queries in the request.
 *
 * The actual RLS variables are set by the `authenticate` middleware after
 * it decodes the JWT.  For public routes (no authenticate), the client is
 * still acquired so that downstream code can optionally set vars, and the
 * connection is released when the response finishes.
 *
 * Before a client is released back to the pool, the RLS session variables
 * are cleared so a subsequent request can never inherit the previous
 * user's tenant context (connection poisoning).
 */
export function rlsMiddleware(req: Request, res: Response, next: NextFunction) {
  pool.connect().then(client => {
    // Ensure the client is always released when the response is complete.
    // RLS session vars are cleared first so they never leak into the pool.
    let released = false;
    const releaseClient = async () => {
      if (released) return;
      released = true;
      await resetRlsSessionVars(client);
      try { client.release(); } catch { /* already released */ }
    };
    res.on('finish', () => { void releaseClient(); });
    res.on('close', () => { void releaseClient(); });

    // Store the client in AsyncLocalStorage so query() uses it
    requestDBStorage.run({ client }, () => {
      next();
    });
  }).catch(err => {
    // Never fall back to an unscoped pool query. That would allow a request to
    // continue without the RLS session variables that enforce tenant isolation.
    logger.error({ err }, 'Failed to acquire DB client for request');
    res.status(503).json({
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Service temporarily unavailable. Please try again.',
    });
  });
}
