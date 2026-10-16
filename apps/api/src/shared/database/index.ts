import { Pool, types, PoolClient, QueryResult } from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

types.setTypeParser(types.builtins.NUMERIC, (val: string) => parseFloat(val));
types.setTypeParser(types.builtins.FLOAT8, (val: string) => parseFloat(val));
types.setTypeParser(types.builtins.INT4, (val: string) => parseInt(val, 10));
types.setTypeParser(types.builtins.INT8, (val: string) => parseInt(val, 10));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

/**
 * The session timezone, which is what decides what `CURRENT_DATE` means.
 *
 * Postgres resolves `CURRENT_DATE`, `NOW()::date` and `date_trunc('day', …)` in
 * the session's `TimeZone`, and nothing set it, so every one of them was UTC.
 * For a UK provider that is the *previous* day for the first hour of every BST
 * day — the hour a night shift hands over — so "today's appointments" answered
 * with yesterday's until 01:00, Mica resolved "today" to yesterday, and the
 * monthly medicines roll-up was keyed on the wrong month at a month boundary.
 *
 * The default is `Europe/London` because every nation this product supports
 * (England, Wales, Scotland, Northern Ireland, Ireland) shares that offset and
 * those DST rules, and because it is the value the product already assumes
 * elsewhere: `homecare_digest_preferences.timezone` defaults to it.
 *
 * It is a *default*, not the answer. `organizations.timezone` (migration 149) is
 * applied per request in `setRlsSessionVars`, so a provider outside the UK names
 * its days in its own zone; this value is what a connection falls back to — for
 * a tenant whose column is unusable, for background jobs and scripts that run
 * outside any request, and after `resetRlsSessionVars` hands a connection back
 * to the pool.
 *
 * Timestamps are unaffected — they are `timestamptz`, which is absolute. Only
 * the *naming* of a day changes, and that is the point.
 */
const requestedTimeZone = process.env.DB_TIMEZONE || 'Europe/London';
// `SET` takes no parameters, so this is `set_config`, and a malformed value is
// rejected here rather than left to fail on every connection checkout.
const sessionTimeZone = /^[A-Za-z0-9_+\-/]{1,64}$/.test(requestedTimeZone) ? requestedTimeZone : 'Europe/London';

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
};

/** App pool — connects as the minimal-privilege role (DATABASE_URL) */
const pool = new Pool({ connectionString: dbUrl, ...poolConfig });

/**
 * Migration pool — connects as superuser for DDL operations (CREATE TABLE, etc.)
 * Falls back to DATABASE_URL when DATABASE_MIGRATE_URL is not set (backward compat).
 */
const migrateUrl = process.env.DATABASE_MIGRATE_URL || dbUrl;
const migratePool = new Pool({ connectionString: migrateUrl, ...poolConfig });

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database pool error');
});

migratePool.on('error', (err) => {
  logger.error(err, 'Unexpected migrate pool error');
});

// Handle connection-level errors gracefully
pool.on('connect', (client) => {
  client.on('error', (err: Error) => {
    logger.warn({ message: err.message }, 'Client connection error — will be replaced by pool');
  });
});

//
// Every pooled connection names days in the session timezone, on both pools, or
// `CURRENT_DATE` is UTC again for whoever misses this line. `set_config(…, false)`
// is per-connection, so it is invisible to the next checkout of a different
// client — which is what is wanted: an app role must not change the database's
// own default for everyone else.
const applySessionTimeZone = (client: PoolClient) => {
  client.query("SELECT set_config('TimeZone', $1, false)", [sessionTimeZone]).catch((err: Error) => {
    // Never fatal: a wrong timezone is a wrong day, a refused connection is an
    // outage. Log loudly and let the query run in whatever the server default is.
    logger.error({ message: err.message, timezone: sessionTimeZone }, 'Could not set the session timezone — CURRENT_DATE will resolve in the server default');
  });
};

pool.on('connect', applySessionTimeZone);
migratePool.on('connect', applySessionTimeZone);

/** The IANA zone every pooled connection names its days in (see above). */
export const databaseSessionTimeZone = sessionTimeZone;

export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// ── Request-scoped DB client via AsyncLocalStorage ──────────────────────
// rlsMiddleware acquires a client per request and stores it here.
// The query() helper below transparently uses it so that RLS session
// variables set by the authenticate middleware persist across all queries
// within the same request.
interface RequestDBContext {
  client: PoolClient;
}
export const requestDBStorage = new AsyncLocalStorage<RequestDBContext>();

/**
 * Execute a query. Uses the request-scoped client from AsyncLocalStorage
 * when available (set by rlsMiddleware), otherwise falls back to the pool.
 */
export const query = (text: string, params?: any[]) => {
  const ctx = requestDBStorage.getStore();
  if (ctx) {
    return ctx.client.query(text, params);
  }
  return pool.query(text, params);
};

/**
 * Patch pool.query to transparently use the ALS request-scoped client.
 * This ensures the ~385 direct pool.query() calls across all controllers
 * automatically use the correct connection with RLS session variables set,
 * without requiring code changes in every file.
 */
const _originalPoolQuery = pool.query.bind(pool);
(pool as any).query = (text: string | any, params?: any[], callback?: (err: Error, result: QueryResult<any>) => void) => {
  if (typeof text === 'string') {
    const ctx = requestDBStorage.getStore();
    if (ctx) {
      return ctx.client.query(text, params);
    }
  }
  return callback ? _originalPoolQuery(text, params ?? [], callback) : _originalPoolQuery(text, params ?? []);
};

/** Query via the superuser migration pool (for DDL / setup / cross-tenant auth operations) */
export const migrateQuery = (text: string, params?: any[]) => migratePool.query(text, params);

/**
 * Clear the RLS session variables on a pooled client.
 *
 * Session-level settings set with `set_config(..., false)` persist on the
 * underlying PostgreSQL connection. If they are not cleared before a client
 * is returned to the pool, the next request reusing that connection inherits
 * the previous user's org/user/role context (connection poisoning). Public
 * routes and background jobs would then operate against the wrong tenant.
 *
 * The session timezone is part of that context and is reset with them: a
 * connection that named days in one provider's zone must not name the next
 * request's days in it. It goes back to the deploy-time default rather than the
 * tenant value, because the next holder may be a public route or a job with no
 * tenant at all.
 */
export async function resetRlsSessionVars(client: { query: (text: string, params?: any[]) => Promise<any> }): Promise<void> {
  try {
    await client.query(
      `SELECT set_config('app.current_org_id', '', false),
              set_config('app.current_user_id', '', false),
              set_config('app.current_user_role', '', false),
              set_config('TimeZone', $1, false)`,
      [sessionTimeZone]
    );
  } catch {
    // Connection may already be broken — the reset is best-effort.
  }
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  // Use the ALS request-scoped client when available so that RLS session
  // variables persist inside the transaction.
  const ctx = requestDBStorage.getStore();
  const client = ctx ? ctx.client : await pool.connect();
  const ownsClient = !ctx;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownsClient) client.release();
  }
}

export { migratePool };

export async function closeDatabasePools(): Promise<void> {
  await Promise.all([pool.end(), migratePool.end()]);
}

export default pool;
