import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { minimiseVariables, WITHHELD_MARKER, CLINICAL_NARRATIVE_KEYS } from './ai.minimisation';
import { assertApprovedProcessor, approvedProcessors, getProvider } from './ai.provider';
import { AI_CAPABILITIES, CAPABILITY_BY_PATH, getCapability, AI_METHOD_DISCLOSURE } from './ai.capabilities';

/**
 * These are the controls at the LLM boundary, and each test below exists because
 * a plausible future edit would otherwise undo it silently. The three that
 * matter most are the repository scans at the bottom: they are the reason a new
 * AI capability added next quarter cannot quietly inherit a leak, because
 * nothing about writing a new call site forces anyone to think about this file.
 */

const AI_DIR = __dirname;
const API_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Every .ts under the AI module plus the one consumer that renders prompts. */
function boundarySourceFiles(): string[] {
  const roots = [
    path.join(API_ROOT, 'src', 'modules', 'ai'),
    path.join(API_ROOT, 'src', 'modules', 'events', 'consumers'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    for (const entry of fs.readdirSync(root)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue;
      files.push(path.join(root, entry));
    }
  }
  return files;
}

/** Strips comments, so a source scan cannot match prose that merely mentions a symbol. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('AI boundary: clinical narrative minimisation', () => {
  it('is a no-op in full mode, byte for byte', () => {
    const vars = { content: 'Refused risperidone, seemed withdrawn', description: 'Fell in the kitchen' };
    expect(minimiseVariables(vars, 'full')).toEqual(vars);
    expect(minimiseVariables(vars, 'full')).toBe(vars);
  });

  it('withholds narrative in minimal mode', () => {
    const out = minimiseVariables({ content: 'Refused risperidone', title: 'Fall in kitchen' }, 'minimal');
    expect(out.content).toBe(WITHHELD_MARKER);
    expect(out.title).toBe(WITHHELD_MARKER);
  });

  it('keeps the coded facts that make the feature work', () => {
    const out = minimiseVariables(
      { status: 'refused', severity: 'moderate', category: 'medication', note_date: '2026-09-01' },
      'minimal',
    );
    // Withholding every field would leave the model with nothing and would be
    // privacy theatre, not privacy. The line is narrative versus coded fact.
    expect(out.status).toBe('refused');
    expect(out.severity).toBe('moderate');
    expect(out.category).toBe('medication');
    expect(out.note_date).toBe('2026-09-01');
  });

  it('withholds a drug name, because it implies a condition', () => {
    const out = minimiseVariables({ medication_name: 'Risperidone', status: 'administered' }, 'minimal');
    expect(out.medication_name).toBe(WITHHELD_MARKER);
    expect(out.status).toBe('administered');
  });

  it('walks into the serialised records blob', () => {
    // Every capability sends rows as JSON.stringify(rows) inside one variable.
    // A function that did not parse it would see one opaque key named
    // "records", match nothing, and pass the whole payload through untouched —
    // which is precisely the bug this test is here to prevent.
    const records = [
      { source_type: 'daily_note', content: 'Declined a shower today', note_date: '2026-09-01' },
      { source_type: 'incident', title: 'Unwitnessed fall', description: 'Found on floor by the kettle' },
    ];
    const out = minimiseVariables({ records: JSON.stringify(records) }, 'minimal');
    const parsed = JSON.parse(out.records);
    expect(parsed[0].content).toBe(WITHHELD_MARKER);
    expect(parsed[0].note_date).toBe('2026-09-01');
    expect(parsed[1].title).toBe(WITHHELD_MARKER);
    expect(parsed[1].description).toBe(WITHHELD_MARKER);
    expect(out.records).not.toContain('Declined a shower');
    expect(out.records).not.toContain('kettle');
  });

  it('walks into nested objects and arrays', () => {
    const nested = { a: { b: { content: 'secret narrative' } }, list: [{ notes: 'secret too' }] };
    const out = JSON.stringify(minimiseVariables({ records: JSON.stringify(nested) }, 'minimal'));
    expect(out).not.toContain('secret');
  });

  it('leaves a non-JSON value alone rather than blanking a clinical field', () => {
    // A care plan is not guaranteed to be JSON. A parse failure must not
    // silently become data loss on a clinical record.
    const out = minimiseVariables({ content: '{not valid json', question: 'why this?' }, 'minimal');
    expect(out.content).toBe('{not valid json');
    expect(out.question).toBe('why this?');
  });

  it('leaves non-narrative free text untouched', () => {
    const out = minimiseVariables({ question: 'Which clients refused medication this week?' }, 'minimal');
    expect(out.question).toBe('Which clients refused medication this week?');
  });

  it('declares every narrative key it withholds, so the list is auditable', () => {
    for (const key of ['content', 'description', 'title', 'medication_name', 'notes']) {
      expect(CLINICAL_NARRATIVE_KEYS).toContain(key);
    }
  });
});

describe('AI boundary: processor approval', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.AI_APPROVED_PROCESSORS;
    delete process.env.AI_TRANSFER_BASIS_ACKNOWLEDGED;
    delete process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('allows the two processors we implement by default', () => {
    expect(approvedProcessors()).toEqual(new Set(['openai', 'anthropic']));
  });

  it('refuses a processor that is not approved', () => {
    process.env.AI_APPROVED_PROCESSORS = 'openai';
    expect(() => assertApprovedProcessor('anthropic')).toThrow(/not in AI_APPROVED_PROCESSORS/);
  });

  it('refuses a processor invented by a typo rather than defaulting to allow', () => {
    process.env.AI_APPROVED_PROCESSORS = 'openai,anthorpic';
    expect(() => assertApprovedProcessor('anthropic')).toThrow();
  });

  it('treats an empty allowlist as deny-all, not allow-all', () => {
    process.env.AI_APPROVED_PROCESSORS = '';
    expect(approvedProcessors().size).toBe(0);
    expect(() => assertApprovedProcessor('openai')).toThrow();
  });

  it('gates the transfer basis in production only', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AI_TRANSFER_BASIS_ACKNOWLEDGED;
    // The whole point: a tracked legal item is a promise, and promises do not
    // stop a deploy. This must refuse.
    expect(() => assertApprovedProcessor('openai')).toThrow(/AI_TRANSFER_BASIS_ACKNOWLEDGED/);
    expect(() => assertApprovedProcessor('openai')).toThrow(/T0-17b/);
  });

  it('passes in production once the transfer basis is acknowledged', () => {
    process.env.NODE_ENV = 'production';
    process.env.AI_TRANSFER_BASIS_ACKNOWLEDGED = 'true';
    expect(() => assertApprovedProcessor('openai')).not.toThrow();
  });

  it('does not require a signed DPA to run a local build', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertApprovedProcessor('openai')).not.toThrow();
  });

  it('gates every provider, including the fallback path', () => {
    // getProvider is the only construction site, so a guard anywhere else would
    // leave the fallback provider unguarded — and the fallback is the one that
    // fires when the primary is failing, i.e. under load.
    process.env.AI_APPROVED_PROCESSORS = 'anthropic';
    expect(() => getProvider({ provider: 'openai', apiKey: 'sk-test' })).toThrow();
    expect(() => getProvider({ provider: 'anthropic', apiKey: 'sk-test' })).not.toThrow();
  });
});

describe('AI boundary: what the intelligence surface claims to be', () => {
  it('routes every one of the eleven entry points at one mechanism', () => {
    // Eleven routes, one handler. Presenting them as eleven features is the
    // misrepresentation; the registry is what stops the names implying otherwise.
    expect(Object.keys(CAPABILITY_BY_PATH).filter((p) => p !== '/intelligence')).toHaveLength(11);
    expect(AI_METHOD_DISCLOSURE.method).toBe('dated_record_query_plus_language_model_summary');
  });

  it('denies the statistical claims its old route names implied', () => {
    expect(AI_METHOD_DISCLOSURE.appliesStatisticalDetection).toBe(false);
    expect(AI_METHOD_DISCLOSURE.hasLearnedBaseline).toBe(false);
    expect(AI_METHOD_DISCLOSURE.hasTimeSeriesComparison).toBe(false);
  });

  it('does not call anomaly detection or change detection a model', () => {
    const anomaly = getCapability('operational_anomaly_detection');
    expect(anomaly.label).toBe('Operational activity review');
    expect(anomaly.summary).toMatch(/no statistical detection/i);

    const change = getCapability('change_detection');
    expect(change.label).toBe('Record change summary');
    expect(change.summary).toMatch(/not changes a system inferred|nothing is learned/i);
  });

  it('keeps the frozen feature-flag ids so no customer silently loses a capability', () => {
    // enabledFeatures in every existing org stores these exact strings, and the
    // AI audit log keys on them. Renaming one would disable a feature a customer
    // had switched on, with no error anywhere.
    for (const id of ['care_summary', 'change_detection', 'operational_anomaly_detection', 'risk_signals']) {
      expect(AI_CAPABILITIES[id as keyof typeof AI_CAPABILITIES].id).toBe(id);
    }
  });

  it('declares every entry point, label and summary', () => {
    for (const cap of Object.values(AI_CAPABILITIES)) {
      expect(cap.label, cap.id).not.toContain('_');
      expect(cap.label, cap.id).toBeTruthy();
      expect(cap.summary, cap.id).toBeTruthy();
      expect(cap.entryPoint, cap.id).toMatch(/^\//);
    }
  });

  it('marks narrative-dependent capabilities so minimisation warnings can be honest', () => {
    expect(getCapability('family_communication_draft').requiresNarrative).toBe(true);
    expect(getCapability('rota_alternatives').requiresNarrative).toBe(false);
  });
});

describe('AI boundary: repository scans', () => {
  it('no call site reaches for the provider without the guard in front of it', () => {
    // getProvider is the only construction site. This asserts that, so adding a
    // second way to build a provider is a test failure rather than an
    // unreviewed hole in the boundary.
    const constructors = ['new OpenAIProvider(', 'new AnthropicProvider('];
    for (const file of boundarySourceFiles()) {
      if (file.endsWith('ai.provider.ts')) continue;
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      for (const ctor of constructors) {
        expect(src.includes(ctor), `${path.basename(file)} constructs a provider directly`).toBe(false);
      }
    }
  });

  it('no call site renders a prompt without going through renderOrgPrompt', () => {
    // renderPrompt is pure and synchronous; it redacts but knows nothing about
    // the organisation's minimisation setting. A handler that calls it directly
    // would send clinical narrative under a policy that forbids it, and would
    // still compile and still work — the failure would be invisible in review.
    for (const file of boundarySourceFiles()) {
      if (file.endsWith('ai.render.ts') || file.endsWith('ai.prompts.ts')) continue;
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      expect(/\brenderPrompt\(/.test(src), `${path.basename(file)} calls renderPrompt directly`).toBe(false);
    }
  });

  it('every intelligence route is declared in the capability registry', () => {
    const routes = fs.readFileSync(path.join(AI_DIR, 'ai.routes.ts'), 'utf8');
    const declared = new Set(Object.values(CAPABILITY_BY_PATH));
    for (const match of routes.matchAll(/router\.post\('\/([a-z-]+)'[^)]*AIController\.intelligence/g)) {
      expect(declared.has(`/${match[1]}`), `/${match[1]} is routed but not declared`).toBe(true);
    }
  });
});
