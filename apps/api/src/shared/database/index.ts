import { Pool, types, PoolClient } from 'pg';
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

const pool = new Pool({
  connectionString: dbUrl,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected database pool error');
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

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
