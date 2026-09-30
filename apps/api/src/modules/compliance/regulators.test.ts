/**
 * The regulator registry, and the registrations an organisation holds with them.
 *
 * The gap this closes was reported as "Wales cannot record an SCW registration
 * number". That is true, and it is also true of every other nation including
 * England — there was no registration field at all. The field people assumed
 * existed, "DBS", is the England-and-Wales background check.
 *
 * One correction the registry encodes: Social Care Wales registers individuals,
 * not services. CIW registers services in Wales. Conflating the two would mean
 * recording a workforce number as a service registration, so workforce bodies
 * are kept out of the database table entirely and the foreign key makes that
 * structural rather than a convention.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  REGULATORS,
  WORKFORCE_BODIES,
  getRegulator,
  isRegulatorId,
  listRegulators,
  regulatorsForNation,
} from './regulators';

describe('the regulator registry', () => {
  it('has one entry per nation’s service regulator', () => {
    expect(listRegulators()).toHaveLength(5);
    const ids = listRegulators().map((r) => r.id).sort();
    expect(ids).toEqual(['care-inspectorate', 'ciw', 'cqc', 'hiqa', 'rqia']);
  });

  it('maps each nation to exactly one service regulator', () => {
    expect(regulatorsForNation('england').map((r) => r.id)).toEqual(['cqc']);
    expect(regulatorsForNation('wales').map((r) => r.id)).toEqual(['ciw']);
    expect(regulatorsForNation('scotland').map((r) => r.id)).toEqual(['care-inspectorate']);
    expect(regulatorsForNation('northern_ireland').map((r) => r.id)).toEqual(['rqia']);
    expect(regulatorsForNation('ireland').map((r) => r.id)).toEqual(['hiqa']);
  });

  it('names each regulator’s registration and where to check it', () => {
    for (const r of listRegulators()) {
      expect(r.registrationLabel, `${r.id} has no registration label`).toBeTruthy();
      expect(r.registerUrl, `${r.id} has no register URL`).toMatch(/^https:\/\//);
    }
    expect(REGULATORS.ciw.registrationLabel).toBe('CIW registration number');
    expect(REGULATORS.cqc.registrationLabel).toBe('CQC registration number');
    expect(REGULATORS.rqia.registrationLabel).toBe('RQIA registration number');
  });

  it('links every regulator to the vetting scheme that answers to it', () => {
    // This is what ties the two registries together: a nation's background check
    // and the body that inspects it must not be able to drift apart.
    expect(REGULATORS.cqc.vettingScheme).toBe('dbs_england_wales');
    expect(REGULATORS.ciw.vettingScheme).toBe('ciw_wales');
    expect(REGULATORS['care-inspectorate'].vettingScheme).toBe('pvg_scotland');
    expect(REGULATORS.rqia.vettingScheme).toBe('accessni_northern_ireland');
  });

  it('carries a verified format hint for CIW and not for the others', () => {
    // CIW's numbering is published. CQC's and RQIA's are not verified here, so
    // there is no hint rather than a guessed one — a wrong pattern would reject
    // a real registration number.
    expect(REGULATORS.ciw.formatHint).toContain('CYM');
    expect(REGULATORS.cqc.formatHint).toBeUndefined();
    expect(REGULATORS.rqia.formatHint).toBeUndefined();
  });

  it('distinguishes the service register from the workforce register', () => {
    // The mistake Wales invites. CIW registers services; Social Care Wales
    // registers individuals. Recording one as the other is recording the wrong
    // document against the wrong body.
    expect(REGULATORS.ciw.note).toContain('Social Care Wales');
    const scw = WORKFORCE_BODIES.find((b) => b.name === 'Social Care Wales')!;
    expect(scw.note).toContain('Not a service register');
  });

  it('keeps workforce bodies out of the service registry', () => {
    // They are listed separately so the distinction is explainable, but they are
    // not selectable as a service regulator.
    for (const body of WORKFORCE_BODIES) {
      const asService = listRegulators().find((r) => r.name === body.name);
      expect(asService, `${body.name} leaked into the service registry`).toBeUndefined();
    }
    for (const r of listRegulators()) {
      expect(r.role).toBe('service');
    }
  });

  it('recognises only real regulator ids', () => {
    expect(isRegulatorId('cqc')).toBe(true);
    expect(isRegulatorId('social_care_wales')).toBe(false);
    expect(isRegulatorId('nonsense')).toBe(false);
    expect(isRegulatorId(null)).toBe(false);
    expect(getRegulator('nonsense')).toBeNull();
  });
});

describe('the seeded regulator rows match the registry', () => {
  // 129 seeded the four UK regulators; 136 added HIQA. Both are read, because the
  // guarantee is "every regulator in the registry has a seeded row" — a statement
  // about the pair, not about one file. Reading only 129 would have reported
  // HIQA as unseeded rather than as seeded one migration later.
  const migration = ['129_regulator_registrations', '136_ireland_hiqa_garda_vetting']
    .map((f) => fs.readFileSync(
      path.join(__dirname, '../../shared/database/migrations', `${f}.sql`),
      'utf8',
    ))
    .join('\n');

  function seededRegulators(): Array<{
    id: string; name: string; label: string; url: string; scheme: string; hint: string | null
  }> {
    return listRegulators().map((r) => {
      // Anchored on the shape of a regulators row — id, name, then ARRAY — not on
      // the bare id. Migration 136 seeds both a vetting row and a regulators row,
      // and the vetting row contains the id as its `regulator` column, so
      // indexOf(`'${r.id}',`) found `'hiqa',` inside the vetting insert and read
      // "Garda vetting" as HIQA's name. The ARRAY anchor is what distinguishes
      // the two INSERT shapes.
      const anchor = new RegExp(`'${r.id}',\\s*'[^']+',\\s*ARRAY\\[`).exec(migration);
      if (!anchor || anchor.index === undefined) {
        return { id: r.id, name: '', label: '', url: '', scheme: '', hint: null };
      }
      const end = migration.indexOf('\n      ),', anchor.index);
      // Start after the id so it is not counted as the first value.
      const block = migration.slice(anchor.index + r.id.length + 3, end === -1 ? undefined : end);

      // Quoted values in order: name, nation (inside ARRAY[...]), role,
      // description, label, url, [hint], scheme, note. Positional on purpose —
      // anchoring on the registry's own values would make the comparison below
      // tautological.
      const quoted = [...block.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]);
      // format_hint is the literal NULL when unverified, not an empty string, so
      // the remaining quoted values shift by one when it is absent.
      const hasNull = /\bNULL\b/.test(block);
      return {
        id: r.id,
        name: quoted[0] ?? '',
        label: quoted[4] ?? '',
        url: quoted[5] ?? '',
        hint: hasNull ? null : (quoted[6] ?? null),
        scheme: quoted[hasNull ? 6 : 7] ?? '',
      };
    });
  }

  it('seeds every regulator in the registry, and nothing else', () => {
    const seededIds = [...migration.matchAll(/\(\s*\n?\s*'([a-z-]+)',\s*'[^']+',\s*ARRAY\['/g)]
      .map((m) => m[1]);
    expect(seededIds.sort()).toEqual(Object.keys(REGULATORS).sort());
  });

  it('seeds the same names, labels and register URLs the code uses', () => {
    for (const row of seededRegulators()) {
      const r = REGULATORS[row.id as keyof typeof REGULATORS];
      expect(row.name, `${row.id} name drifted`).toBe(r.name);
      expect(row.label, `${row.id} registration label drifted`).toBe(r.registrationLabel);
      expect(row.url, `${row.id} register URL drifted`).toBe(r.registerUrl);
      expect(row.scheme, `${row.id} vetting scheme drifted`).toBe(r.vettingScheme);
    }
  });

  it('seeds a format hint only where one is verified', () => {
    const ciw = seededRegulators().find((r) => r.id === 'ciw')!;
    const cqc = seededRegulators().find((r) => r.id === 'cqc')!;
    expect(ciw.hint).toBeTruthy();
    // NULL, not a guess. This is asserted because inventing a numbering pattern
    // for CQC is exactly the class of error this whole change exists to remove.
    expect(cqc.hint).toBeNull();
  });

  it('never seeds a workforce body into the service table', () => {
    for (const body of WORKFORCE_BODIES) {
      expect(migration, `${body.name} was seeded into regulators`).not.toContain(`'${body.name}'`);
    }
  });

  it('constrains the table to service regulators', () => {
    // The role column is pinned to 'service' rather than an enum of both, so the
    // foreign key alone makes a workforce registration impossible to insert.
    expect(migration).toMatch(/role TEXT NOT NULL DEFAULT 'service' CHECK \(role = 'service'\)/);
    expect(migration).toMatch(/regulator_id TEXT NOT NULL REFERENCES regulators\(id\) ON DELETE RESTRICT/);
  });

  it('allows an organisation more than one registration', () => {
    // A national operator is registered with CQC and CIW at once. A unique pair
    // keyed on (org, regulator) permits that while stopping duplicates.
    expect(migration).toMatch(/UNIQUE \(organization_id, regulator_id\)/);
    expect(migration).not.toMatch(/UNIQUE \(organization_id\)/);
  });

  it('refuses an empty registration number', () => {
    // A blank string that reads as compliance on a dashboard is worse than an
    // obvious error.
    expect(migration).toMatch(/CHECK \(length\(btrim\(registration_number\)\) > 0\)/);
  });
});
