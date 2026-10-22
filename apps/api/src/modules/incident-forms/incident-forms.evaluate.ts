/**
 * Form Engine evaluation (P0-1) — pure, no DB.
 *
 * Order per plan §5: parent change → re-evaluate conditions → update options →
 * revalidate → recalc → re-evaluate workflow → warn on material severity change.
 * This module covers conditions + validation + hidden-answer policy; severity
 * and workflow hooks arrive in P0-2/P0-3 and call back into this result.
 *
 * Conditions reference values, never labels: { field, op, value } combined
 * with { all: [...] } / { any: [...] } / { not: ... }. Ops: equals, not_one_of,
 * contains, empty, lt/lte/gt/gte, before/after (dates). Unknown fields or
 * unparseable conditions never hide a required field — fail-open to visible.
 */

export interface FieldCondition {
  field?: string;
  op?: string;
  value?: unknown;
  all?: FieldCondition[];
  any?: FieldCondition[];
  not?: FieldCondition;
}

export interface EvaluableField {
  field_key: string;
  required?: boolean | null;
  type?: string | null;
  options?: unknown;
  validation?: Record<string, unknown> | null;
  visibility?: FieldCondition | null;
  requiredness?: FieldCondition | null;
  hidden_policy?: string | null;
}

export interface EvaluateResult {
  visible: Record<string, boolean>;
  required: Record<string, boolean>;
  invalid: Record<string, string>;
  /** Answers the server will drop (hidden + policy=clear). */
  cleared: string[];
  /** Answers kept for audit but excluded from submission/validation. */
  retainedExcluded: string[];
}

function asDate(v: unknown): number | null {
  if (v == null || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function compareValues(op: string, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case 'equals':
      if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
      return String(actual ?? '') === String(expected ?? '');
    case 'not_one_of':
      if (!Array.isArray(expected)) return true;
      if (Array.isArray(actual)) return !actual.some(a => expected.map(String).includes(String(a)));
      return !expected.map(String).includes(String(actual ?? ''));
    case 'contains':
      if (Array.isArray(actual)) return actual.map(String).some(a => String(a).includes(String(expected ?? '')));
      return String(actual ?? '').includes(String(expected ?? ''));
    case 'empty':
      if (Array.isArray(actual)) return actual.length === 0;
      return actual == null || actual === '';
    case 'not_empty':
      if (Array.isArray(actual)) return actual.length > 0;
      return actual != null && actual !== '';
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const a = Number(actual);
      const e = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(e)) return false;
      if (op === 'lt') return a < e;
      if (op === 'lte') return a <= e;
      if (op === 'gt') return a > e;
      return a >= e;
    }
    case 'before':
    case 'after': {
      const a = asDate(actual);
      const e = asDate(expected);
      if (a == null || e == null) return false;
      return op === 'before' ? a < e : a > e;
    }
    default:
      return false;
  }
}

export function evaluateCondition(cond: FieldCondition | null | undefined, answers: Record<string, unknown>): boolean {
  if (!cond || typeof cond !== 'object') return true;
  if (Array.isArray((cond as unknown as { all: unknown }).all)) {
    return (cond.all as FieldCondition[]).every(c => evaluateCondition(c, answers));
  }
  if (Array.isArray((cond as unknown as { any: unknown }).any)) {
    return (cond.any as FieldCondition[]).some(c => evaluateCondition(c, answers));
  }
  if (cond.not) return !evaluateCondition(cond.not, answers);
  if (!cond.field || !cond.op) return true;
  // Never gate on a field that has no answer yet — unknown ≠ no.
  if (!(cond.field in answers) || answers[cond.field] === undefined) return true;
  try {
    return compareValues(cond.op, answers[cond.field], cond.value);
  } catch {
    return true;
  }
}

function validateValue(field: EvaluableField, value: unknown): string | null {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const validation = (field.validation ?? {}) as Record<string, unknown>;
  if (field.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Must be a number';
    if (typeof validation.min === 'number' && n < validation.min) return `Must be at least ${validation.min}`;
    if (typeof validation.max === 'number' && n > validation.max) return `Must be at most ${validation.max}`;
  }
  if ((field.type === 'text' || field.type === 'textarea') && typeof value === 'string') {
    if (typeof validation.minLength === 'number' && value.length < validation.minLength) return `Must be at least ${validation.minLength} characters`;
    if (typeof validation.maxLength === 'number' && value.length > validation.maxLength) return `Must be at most ${validation.maxLength} characters`;
    if (typeof validation.pattern === 'string' && validation.pattern) {
      try {
        if (!new RegExp(validation.pattern).test(value)) return 'Invalid format';
      } catch {
        // A bad pattern in config must not block a report.
      }
    }
  }
  if ((field.type === 'select' || field.type === 'radio') && Array.isArray(field.options)) {
    const allowed = (field.options as Array<string | { value: string }>).map(o => (typeof o === 'string' ? o : o.value));
    if (!allowed.includes(String(value))) return 'Invalid option';
  }
  return null;
}

export function evaluateForm(
  fields: EvaluableField[],
  answers: Record<string, unknown>,
): EvaluateResult {
  const visible: Record<string, boolean> = {};
  const required: Record<string, boolean> = {};
  const invalid: Record<string, string> = {};
  const cleared: string[] = [];
  const retainedExcluded: string[] = [];

  for (const f of fields) {
    // Fail-open: an unparseable visibility condition keeps the field visible.
    let isVisible = true;
    try {
      isVisible = evaluateCondition(f.visibility ?? null, answers);
    } catch {
      isVisible = true;
    }
    visible[f.field_key] = isVisible;

    let isRequired = Boolean(f.required);
    if (isVisible && f.requiredness) {
      try {
        // requiredness narrows or widens the base flag: required if base OR
        // the condition says so when base is false; required only if the
        // condition holds when base is true. Either way the condition decides.
        isRequired = evaluateCondition(f.requiredness, answers);
      } catch {
        // Keep base.
      }
    } else if (!isVisible) {
      isRequired = false;
    }
    required[f.field_key] = isVisible && isRequired;

    if (!isVisible) {
      const policy = f.hidden_policy ?? 'clear';
      if (policy === 'clear') {
        if (f.field_key in answers && answers[f.field_key] !== undefined) cleared.push(f.field_key);
      } else {
        retainedExcluded.push(f.field_key);
      }
      continue;
    }

    const value = answers[f.field_key];
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    if (isRequired && empty) {
      invalid[f.field_key] = 'Required';
      continue;
    }
    const err = validateValue(f, value);
    if (err) invalid[f.field_key] = err;
  }

  return { visible, required, invalid, cleared, retainedExcluded };
}
