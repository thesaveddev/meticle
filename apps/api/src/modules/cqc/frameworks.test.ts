/**
 * Framework definitions are claims about what other people's regulators publish.
 *
 * The file this guards used to contain a Welsh framework that was CQC's domains
 * mapped through a no-op, and a Northern Irish framework of fourteen invented
 * identifiers (`NI-S1` … `NI-W3`) and an invented three-band rating scale. Both
 * were plausible, which is what made them dangerous: `NI-S1` could not be looked
 * up and found missing.
 *
 * So the tests here are mostly negative. They check that a framework is sourced,
 * that no framework is another framework in disguise, and that the words a
 * regulator actually publishes are present and the words they do not are absent.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getFramework,
  getFrameworkList,
  domainsForServiceTypes,
} from './frameworks';

const ALL_IDS = ['cqc', 'ciw', 'care-inspectorate', 'rqia'];

describe('every framework must be sourced', () => {
  it('carries a source for all four regulators', () => {
    for (const id of ALL_IDS) {
      const f = getFramework(id);
      expect(f.source, `${id} has no source`).toBeTruthy();
      expect(f.source.length).toBeGreaterThan(20);
    }
  });

  it('carries a description that says what is real and what is ours', () => {
    for (const id of ALL_IDS) {
      expect(getFramework(id).description.length).toBeGreaterThan(20);
    }
  });

  it('lists all four regulators with their countries', () => {
    const list = getFrameworkList();
    expect(list).toHaveLength(4);
    expect(list.map((f) => f.id).sort()).toEqual([...ALL_IDS].sort());
    expect(list.find((f) => f.id === 'ciw')?.country).toBe('Wales');
    expect(list.find((f) => f.id === 'rqia')?.country).toBe('Northern Ireland');
  });

  it('falls back to CQC for an unknown regulator rather than throwing', () => {
    expect(getFramework('nonsense').id).toBe('cqc');
  });

  it('has unique statement ids within every domain', () => {
    for (const id of ALL_IDS) {
      for (const d of getFramework(id).domains) {
        const ids = d.statements.map((s) => s.id);
        expect(new Set(ids).size, `${id}/${d.key} has duplicate statement ids`).toBe(ids.length);
      }
    }
  });

  it('names only domains that exist when a gap message is built', () => {
    // evidenceDomains is used to name a domain in a gap message. A key that
    // does not resolve would make the message say "improve the Caring domain"
    // to a Welsh provider that has no Caring domain.
    for (const id of ALL_IDS) {
      const f = getFramework(id);
      const keys = f.domains.map((d) => d.key);
      expect(f.evidenceDomains, `${id} has no evidenceDomains`).toBeTruthy();
      expect(keys, `${id} evidenceDomains.experience`).toContain(f.evidenceDomains!.experience);
      expect(keys, `${id} evidenceDomains.leadership`).toContain(f.evidenceDomains!.leadership);
      expect(keys, `${id} evidenceDomains.incidents`).toContain(f.evidenceDomains!.incidents);
    }
  });
});

describe('Wales is its own framework, not CQC with Welsh labels', () => {
  const ciw = getFramework('ciw');

  it('is not built from CQC', () => {
    // The original defect in one assertion. A re-skin has the same domain keys
    // and the same statement ids as the framework it copies.
    const cqc = getFramework('cqc');
    expect(ciw.domains.map((d) => d.key)).not.toEqual(cqc.domains.map((d) => d.key));
    const ciwIds = ciw.domains.flatMap((d) => d.statements.map((s) => s.id));
    const cqcIds = cqc.domains.flatMap((d) => d.statements.map((s) => s.id));
    for (const id of ciwIds) expect(cqcIds).not.toContain(id);
  });

  it('does not use CQC’s five key questions', () => {
    for (const key of ['safe', 'caring', 'responsive', 'well-led']) {
      expect(ciw.domains.map((d) => d.key)).not.toContain(key);
    }
  });

  it('uses CIW’s four themes', () => {
    expect(ciw.domains.map((d) => d.key)).toEqual([
      'well-being', 'care-and-support', 'environment', 'leadership-and-management',
    ]);
  });

  it('carries CIW’s own description of each theme', () => {
    for (const d of ciw.domains) {
      expect(d.description, `${d.key} has no description`).toBeTruthy();
      expect(d.description!.length).toBeGreaterThan(40);
    }
    expect(ciw.domains[0].description).toContain('positive outcomes');
  });

  it('uses CIW’s four ratings, including the one that is not "poor"', () => {
    const labels = ciw.ratings!.map((r) => r.label);
    expect(labels).toEqual([
      'Excellent', 'Good', 'Requires improvement', 'Requires significant improvement',
    ]);
    // The old scale called the bottom two Adequate and Poor. Neither is a CIW
    // rating, and "Poor" understates "requires significant improvement", which
    // is CIW's most serious band and triggers immediate action.
    expect(labels).not.toContain('Adequate');
    expect(labels).not.toContain('Poor');
  });

  it('says the thresholds are ours, because CIW publishes no score cut-offs', () => {
    expect(ciw.ratingsNote).toBeTruthy();
    expect(ciw.ratingsNote).toContain('CIW');
  });

  it('numbers the lines of enquiry as CIW does', () => {
    const ids = ciw.domains.flatMap((d) => d.statements.map((s) => s.id));
    expect(ids).toEqual([
      'LOE-1', 'LOE-2', 'LOE-3', 'LOE-4',
      'LOE-5', 'LOE-6', 'LOE-7', 'LOE-8',
      'LOE-9',
      'LOE-10', 'LOE-11', 'LOE-12',
    ]);
  });

  it('groups the lines of enquiry under CIW’s themes', () => {
    const count = (key: string) => ciw.domains.find((d) => d.key === key)!.statements.length;
    expect(count('well-being')).toBe(4);
    expect(count('care-and-support')).toBe(4);
    expect(count('environment')).toBe(1);
    expect(count('leadership-and-management')).toBe(3);
  });

  it('marks the line-of-enquiry wording as ours, not CIW’s', () => {
    // The numbering is CIW's. The text is not — we could not obtain the text of
    // the lines themselves, and claiming otherwise would be the same mistake as
    // the invented NI- identifiers.
    for (const d of ciw.domains) {
      for (const s of d.statements) {
        expect(s.wordingOurs, `${s.id} is not marked as our wording`).toBe(true);
      }
    }
  });

  it('does not award an overall rating, because CIW does not', () => {
    // "We award a rating for each inspection theme. We do not award one overall
    // rating for the service as a whole."
    expect(ciw.publishesOverallRating).toBe(false);
  });

  it('does not rate Environment for domiciliary services', () => {
    // "Domiciliary support services do not receive a rating for ‘Environment’."
    const env = ciw.domains.find((d) => d.key === 'environment')!;
    expect(env.appliesToServiceTypes).toBeTruthy();
    expect(env.appliesToServiceTypes).not.toContain('domiciliary');
  });

  it('shows three themes to a domiciliary provider and four to a residential one', () => {
    expect(domainsForServiceTypes(ciw, ['domiciliary']).map((d) => d.key)).toEqual([
      'well-being', 'care-and-support', 'leadership-and-management',
    ]);
    expect(domainsForServiceTypes(ciw, ['residential'])).toHaveLength(4);
    expect(domainsForServiceTypes(ciw, ['domiciliary', 'residential'])).toHaveLength(4);
  });
});

describe('Northern Ireland uses RQIA’s real domains and invents nothing', () => {
  const rqia = getFramework('rqia');

  it('uses RQIA’s four inspection domains', () => {
    expect(rqia.domains.map((d) => d.label)).toEqual([
      'Is care safe?', 'Is care effective?', 'Is care compassionate?', 'Is the service well led?',
    ]);
  });

  it('has no invented statement identifiers anywhere', () => {
    // The whole point. `NI-S1` was made up and unlookupable.
    for (const d of rqia.domains) {
      for (const s of d.statements) {
        expect(s.id).not.toMatch(/^NI-/i);
        // A slug of the domain plus a number — obviously ours, and obviously
        // not a citation.
        expect(s.id).toMatch(/^[a-z][a-z-]*-\d+$/);
      }
    }
  });

  it('publishes no rating band, because RQIA publishes no rating', () => {
    // The old three-band "Mostly Compliant / Partially Compliant / Not
    // Compliant" scale has no source. RQIA publishes narrative inspection
    // reports, so we assert nothing.
    expect(rqia.ratings).toBeUndefined();
    expect(rqia.ratingsNote).toBeUndefined();
  });

  it('does not award an overall rating', () => {
    expect(rqia.publishesOverallRating).toBe(false);
  });

  it('says plainly that its sub-items are ours, not RQIA references', () => {
    expect(rqia.description).toMatch(/RQIA does not publish numbered quality statements/i);
    for (const d of rqia.domains) {
      for (const s of d.statements) {
        expect(s.wordingOurs, `${s.id} is not marked as our grouping`).toBe(true);
      }
    }
  });

  it('cites the Order it is built on', () => {
    expect(rqia.source).toContain('Health and Personal Care Services');
    expect(rqia.source).toContain('2003');
  });
});

describe('no framework contains a fabricated reference', () => {
  it('has no NI- identifiers in any framework', () => {
    for (const id of ALL_IDS) {
      for (const d of getFramework(id).domains) {
        for (const s of d.statements) {
          expect(s.id, `${id}/${s.id} looks like a fabricated reference`).not.toMatch(/^NI-/i);
        }
      }
    }
  });

  it('no source file mentions the removed identifiers', () => {
    // A regression guard on the source, not just the registry, so a comment or a
    // stale scoring function cannot quietly reintroduce them.
    const dir = path.join(__dirname);
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.ts') || name === 'frameworks.test.ts') continue;
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(text, `${name} still references an invented RQIA identifier`)
        .not.toMatch(/'NI-[SECRW]\d'/);
    }
  });

  it('does not re-skin any framework from another', () => {
    // Each framework must own its domain keys outright.
    const seen = new Map<string, string>();
    for (const id of ALL_IDS) {
      for (const d of getFramework(id).domains) {
        const owner = seen.get(d.key);
        if (owner) continue; // shared keys are fine across regulators (RQIA and CQC both have "safe")
        seen.set(d.key, id);
      }
    }
    // CQC, RQIA and Scotland may share the English words; Wales may share
    // nothing with CQC, which was the original defect.
    const cqcKeys = getFramework('cqc').domains.map((d) => d.key);
    const ciwKeys = getFramework('ciw').domains.map((d) => d.key);
    expect(ciwKeys.filter((k) => cqcKeys.includes(k))).toEqual([]);
  });
});
