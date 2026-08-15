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

export async function getAppliedMigrations(): Promise<Map<string, string>> {
  const result = await query(`SELECT name, checksum FROM ${MIGRATIONS_TABLE}`);
  return new Map(result.rows.map((r: { name: string; checksum: string }) => [r.name, r.checksum]));
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

/** Extracts the numeric version prefix from a migration name (e.g. '031_event_outbox' -> 31). */
export function getMigrationVersion(name: string): number {
  const match = /^(\d+)/.exec(name);
  if (!match) {
    throw new Error(
      `Migration "${name}" has no numeric version prefix. Every migration must be named like '031_description' so ordering can be derived automatically.`
    );
  }
  return parseInt(match[1], 10);
}

/**
 * Orders migrations by their numeric version prefix instead of trusting the
 * caller's array order, and rejects duplicate versions outright. This is what
 * replaces the fragile flat-array assumption: the array position no longer
 * determines execution order.
 */
export function sortMigrations(migrations: Migration[]): Migration[] {
  const sorted = [...migrations].sort((a, b) => getMigrationVersion(a.name) - getMigrationVersion(b.name));
  const seen = new Map<number, string>();
  for (const migration of sorted) {
    const version = getMigrationVersion(migration.name);
    const existing = seen.get(version);
    if (existing !== undefined) {
      throw new Error(
        `Duplicate migration version ${version} — "${existing}" and "${migration.name}". Each migration needs a unique numeric prefix.`
      );
    }
    seen.set(version, migration.name);
  }
  return sorted;
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

  // Ordering is derived from the numeric prefix, never the array position.
  const ordered = sortMigrations(migrations);

  // The highest already-applied version is the watermark. Any migration that
  // has NOT yet run but is at or below it was inserted/renamed after newer
  // migrations shipped — running it now would be a dangerous backfill on live
  // data. Refuse loudly; the fix is a new higher-numbered migration.
  let maxAppliedVersion = 0;
  for (const name of applied.keys()) {
    try {
      maxAppliedVersion = Math.max(maxAppliedVersion, getMigrationVersion(name));
    } catch {
      // Legacy name without a numeric prefix (pre-versioning) — ignore.
    }
  }

  for (const migration of ordered) {
    const version = getMigrationVersion(migration.name);
    const appliedChecksum = applied.get(migration.name);
    if (appliedChecksum !== undefined) {
      // A checksum change on an already-applied migration means statements were edited
      // after the migration ran. The runner cannot safely re-apply them (it skips by name),
      // so surface the drift loudly instead of silently running without the new DDL.
      const checksum = computeChecksum(migration.statements);
      if (checksum !== appliedChecksum) {
        logger.error(
          { migration: migration.name, previousChecksum: appliedChecksum, currentChecksum: checksum },
          'Migration already applied but checksum differs — statements were modified after apply and will NOT re-run. Ship a new numbered migration instead.'
        );
      } else {
        logger.debug(`Migration ${migration.name} already applied, skipping`);
      }
      continue;
    }

    // Unapplied migration whose version is behind the newest applied one.
    if (maxAppliedVersion > 0 && version <= maxAppliedVersion) {
      throw new Error(
        `Migration "${migration.name}" (version ${version}) has not been applied but is older than the newest applied migration (${maxAppliedVersion}). ` +
          `You cannot backfill/insert a migration after newer ones have shipped. Ship a new migration with a version greater than ${maxAppliedVersion} instead.`
      );
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
