/**
 * Nation-specific vetting — the operational half of the four-regulator claim.
 *
 * The failure being pinned here is specific and was real: a Scottish provider
 * was marked non-compliant for not holding a DBS, a document Scotland does not
 * use, while the PVG certificate sitting in the same table counted for nothing.
 * Each test below is written so that reintroducing the hardcoded
 * `['DBS', 'PASSPORT', 'VISA', 'RIGHT_TO_WORK']` list fails a test rather than
 * passing quietly.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  VETTING_SCHEMES,
  DEFAULT_VETTING_SCHEME,
  getVettingScheme,
  resolveVettingScheme,
  schemeForRegulator,
  identityTypesFor,
  identityTypesForAllSchemes,
  isIdentityType,
  listVettingSchemes,
  checkDocumentTypesForAllSchemes,
  vettingDocumentTypeSql,
} from './compliance.vetting';

describe('vetting registry — the four UK nations', () => {
  it('defines a scheme for every nation', () => {
    const nations = Object.values(VETTING_SCHEMES).map((s) => s.nation);
    expect(nations.sort()).toEqual(['england', 'northern_ireland', 'scotland', 'wales']);
  });

  it('maps each nation to the regulator that inspects it', () => {
    expect(getVettingScheme('dbs_england_wales').regulator).toBe('cqc');
    expect(getVettingScheme('ciw_wales').regulator).toBe('ciw');
    expect(getVettingScheme('pvg_scotland').regulator).toBe('care-inspectorate');
    expect(getVettingScheme('accessni_northern_ireland').regulator).toBe('rqia');
  });

  it('requires PVG in Scotland, not DBS', () => {
    const scotland = getVettingScheme('pvg_scotland');
    expect(scotland.checkName).toBe('PVG');
    expect(scotland.documentTypes).toContain('PVG');
    // The assertion that the bug would fail. A DBS is not recognised in
    // Scotland, so requiring one invents a compliance gap that does not exist.
    expect(scotland.documentTypes).not.toContain('DBS');
  });

  it('requires AccessNI in Northern Ireland, not DBS', () => {
    const ni = getVettingScheme('accessni_northern_ireland');
    expect(ni.checkName).toBe('AccessNI');
    expect(ni.checkDocumentTypes).toEqual(['ACCESSNI']);
    expect(ni.documentTypes).not.toContain('DBS');
  });

  it('requires DBS in England and in Wales', () => {
    expect(getVettingScheme('dbs_england_wales').checkDocumentTypes).toEqual(['DBS']);
    // Wales shares England's scheme; it is a separate entry because it is
    // registered with CIW, not because the check differs.
    expect(getVettingScheme('ciw_wales').checkDocumentTypes).toEqual(['DBS']);
  });

  it('treats a PVG certificate and a Disclosure Scotland record as alternatives', () => {
    // Found while building this: one flat list of required types would ask a
    // correctly-vetted Scottish carer for both, and report them non-compliant
    // for a document they do not need.
    const scotland = getVettingScheme('pvg_scotland');
    expect(scotland.checkDocumentTypes).toEqual(['PVG', 'DISCLOSURE_SCOTLAND']);
  });

  it('needs exactly one check document in the three single-route nations', () => {
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      if (scheme.id === 'pvg_scotland') continue;
      expect(scheme.checkDocumentTypes).toHaveLength(1);
    }
  });

  it('derives documentTypes as the union of the two lists, with no overlap', () => {
    // A document cannot be both an alternative and a requirement, or a staff
    // member could be told to hold a second copy of the same check.
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      expect(scheme.documentTypes.slice().sort()).toEqual(
        [...scheme.checkDocumentTypes, ...scheme.requiredDocumentTypes].sort(),
      );
      for (const t of scheme.checkDocumentTypes) {
        expect(scheme.requiredDocumentTypes).not.toContain(t);
      }
    }
  });

  it('uses PVG tier names in Scotland, not DBS tier names', () => {
    const scotland = getVettingScheme('pvg_scotland');
    expect(scotland.tiers).toContain('advanced');
    expect(scotland.tiers).toContain('advanced_with_barring');
    // "Enhanced" is a DBS tier. Naming a PVG check "enhanced" would make a real
    // check look like the wrong tier, which is the failure mode tracked as T2-9.
    expect(scotland.tiers).not.toContain('enhanced');
  });

  it('keeps right to work in every nation', () => {
    // Right to work is a UK-wide immigration requirement with nothing to do with
    // which background-checking scheme applies. Dropping it for Scotland would
    // invent a different kind of invented gap.
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      expect(scheme.requiredDocumentTypes).toEqual(['PASSPORT', 'VISA', 'RIGHT_TO_WORK']);
    }
  });

  it('names the issuing body for every scheme', () => {
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      expect(scheme.issuer.length).toBeGreaterThan(5);
      expect(scheme.note.length).toBeGreaterThan(10);
    }
    expect(getVettingScheme('pvg_scotland').issuer).toContain('Disclosure Scotland');
  });
});

describe('vetting registry — resolution', () => {
  it('falls back to England when the stored scheme is unknown or missing', () => {
    expect(getVettingScheme(null).id).toBe(DEFAULT_VETTING_SCHEME);
    expect(getVettingScheme(undefined).id).toBe(DEFAULT_VETTING_SCHEME);
    expect(getVettingScheme('pvgg_scotland_typo').id).toBe(DEFAULT_VETTING_SCHEME);
  });

  it("prefers the person's own scheme over the organisation's", () => {
    // A provider registered in England that sends a carer to work in Scotland.
    const resolved = resolveVettingScheme('pvg_scotland', 'dbs_england_wales');
    expect(resolved.id).toBe('pvg_scotland');
  });

  it('falls back to the organisation scheme when the person has no override', () => {
    // NULL must mean "same as the organisation", not "England" — otherwise an
    // org that switches to Scotland would silently leave its staff behind.
    expect(resolveVettingScheme(null, 'pvg_scotland').id).toBe('pvg_scotland');
    expect(resolveVettingScheme(null, 'accessni_northern_ireland').id).toBe('accessni_northern_ireland');
  });

  it('falls back to England when neither the person nor the org says', () => {
    expect(resolveVettingScheme(null, null).id).toBe(DEFAULT_VETTING_SCHEME);
    expect(resolveVettingScheme('nonsense', 'also_nonsense').id).toBe(DEFAULT_VETTING_SCHEME);
  });

  it('ignores an unknown person override rather than failing over to England', () => {
    // A bad override should behave as absent, not poison the person.
    expect(resolveVettingScheme('nonsense', 'pvg_scotland').id).toBe('pvg_scotland');
  });

  it('derives the scheme a regulator implies', () => {
    expect(schemeForRegulator('care-inspectorate').id).toBe('pvg_scotland');
    expect(schemeForRegulator('rqia').id).toBe('accessni_northern_ireland');
    expect(schemeForRegulator('ciw').id).toBe('ciw_wales');
    expect(schemeForRegulator('cqc').id).toBe('dbs_england_wales');
    expect(schemeForRegulator('unknown_regulator').id).toBe(DEFAULT_VETTING_SCHEME);
  });
});

describe('vetting registry — document type sets', () => {
  it('unions several schemes, deduplicated and in a stable order', () => {
    const types = identityTypesFor(['dbs_england_wales', 'pvg_scotland']);
    expect(types).toEqual(['DBS', 'DISCLOSURE_SCOTLAND', 'PASSPORT', 'PVG', 'RIGHT_TO_WORK', 'VISA']);
    // Stable order, so a rendered list and a query parameter agree run to run.
    expect(identityTypesFor(['pvg_scotland', 'dbs_england_wales'])).toEqual(types);
  });

  it('covers every scheme when asked for them all', () => {
    const all = identityTypesForAllSchemes();
    for (const type of ['DBS', 'PVG', 'ACCESSNI', 'DISCLOSURE_SCOTLAND']) {
      expect(all).toContain(type);
    }
  });

  it('collects the nation-specific check types across all schemes', () => {
    // This set is what the coverage metric filters on, and it must not pick up
    // a right-to-work document — a passport is not a background check.
    expect(checkDocumentTypesForAllSchemes()).toEqual([
      'ACCESSNI', 'DBS', 'DISCLOSURE_SCOTLAND', 'PVG',
    ]);
  });

  it('falls back to the England set when given no schemes', () => {
    expect(identityTypesFor([])).toEqual(getVettingScheme(DEFAULT_VETTING_SCHEME).documentTypes.slice().sort());
  });

  it('scopes the identity test to a scheme when asked', () => {
    expect(isIdentityType('PVG', 'pvg_scotland')).toBe(true);
    // The core regression: a Scottish worker's PVG is evidence; a DBS is not.
    expect(isIdentityType('DBS', 'pvg_scotland')).toBe(false);
    expect(isIdentityType('DBS', 'dbs_england_wales')).toBe(true);
    expect(isIdentityType('ACCESSNI', 'accessni_northern_ireland')).toBe(true);
  });

  it('scopes right to work as valid everywhere', () => {
    for (const id of Object.keys(VETTING_SCHEMES)) {
      expect(isIdentityType('RIGHT_TO_WORK', id)).toBe(true);
    }
  });

  it('treats a non-identity document as identity evidence nowhere', () => {
    expect(isIdentityType('FIRST_AID_CERTIFICATE')).toBe(false);
    expect(isIdentityType('FIRST_AID_CERTIFICATE', 'pvg_scotland')).toBe(false);
  });

  it('lists every scheme for a settings screen', () => {
    const list = listVettingSchemes();
    expect(list).toHaveLength(4);
    expect(list.map((s) => s.id).sort()).toEqual([
      'accessni_northern_ireland', 'ciw_wales', 'dbs_england_wales', 'pvg_scotland',
    ]);
  });
});

describe('vettingDocumentTypeSql — the generated SQL follows the registry', () => {
  const sql = vettingDocumentTypeSql('COALESCE(sp.vetting_scheme, o.vetting_scheme)');

  it('embeds the resolved expression it was given', () => {
    expect(sql).toContain('COALESCE(sp.vetting_scheme, o.vetting_scheme)');
    expect(sql.startsWith('(CASE ')).toBe(true);
  });

  it('emits a branch for every scheme in the registry', () => {
    for (const id of Object.keys(VETTING_SCHEMES)) {
      expect(sql).toContain(`WHEN '${id}' THEN`);
    }
  })

  it("emits each scheme's own document types, not one shared list", () => {
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      const branch = sql.split(`WHEN '${scheme.id}' THEN`)[1].split(' ELSE ')[0];
      for (const type of scheme.documentTypes) {
        expect(branch).toContain(`"${type}"`);
      }
    }
  });

  it('emits only the check documents for the check variant', () => {
    const checkSql = vettingDocumentTypeSql('COALESCE(sp.vetting_scheme, o.vetting_scheme)', 'check');
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      const branch = checkSql.split(`WHEN '${scheme.id}' THEN`)[1].split(' ELSE ')[0];
      for (const type of scheme.checkDocumentTypes) {
        expect(branch).toContain(`"${type}"`);
      }
      // A passport is not a background check. If the check variant ever picks up
      // the right-to-work types, coverage would read 100% for a workforce that
      // has never been vetted — the exact thing that metric exists to catch.
      for (const type of scheme.requiredDocumentTypes) {
        expect(branch).not.toContain(`"${type}"`);
      }
    }
  });

  it('still falls back to the England check for an unknown scheme', () => {
    const fallback = vettingDocumentTypeSql('x', 'check').split(' ELSE ')[1];
    expect(fallback).toContain('"DBS"');
    expect(fallback).not.toContain('"PASSPORT"');
  });

  it('quotes each branch, so a name cannot break the literal', () => {
    // Every branch must be a complete, individually-quoted string literal. One
    // unquoted element is a syntax error that takes down whichever query
    // embedded the expression — which is exactly how the first version failed.
    for (const scheme of Object.values(VETTING_SCHEMES)) {
      const branch = sql.split(`WHEN '${scheme.id}' THEN `)[1];
      const literal = /'\{("[A-Z_]+"(,"[A-Z_]+")*)\}'::text\[\]/.exec(branch);
      expect(literal, `no array literal in the ${scheme.id} branch`).not.toBeNull();
    }
  });

  it('never puts DBS in the Scottish branch', () => {
    // If this passes only because the branch is missing, the previous test
    // catches it. Together: the branch exists, and DBS is not in it.
    const scotland = sql.split("WHEN 'pvg_scotland' THEN")[1].split(' ELSE ')[0];
    expect(scotland).toContain('"PVG"');
    expect(scotland).not.toContain('"DBS"');
  });

  it('falls back to the England document set for an unknown scheme', () => {
    const fallback = sql.split(' ELSE ')[1];
    const england = getVettingScheme(DEFAULT_VETTING_SCHEME).documentTypes;
    for (const type of england) {
      expect(fallback).toContain(`"${type}"`);
    }
  });

  it('produces an array literal PostgreSQL can parse', () => {
    // `ARRAY{...}` looks like an array but is a syntax error; the only form
    // that parses is a quoted string cast to text[]. This caught it once.
    expect(sql).toContain('::text[]');
    expect(sql).not.toMatch(/ARRAY\{/);
    expect(sql).not.toMatch(/THEN ARRAY[^{"]/);
  });

  it('changes when a scheme is added to the registry', () => {
    // Guards against the generator being hand-maintained and drifting.
    const before = Object.keys(VETTING_SCHEMES).length;
    expect(before).toBe(4);
    expect((sql.match(/ THEN '\{"/g) || []).length).toBe(before);
  });
});

describe('migration 128 seed matches the registry', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../shared/database/migrations/128_nation_specific_vetting.sql'),
    'utf8',
  );

  /**
   * Pull each seeded row's literals out of the INSERT.
   *
   * Anchored on the scheme id rather than scanned for, because the rows are
   * full of quotes and a loose pattern happily latches onto a note string.
   */
  function seededRows(): Array<{
    id: string; nation: string; tiers: string[]
    checkDocumentTypes: string[]; requiredDocumentTypes: string[]
  }> {
    const rows: ReturnType<typeof seededRows> = [];
    for (const id of Object.keys(VETTING_SCHEMES)) {
      const block = new RegExp(
        `\\(\\s*'${id}',\\s*'([a-z_]+)',[\\s\\S]*?` +
        `ARRAY\\[([^\\]]*)\\],\\s*` +          // tiers
        `ARRAY\\[([^\\]]*)\\],\\s*` +          // check_document_types
        `ARRAY\\[([^\\]]*)\\],\\s*'`,         // required_document_types
      ).exec(migration);
      if (!block) continue;
      const clean = (s: string) => s.split(',').map((t) => t.trim().replace(/^'|'$/g, ''));
      rows.push({
        id,
        nation: block[1],
        tiers: clean(block[2]),
        checkDocumentTypes: clean(block[3]),
        requiredDocumentTypes: clean(block[4]),
      });
    }
    return rows;
  }

  it('seeds one row per registry scheme', () => {
    expect(seededRows().map((r) => r.id).sort()).toEqual(Object.keys(VETTING_SCHEMES).sort());
  });

  it('seeds the same document types the code requires', () => {
    // A tier name or document type drifting between the table and the registry
    // is how a real check starts looking missing again.
    for (const row of seededRows()) {
      const scheme = VETTING_SCHEMES[row.id];
      expect(row.checkDocumentTypes).toEqual(scheme.checkDocumentTypes);
      expect(row.requiredDocumentTypes).toEqual(scheme.requiredDocumentTypes);
      expect(row.tiers).toEqual(scheme.tiers);
      expect(row.nation).toBe(scheme.nation);
    }
  });

  it('seeds Scotland two ways in, not one required document', () => {
    const row = seededRows().find((r) => r.id === 'pvg_scotland')!;
    expect(row.checkDocumentTypes).toEqual(['PVG', 'DISCLOSURE_SCOTLAND']);
    expect(row.requiredDocumentTypes).not.toContain('PVG');
  });

  it('defaults every existing organisation to England', () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS vetting_scheme TEXT NOT NULL DEFAULT 'dbs_england_wales'");
    expect(DEFAULT_VETTING_SCHEME).toBe('dbs_england_wales');
  });

  it('leaves the per-person override nullable', () => {
    // NOT NULL here would write a literal copy of the org scheme onto every
    // staff record, so changing the organisation would leave everyone behind.
    expect(migration).toMatch(/ALTER TABLE staff_profiles\s+ADD COLUMN IF NOT EXISTS vetting_scheme TEXT;/);
  });
});

