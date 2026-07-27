import { migrateQuery as query } from './index';
import logger from '../utils/logger';
import crypto from 'crypto';

const MIGRATIONS_TABLE = '_migrations';

export async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      statements_count INTEGER NOT NULL DEFAULT 0,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      duration_ms INTEGER NOT NULL DEFAULT 0
    )
  `);
}

export async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((r: { name: string }) => r.name));
}

function computeChecksum(statements: string[]): string {
  const hash = crypto.createHash('sha256');
  for (const stmt of statements) {
    hash.update(stmt.replace(/\s+/g, ' ').trim());
  }
  return hash.digest('hex');
}

export interface Migration {
  name: string;
  statements: string[];
  /** When true (default), any SQL error aborts the migration.
   *  When false, errors are logged and skipped (legacy-compatible). */
  strict?: boolean;
}

/** Known "already exists" / harmless error codes from legacy re-runs. */
const HARMLESS_CODES = new Set([
  '42P16', // cannot use IF NOT EXISTS with constraint
  '42710', // duplicate object
  '42701', // duplicate column
  '42P07', // duplicate table
  '42883', // function does not exist
]);

export async function runMigrations(migrations: Migration[]): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      logger.debug(`Migration ${migration.name} already applied, skipping`);
      continue;
    }

    const strict = migration.strict !== false;
    const checksum = computeChecksum(migration.statements);
    logger.info(`Applying migration: ${migration.name} (${migration.statements.length} stmts, ${strict ? 'strict' : 'legacy'} mode)`);
    const start = Date.now();

    // Process each statement individually (not in a wrapping transaction)
    // so that one failure doesn't abort the whole migration.
    // Legacy (non-strict) mode matches the original setup.ts behaviour of
    // silently skipping errors. Strict mode only skips known-harmless codes.
    let appliedCount = 0;
    let skippedCount = 0;

    for (const stmt of migration.statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      try {
        await query(trimmed);
        appliedCount++;
      } catch (err: any) {
        if (!strict || HARMLESS_CODES.has(err?.code)) {
          logger.warn({ err: err.message, code: err.code, migration: migration.name }, 'Migration statement skipped');
          skippedCount++;
          continue;
        }
        logger.error({ err, migration: migration.name, stmt: trimmed.slice(0, 200) }, 'Migration statement failed');
        throw err;
      }
    }

    const duration = Date.now() - start;
    await query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name, checksum, statements_count, duration_ms) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING`,
      [migration.name, checksum, appliedCount, duration]
    );
    logger.info({ migration: migration.name, duration_ms: duration, appliedCount, skippedCount }, 'Migration applied');
  }
}
