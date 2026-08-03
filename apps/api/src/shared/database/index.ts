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
 */
export async function resetRlsSessionVars(client: { query: (text: string, params?: any[]) => Promise<any> }): Promise<void> {
  try {
    await client.query(
      `SELECT set_config('app.current_org_id', '', false),
              set_config('app.current_user_id', '', false),
              set_config('app.current_user_role', '', false)`
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
export default pool;