describe('no query hardcodes the England document list again', () => {
  /** Every module source, minus the registry itself and the seed scripts. */
  function moduleSources(): Array<{ file: string; text: string }> {
    const root = path.join(__dirname, '..');
    const out: Array<{ file: string; text: string }> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.ts')) continue;
        if (entry.name.endsWith('.test.ts') || entry.name.includes('repository.ts') && false) continue;
        if (entry.name === 'compliance.vetting.ts') continue;
        if (entry.name.startsWith('seed-')) continue;
        out.push({ file: path.relative(root, full).replace(/\\/g, '/'), text: fs.readFileSync(full, 'utf8') });
      }
    };
    walk(root);
    return out;
  }

  it('has no IN-list of England identity types in any SQL', () => {
    const offenders = moduleSources().filter(({ text }) =>
      /\.type\s+IN\s*\(\s*'DBS'/i.test(text) ||
      /'DBS'\s*,\s*'PASSPORT'\s*,\s*'VISA'\s*,\s*'RIGHT_TO_WORK'/i.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it('derives its identity document types from the registry instead', () => {
    const users = moduleSources().filter(({ text }) => text.includes('vettingDocumentTypeSql'));
    const files = users.map((u) => u.file);
    expect(files).toEqual(expect.arrayContaining([
      'cqc/cqc.repository.ts',
      'cqc/cqc.controller.ts',
      'dashboard/dashboard.repository.ts',
      'mission-control/mission-control.repository.ts',
    ]));
  });
});
