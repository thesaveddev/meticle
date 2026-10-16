import { Request, Response, NextFunction } from 'express';
import pool, { requestDBStorage, resetRlsSessionVars } from '../database';
import logger from '../utils/logger';
import { auditWriteStorage, createAuditWriteStore, flushAuditWrites } from '../audit/auditDurability';

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
 *
 * It also owns the request-scoped audit store and the deferral of `res.end`,
 * because both are about this same lifetime: the audit rows a request writes use
 * the connection held here, so the response must not complete (and therefore
 * release the connection) while one of them is still in flight. That is why the
 * flush lives in this middleware rather than beside it — anything that mounts
 * this middleware gets both, including the test app.
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

    // Hold the response open until the audit rows this request wrote have
    // committed, so a client that received a 201 cannot be looking at a change
    // with no record of who made it. Two things this is not: it is not a wait on
    // a *failed* write (the write's promise resolves either way), and it is not
    // unbounded (see the timeout in the module). Requests that write no audit
    // row take the untracked path and are not delayed at all.
    const auditStore = createAuditWriteStore();
    const originalEnd = res.end.bind(res);
    let ending = false;
    res.end = function (this: Response, ...args: any[]) {
      if (ending || auditStore.pending.size === 0) {
        ending = true;
        return (originalEnd as (...a: any[]) => Response)(...args);
      }
      ending = true;
      // `then` rather than `finally`: flushAuditWrites does not reject, and a
      // rejection here must not leave the response unsent.
      void flushAuditWrites(auditStore).then(() => { (originalEnd as (...a: any[]) => Response)(...args); });
      return res;
    } as typeof res.end;

    // Store the client in AsyncLocalStorage so query() uses it, and the audit
    // store alongside it so audit_logs writes can be found at the end of the
    // response rather than only by the handler that made them.
    requestDBStorage.run({ client }, () => {
      auditWriteStorage.run(auditStore, () => {
        next();
      });
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
