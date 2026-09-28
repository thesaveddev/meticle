/**
 * Nation awareness must not decay.
 *
 * Three separate passes in this codebase left England-only document filters
 * behind, each of which made a Scottish or Northern Irish provider look
 * unvetted:
 *
 *   1. Seven queries counting `['DBS','PASSPORT','VISA','RIGHT_TO_WORK']` for
 *      all four regulators.
 *   2. Two more that counted `d.type = 'DBS'` — a compliance widget and a
 *      dashboard tile — missed by the first sweep because they matched no search
 *      for the full list.
 *   3. A DBS application service that minted a DBS certificate for a Scottish
 *      worker, which cannot be issued for one.
 *
 * So this is a source scan rather than a behavioural test: the failure mode is a
 * literal appearing in a SQL string, and a behavioural test only covers the
 * queries someone thought to write a test for. It is the same guard as the one in
 * compliance.vetting.test.ts, widened to cover the whole module tree.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MODULES = path.join(__dirname, '..');

/**
 * Comments are stripped before scanning.
 *
 * The two files this scan is most concerned about — the compliance widget and
 * the dashboard tile — are exactly the ones whose fixes carry a comment quoting
 * the literal they removed, e.g. "this counted `d.type = 'DBS'`". A scanner that
 * reads those would fail on the very fix it is guarding, and the obvious
 * response would be to delete the explanation, which is the wrong trade.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

/** Every TypeScript source under src/modules, minus tests and seed scripts. */
function moduleSources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts')) continue;
      if (entry.name.startsWith('seed-')) continue;
      // The registries are where a document type legitimately appears as data.
      if (entry.name === 'compliance.vetting.ts') continue;
      out.push({
        file: path.relative(MODULES, full).replace(/\\/g, '/'),
        text: stripComments(fs.readFileSync(full, 'utf8')),
      });
    }
  };
  walk(MODULES);
  return out;
}

describe('no query hardcodes a nation’s background check again', () => {
  it('has no bare DBS document filter in any SQL', () => {
    const offenders = moduleSources().filter(({ text }) =>
      /\.type\s*=\s*'DBS'/.test(text) ||
      /\.type\s+IN\s*\(\s*'DBS'/.test(text) ||
      /'DBS'\s*,\s*'PASSPORT'/.test(text) ||
      /'DBS'\s*,\s*'ENHANCED_DBS'/.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('has no hardcoded right-to-work list either', () => {
    // PASSPORT/VISA/RIGHT_TO_WORK is UK-wide, so listing it is not wrong in
    // itself — but a literal next to it usually means a whole England-only
    // filter that has been partially edited.
    const offenders = moduleSources().filter(({ text }) =>
      /'PASSPORT'\s*,\s*'VISA'\s*,\s*'RIGHT_TO_WORK'/.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('derives identity documents from the registry, in every module that counts them', () => {
    // Named explicitly, because a scan for "no bad literals" is satisfied by
    // deleting a query. These are the six that must keep working.
    const expected = [
      'cqc/cqc.repository.ts',
      'cqc/cqc.controller.ts',
      'dashboard/dashboard.repository.ts',
      'mission-control/mission-control.repository.ts',
      'events/events.batch-publisher.ts',
      'compliance/compliance.repository.ts',
    ];
    const users = moduleSources()
      .filter(({ text }) => text.includes('vettingDocumentTypeSql') || text.includes('getVettingScheme'))
      .map((u) => u.file);
    for (const file of expected) {
      expect(users, `${file} no longer derives documents from the registry`).toContain(file);
    }
  });

  it('keeps the check filter separate from the identity filter', () => {
    // The two are different questions. Conflating them makes a passport count
    // as a background check, which is how a workforce that has never been vetted
    // scores 100%.
    const cqcRepo = fs.readFileSync(path.join(MODULES, 'cqc', 'cqc.repository.ts'), 'utf8');
    expect(cqcRepo).toMatch(/vettingDocumentTypeSql\(RESOLVED_VETTING_SCHEME_SQL, 'check'\)/);
    expect(cqcRepo).toMatch(/vettingDocumentTypeSql\(RESOLVED_VETTING_SCHEME_SQL\)/);

    const cqcController = fs.readFileSync(path.join(MODULES, 'cqc', 'cqc.controller.ts'), 'utf8');
    expect(cqcController).toMatch(/VETTING_CHECK_TYPES_SQL/);
    expect(cqcController).toMatch(/VETTING_DOC_TYPES_SQL/);

    const dashboard = fs.readFileSync(path.join(MODULES, 'dashboard', 'dashboard.repository.ts'), 'utf8');
    expect(dashboard).toMatch(/VETTING_CHECK_TYPES_SQL/);
    expect(dashboard).toMatch(/VETTING_IDENTITY_TYPES_SQL/);
  });

  it('joins organizations wherever the scheme is resolved', () => {
    // The per-person scheme is COALESCE(staff, organization). Without the join,
    // PostgreSQL cannot resolve `o` and the query fails outright.
    for (const file of [
      'cqc/cqc.repository.ts',
      'cqc/cqc.controller.ts',
      'dashboard/dashboard.repository.ts',
      'mission-control/mission-control.repository.ts',
      'events/events.batch-publisher.ts',
    ]) {
      const text = fs.readFileSync(path.join(MODULES, file), 'utf8');
      expect(text, `${file} resolves a scheme without joining organizations`)
        .toMatch(/JOIN organizations o ON o\.id = u\.organization_id/);
    }
  });
});

describe('the DBS application service stays England and Wales only', () => {
  const dbs = fs.readFileSync(path.join(MODULES, 'dbs', 'dbs.service.ts'), 'utf8');

  it('refuses a worker outside England and Wales before writing anything', () => {
    expect(dbs).toMatch(/requireDbsApplicableNation/);
    // Checked at creation as well as submission: a draft check for a Scottish
    // worker is a row that looks like progress and can never complete.
    expect((dbs.match(/await requireDbsApplicableNation\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('resolves the person’s own scheme, not the organisation’s default alone', () => {
    // A national operator is England-registered with one carer working in
    // Scotland. The org default would let a DBS be raised for the Scot.
    expect(dbs).toMatch(/COALESCE\(sp\.vetting_scheme, o\.vetting_scheme\)/);
  });
});
