/**
 * Encrypts `people.nhs_number` for rows written before T0-15 was implemented.
 *
 * Runs outside the API because the key derivation needs the row's organization
 * id, and a RLS-scoped connection cannot read across organizations. Uses
 * `migratePool`, the same bypass the migrations use.
 *
 * Safe to re-run. Rows whose value is already in ciphertext form are skipped,
 * which is what makes it resumable after an interruption and idempotent if it is
 * run twice by mistake.
 *
 *   npm run backfill:nhs-encryption --workspace apps/api
 *
 * Requires FIELD_ENCRYPTION_KEY to be set to the same value the API uses. If it
 * is wrong, every row is re-encrypted under a key nobody can read back with, so
 * the script refuses to run unless the key is present and well formed — which is
 * the only check available here.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { migratePool, closeDatabasePools } from '../shared/database';
import logger from '../shared/utils/logger';
import { encryptField, isCiphertext, assertFieldEncryptionConfigured } from '../shared/utils/encryption';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH_SIZE = 200;

async function main(): Promise<void> {
  // Throws rather than warning, which matters doubly here: a run that proceeded
  // with a missing key would rewrite every row as plaintext and call it done.
  assertFieldEncryptionConfigured();
  logger.info('FIELD_ENCRYPTION_KEY present and well formed.');

  let encrypted = 0;
  let skipped = 0;
  let lastId: string | null = null;

  interface BackfillRow { id: string; organization_id: string; nhs_number: string }

  for (;;) {
    // Keyset pagination, not OFFSET: rows are being updated underneath the
    // cursor, so a positional walk would skip some.
    const batch = await migratePool.query(
      `SELECT id, organization_id, nhs_number
         FROM people
        WHERE nhs_number IS NOT NULL AND nhs_number <> ''
          AND ($1::uuid IS NULL OR id > $1::uuid)
        ORDER BY id
        LIMIT $2`,
      [lastId, BATCH_SIZE],
    );
    const rows = batch.rows as BackfillRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      lastId = row.id;
      if (isCiphertext(row.nhs_number)) {
        skipped += 1;
        continue;
      }
      const cipher = encryptField(row.nhs_number, row.organization_id);
      if (cipher === null) continue;
      await migratePool.query('UPDATE people SET nhs_number = $1 WHERE id = $2', [cipher, row.id]);
      encrypted += 1;
    }

    logger.info(`Batch complete. Encrypted so far: ${encrypted}, already encrypted: ${skipped}.`);
  }

  logger.info(`Done. Encrypted ${encrypted} row(s); ${skipped} were already ciphertext.`);
}

main()
  .catch((err) => {
    logger.error(`Backfill failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabasePools());