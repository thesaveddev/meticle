import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Repository hygiene guards.
 *
 * T0-17: `apps/marketing/data/marketing.db` sat in git from the initial commit.
 * The main file looked like an empty 4 KiB page, but the committed 1 MB WAL
 * held the actual data: 28 lead records, 22 with named individual contacts.
 * That is personal data in every clone of the repository, and whether to purge
 * history is an owner decision precisely because the data is already there.
 * The files are now untracked and ignored; this test is the part that stops
 * the NEXT one from landing.
 *
 * Scan rather than list: a list of forbidden names only catches the files we
 * already know about. The guard has to catch the *class* — a runtime database
 * artefact — because the next one will not be called marketing.db.
 */
describe('repository hygiene', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');

  const trackedFiles = execSync('git ls-files -z', { cwd: repoRoot, encoding: 'buffer' })
    .toString()
    .split('\0')
    .filter(Boolean);

  it('commits no database files', () => {
    // Case-insensitive because Marketing.DB would be the same failure. The WAL
    // and SHM siblings are listed even though the ignore rule already covers
    // them: if the ignore rule is ever loosened, this assertion still holds.
    const offenders = trackedFiles.filter((f) => /\.(db|db-wal|db-shm|sqlite|sqlite3)$/i.test(f));
    expect(
      offenders,
      `Database files are committed. Local data stores (lead CRMs, scratch DBs, WAL sidecars) are personal data by design and must stay out of git. Found: ${offenders.join(', ')}. Ignore them, untrack with git rm --cached, and treat any history containing real rows as a reportable incident.`,
    ).toEqual([]);
  });

  it('commits no .env files, wherever they sit', () => {
    // .env at the root is ignored, but an env file created inside an app dir
    // would not match that rule — and env files are where provider API keys and
    // database passwords actually live. `.env.example` is exempt on purpose:
    // templates are how a new machine gets set up, and the ones in this repo
    // were checked to hold placeholders and public URLs only.
    const offenders = trackedFiles.filter(
      (f) => /(^|\/)\.env(\..*)?$/i.test(f) && !/\.example$/i.test(f),
    );
    expect(offenders, `Environment files are committed: ${offenders.join(', ')}`).toEqual([]);
  });
});
