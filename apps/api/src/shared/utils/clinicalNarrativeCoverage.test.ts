import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ENCRYPTED_COLUMNS } from './encrypted-columns';

/**
 * The clinical narrative columns are encrypted at rest, which means every file
 * that reads one has to decrypt it. This check is a source scan rather than an
 * integration test because the failure mode is a *missing* call in a file nobody
 * thought to exercise: a screen that renders ciphertext, or an AI prompt fed hex.
 * Naming the offending file is what makes the boundary visible when the next
 * reader is written.
 *
 * The rule is deliberately coarse — a SQL statement that names one of the four
 * tables *and* one of the narrative columns must be accompanied, in the same
 * file, by a decrypt call keyed on that table, or the file must be listed below
 * with the reason it does not need one. Coarse is the point: it fails loudly and
 * cheaply, where a column-level check would have to parse SQL. `encrypted-columns
 * .sentinel.test.ts` is the behavioural half of the same guarantee.
 */
const CLINICAL_TABLES = ['daily_notes', 'care_plans', 'risk_assessments', 'incidents'] as const;
const NARRATIVE = 'content|description|details|root_cause|outcomes|mitigation_actions|risk_assessment';

/**
 * Files that name a clinical table next to a narrative column without a
 * table-keyed decrypt call. Each entry is a claim about what the file reads; the
 * tests below check the claim still holds where it can be checked mechanically.
 */
const ALLOWED_WITHOUT_DECRYPTION: Record<string, string> = {
  'shared/utils/encrypted-columns.ts': 'the registry itself',
  'scripts/backfill-pii-encryption.ts': 're-encrypts existing rows; reads only what it is about to write back',
  'scripts/seed-demo.ts': 'writes demonstration rows, which are fake by construction',
  'scripts/seed-vps.ts': 'writes demonstration rows, which are fake by construction',
  'scripts/seed-clean-care.ts': 'writes demonstration rows, which are fake by construction',
  'scripts/seed-play-reviewer.ts': 'writes demonstration rows, which are fake by construction',
  'scripts/seed-orbis.ts': 'writes the demonstration organisation, which is fake by construction',
  'test/factories.ts': 'builds test fixtures; a plaintext fixture is the honest default there',
  'modules/dashboard/dashboard.repository.ts': 'the review scheduler reads plan and risk titles and dates; the one narrative read in the file (a care note summary) is decrypted before it is cut to length',
  'modules/reviews/review-notifications.service.ts': 'selects titles and review dates only',
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      sourceFiles(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('clinical narrative encryption coverage', () => {
  const srcRoot = path.resolve(__dirname, '../..');

  it('decrypts in every file that selects a clinical narrative column', () => {
    const narrativeRe = new RegExp(`\\b(${NARRATIVE})\\b`, 'i');
    const offenders: string[] = [];

    for (const file of sourceFiles(srcRoot)) {
      const relative = path.relative(srcRoot, file).split(path.sep).join('/');
      const source = fs.readFileSync(file, 'utf8');

      const needed = new Set<string>();
      for (const statement of source.match(/`[^`]*`/g) ?? []) {
        if (!narrativeRe.test(statement)) continue;
        for (const table of CLINICAL_TABLES) {
          if (new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+${table}\\b`, 'i').test(statement)) {
            needed.add(table);
          }
        }
      }

      const undecrypted = [...needed].filter(
        table => !new RegExp(`decrypt[A-Za-z]*\\(\\s*['"\`]${table}`).test(source),
      );
      if (undecrypted.length === 0) continue;
      if (ALLOWED_WITHOUT_DECRYPTION[relative]) continue;
      offenders.push(`${relative} (${undecrypted.join(', ')})`);
    }

    expect(
      offenders,
      `These files select an encrypted clinical narrative column but never decrypt that table:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('does not truncate an encrypted column inside SQL', () => {
    // `LEFT()`/`SUBSTRING()` run in the database and would cut a ciphertext in
    // half. A truncated ciphertext cannot be decrypted at all, so the read path
    // that does this cannot be repaired afterwards by adding a decrypt call —
    // this is the one mistake in this area that has to be prevented, not fixed.
    const offenders: string[] = [];
    const truncation = new RegExp(
      `\\b(LEFT|SUBSTRING|SUBSTR)\\(\\s*[a-z_]+\\.(content|description|details|root_cause|outcomes|mitigation_actions|risk_assessment)\\b`,
      'i',
    );

    for (const file of sourceFiles(srcRoot)) {
      const relative = path.relative(srcRoot, file).split(path.sep).join('/');
      if (truncation.test(fs.readFileSync(file, 'utf8'))) offenders.push(relative);
    }

    expect(offenders, `These files truncate an encrypted column in SQL:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('registers every clinical narrative column with the encryptor', () => {
    // The registry is the single place the answer lives; a scan that finds a
    // narrative column on one of these tables must find it encrypted too.
    expect(ENCRYPTED_COLUMNS.daily_notes).toEqual(['content']);
    expect(ENCRYPTED_COLUMNS.care_plans).toEqual(expect.arrayContaining(['description', 'risk_assessment']));
    expect(ENCRYPTED_COLUMNS.risk_assessments).toEqual(expect.arrayContaining(['details', 'mitigation_actions']));
    expect(ENCRYPTED_COLUMNS.incidents).toEqual(expect.arrayContaining(['description', 'root_cause', 'outcomes']));
  });
});
