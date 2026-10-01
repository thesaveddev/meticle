/**
 * Encrypts every column listed in `ENCRYPTED_COLUMNS` for rows written before
 * field encryption was switched on.
 *
 * Driven by the registry rather than a list of its own. A hand-maintained list
 * here is how the backfill and the read paths drift apart: the application
 * starts treating a column as encrypted while the rows behind it are still
 * plaintext, which reads fine and stores nothing.
 *
 * Runs outside the API because key derivation needs each row's organization and
 * an RLS-scoped connection cannot read across organizations. Uses `migratePool`,
 * the same bypass the migrations use.
 *
 * Safe to re-run. A value already in ciphertext form is skipped, so the script is
 * resumable after an interruption and idempotent if run twice.
 *
 *   npm run backfill:pii-encryption --workspace apps/api
 *
 * Requires FIELD_ENCRYPTION_KEY, and it must be the same value the API uses. A
 * wrong key would re-encrypt rows under a key nobody can read back with, so the
 * script refuses to run unless the key is present and well formed — which is the
 * only check available here.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { migratePool, closeDatabasePools } from '../shared/database';
import logger from '../shared/utils/logger';
import { encryptField, isCiphertext, assertFieldEncryptionConfigured } from '../shared/utils/encryption';
import { ENCRYPTED_COLUMNS } from '../shared/utils/encrypted-columns';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH_SIZE = 200;

/**
 * How to get each row's organisation, and its keyset column.
 *
 * `people` carries `organization_id`. `staff_profiles` does not — it reaches the
 * organization through `user_id → users.organization_id`, which is also how its
 * RLS policy is written — so the keyset has to be its own `id`.
 */
const TARGETS: {
  table: string
  keyset: string
  orgExpression: string
}[] = [
  { table: 'people', keyset: 'id', orgExpression: 'organization_id' },
  { table: 'staff_profiles', keyset: 'id', orgExpression: '(SELECT u.organization_id FROM users u WHERE u.id = user_id)' },
]

async function backfillTable(target: (typeof TARGETS)[number]): Promise<void> {
  const columns = ENCRYPTED_COLUMNS[target.table] ?? []
  const columnList = columns.map(c => `"${c}"`).join(', ')
  const selectList = columns
    .map(c => `NULLIF("${c}", '') AS "${c}"`)
    .join(', ')

  let encrypted = 0
  let skipped = 0
  let lastId: string | null = null

  for (;;) {
    // Keyset pagination, not OFFSET: rows are being updated underneath the
    // cursor, so a positional walk would skip some.
    const batch = await migratePool.query(
      `SELECT id, ${target.orgExpression} AS org_id, ${selectList}
         FROM ${target.table}
        WHERE ($1::uuid IS NULL OR id > $1::uuid)
          AND (${columns.map(c => `"${c}" IS NOT NULL`).join(' OR ')})
        ORDER BY id
        LIMIT $2`,
      [lastId, BATCH_SIZE],
    )
    const rows = batch.rows as Array<Record<string, string | null>>
    if (rows.length === 0) break

    for (const row of rows) {
      lastId = row.id as string
      const orgId = row.org_id
      if (!orgId) {
        logger.warn(`${target.table} ${row.id} has no resolvable organization; left as-is.`)
        continue
      }

      const assignments: string[] = []
      const values: unknown[] = []
      for (const column of columns) {
        const value = row[column]
        if (value == null || value === '') continue
        if (isCiphertext(value)) {
          skipped += 1
          continue
        }
        const cipher = encryptField(value, orgId)
        if (cipher === null) continue
        values.push(cipher)
        assignments.push(`"${column}" = $${values.length}`)
      }
      if (assignments.length === 0) continue

      values.push(row.id)
      await migratePool.query(
        `UPDATE ${target.table} SET ${assignments.join(', ')} WHERE id = $${values.length}`,
        values,
      )
      encrypted += 1
    }

    logger.info(`${target.table}: batch done. Encrypted so far ${encrypted}, already ciphertext ${skipped}.`)
  }

  logger.info(`${target.table}: finished. Encrypted ${encrypted} row(s); ${skipped} already ciphertext.`)
}

async function main(): Promise<void> {
  // Throws rather than warning, which matters doubly here: a run that proceeded
  // with a missing key would rewrite every row as plaintext and call it done.
  assertFieldEncryptionConfigured()
  logger.info('FIELD_ENCRYPTION_KEY present and well formed.')

  for (const target of TARGETS) {
    await backfillTable(target)
  }
  logger.info('Backfill complete.')
}

main()
  .catch(err => {
    logger.error(`Backfill failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => closeDatabasePools())