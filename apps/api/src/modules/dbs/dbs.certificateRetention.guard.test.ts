/**
 * The certificate-metadata path holds metadata, and only metadata.
 *
 * The DBS model policy permits limited audit metadata — issue date, certificate
 * type, role, certificate reference, recruitment decision — and says not to keep
 * a photocopy, image or copy of the certificate contents. That is a property of
 * the *set of fields and doors the module has*, not of any one result, so it
 * cannot be asserted behaviourally: a test that posts bad input cannot fail a
 * route that accepts a file. This is a source scan for the same reason
 * `dbs.providerGuard.test.ts` is one.
 *
 * Three things are checked, and each covers a different way the rule would be
 * broken later:
 *
 *   - **The accepted field list is closed.** The route schema's keys are compared
 *     with the permitted set, so adding `certificateImage` or `certificateCopy`
 *     fails here rather than passing review. This is the guard that matters most,
 *     because it is the change somebody would make with good intentions.
 *   - **No upload machinery exists in the module.** No multer, no multipart, no
 *     file field, no base64 blob, no storage call — a route cannot accept a copy
 *     of a certificate without one of those.
 *   - **No path mints evidence.** A check result still may not become a
 *     `documents` row. The purge is the new code, and it deletes; it must not be
 *     the door a certificate document arrives through either.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DBS_DIR = __dirname;

/** Comments stripped, so a doc comment describing what was removed is not read as the thing itself. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

const read = (file: string) => stripComments(fs.readFileSync(path.join(DBS_DIR, file), 'utf8'));

const ROUTES = read('dbs.routes.ts');
const RETENTION = read('dbs.certificateRetention.ts');
const SERVICE = read('dbs.service.ts');

/** The fields `PATCH /dbs/checks/:id/certificate` accepts, read out of its schema. */
function certificateSchemaFields(): string[] {
  const start = ROUTES.indexOf('const certificateMetadataSchema = z.object({');
  expect(start, 'certificateMetadataSchema not found in dbs.routes.ts').toBeGreaterThan(-1);
  const body = ROUTES.slice(start, ROUTES.indexOf('});', start));
  return [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).sort();
}

describe('the certificate metadata route accepts the permitted set and nothing more', () => {
  it('names exactly the fields the handling rules allow', () => {
    // Issue date, certificate reference, the recruitment decision and its date, a
    // renewal marker, and the provider's own note. Nothing else is in the set,
    // because nothing else may be kept.
    expect(certificateSchemaFields()).toEqual([
      'certificateIssuedOn',
      'certificateNumber',
      'notes',
      'recruitmentDecision',
      'recruitmentDecisionOn',
      'renewalDueOn',
    ]);
  });

  it('has no door a copy of a certificate could come through', () => {
    for (const source of [ROUTES, RETENTION, SERVICE]) {
      expect(source).not.toMatch(/multer|multipart|upload\.\w+|FormData/i);
      expect(source).not.toMatch(/\bbase64\b|\bBuffer\.from\(/);
      // No field name that invites one, and no storage path to put it in.
      expect(source).not.toMatch(/certificate(Image|Copy|Photo|Scan|File|Document|Url|Blob)/i);
      expect(source).not.toMatch(/s3|storage\.|putObject|uploadFile/i);
    }
  });

  it('keeps a check result out of the documents table, including on the purge', () => {
    for (const source of [RETENTION, SERVICE]) {
      expect(source).not.toMatch(/INSERT INTO documents/);
      expect(source).not.toMatch(/'approved'/);
    }
    // The purge deletes certificate information; it does not delete the check, and
    // it does not touch a document. `DELETE FROM` anywhere in it would mean a
    // record went with the metadata.
    expect(RETENTION).not.toMatch(/DELETE FROM/);
  });

  it('is the only writer of the retention columns', () => {
    // A third writer would be a third chance to hold information with no deadline
    // on it. The service's completion path and the metadata path are the two that
    // exist, and both set `purge_after`.
    const writers = fs.readdirSync(DBS_DIR)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      // An assignment, not a mention: `dbs.types.ts` declares the field, and a
      // declaration writes nothing.
      .filter((f) => /purge_after\s*=/.test(stripComments(fs.readFileSync(path.join(DBS_DIR, f), 'utf8'))))
      .sort();
    expect(writers).toEqual(['dbs.certificateRetention.ts', 'dbs.service.ts']);
    expect(SERVICE).toMatch(/purge_after = CASE/);
  });
});
