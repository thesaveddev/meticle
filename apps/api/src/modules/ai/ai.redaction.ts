import { createHmac } from 'node:crypto';

/**
 * De-identification for the LLM boundary.
 *
 * The problem this exists to solve: every AI capability built a JSON payload
 * from real rows and sent it verbatim to OpenAI or Anthropic. That payload
 * carried service-user full names, staff full names, and — in the case of
 * daily notes and incident descriptions — up to 600 characters of free-text
 * clinical writing, all of it special category data under UK GDPR Article 9.
 *
 * Applied inside `renderPrompt` rather than at each of the thirteen call sites,
 * on purpose. A control that has to be remembered at thirteen places has been
 * forgotten at one of them by the time it matters, and a new capability would
 * inherit the leak by default.
 *
 * What this does and does not achieve, stated plainly because the difference
 * matters more than the code:
 *
 *   It removes direct identifiers — names, emails, phone numbers, postcodes,
 *   dates of birth, and long digit runs that could be an NHS number or a
 *   reference. What crosses the wire becomes "Client 4F2A had a note about
 *   medication refusal on Tuesday", which is still useful to a model and no
 *   longer identifies anybody.
 *
 *   It does NOT make the data non-personal. "Client 4F2A refused medication on
 *   Tuesday" is health information about an identifiable person to anyone who
 *   can combine it with the care record, and a small household or a single-
 *   client agency can re-identify a pseudonym from context alone. This is
 *   pseudonymisation, not anonymisation, and the ICO is explicit that
 *   pseudonymised data remains personal data. The residual transfer risk is
 *   recorded rather than papered over — see T0-17b in docs/GO_LIVE_READINESS.md.
 *
 * The honest long-term answers are a UK-region or self-hosted model, or
 * dropping raw free-text note content from prompts altogether. Neither is a
 * change that can be made safely in the middle of a working day.
 */

/** Direct identifiers with an unambiguous shape. High confidence, always removed. */
const DIRECT_IDENTIFIERS: { label: string; pattern: RegExp; replace: string }[] = [
  { label: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: '[email]' },
  { label: 'phone', pattern: /\b(?:\+44|0)\d[\d\s().-]{7,}\d\b/g, replace: '[phone]' },
  { label: 'postcode', pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, replace: '[postcode]' },
  { label: 'date of birth', pattern: /\b(?:DOB|D\.O\.B\.?|date of birth)\s*[:\-]?\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/gi, replace: '[date of birth]' },
  // A bare long digit run, and the spaced NHS-number shape. Dashes are
  // deliberately NOT a separator here: "2026-09-01" is a date the prompt needs,
  // and a looser pattern would redact every date in the payload.
  { label: 'long digit run', pattern: /\b\d{9,}\b/g, replace: '[id]' },
  { label: 'NHS-number shape', pattern: /\b\d{3}[ ]\d{3}[ ]\d{4}\b/g, replace: '[id]' },
];

/** Keys whose values are known to hold a person's name. Structural, not guessed. */
const NAME_KEY = /_(?:name|names)$/i;

/**
 * Free-text fields that routinely contain people's names but are not named as
 * such — `incident.involved` holds a comma-separated list of people, and no
 * amount of key-pattern matching would find it.
 *
 * Declared by the call site rather than inferred, because inferring it is worse
 * than useless: treating `description` as a name-bearing field would classify
 * the sentence "Fell in the kitchen" as a name and replace the whole thing,
 * destroying the clinical meaning the feature exists to read. Guessing here
 * would quietly degrade output quality in exchange for looking thorough.
 */
export type NameBearingKey = string;

function isNameBearingKey(key: string, extra: NameBearingKey[]): boolean {
  return NAME_KEY.test(key) || extra.some((k) => k.toLowerCase() === key.toLowerCase());
}

/** What a pseudonym looks like on the wire, so a model can still reason about one person. */
const PERSON_PREFIX = 'Client';
const STAFF_PREFIX = 'Staff';

/**
 * A stable pseudonym for a name, scoped to the organisation.
 *
 * Stable within an organisation so a model can connect "Client 4F2A" across
 * five records and notice a pattern — which is the entire value of the feature.
 * Scoped by org so two tenants cannot correlate pseudonyms, and HMAC'd rather
 * than hashed so the mapping cannot be reversed with a rainbow table over the
 * space of UK names.
 */
export function pseudonymFor(name: string, orgId: string, kind: 'person' | 'staff' = 'person'): string {
  const digest = createHmac('sha256', `ai-redaction:${orgId}`).update(name.trim().toLowerCase()).digest('hex');
  const prefix = kind === 'staff' ? STAFF_PREFIX : PERSON_PREFIX;
  return `${prefix} ${digest.slice(0, 4).toUpperCase()}`;
}

/** Replaces every free-text occurrence of the names we found in the payload. */
function substituteNames(text: string, names: Map<string, string>): string {
  if (names.size === 0) return text;
  // Longest first, so "Margaret Anne Whitfield" is replaced before "Margaret"
  // and does not leave a stray " Anne Whitfield" behind.
  const ordered = [...names.entries()].sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [name, pseudonym] of ordered) {
    if (!name || name.length < 2) continue;
    // Case-insensitive, and bounded by a word boundary so a short name does not
    // match inside an unrelated word.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), pseudonym);
    // Also replace the given name alone, because free text almost never uses
    // the full name. Guarded on length so initials like "J." are left alone.
    const [first] = name.trim().split(/\s+/);
    if (first && first.length >= 3) {
      out = out.replace(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), pseudonym);
    }
  }
  return out;
}

/**
 * Collects the names present in a payload, keyed by the exact strings to
 * replace. Reads every `*_name` field because that is the shape our own
 * queries produce — `person_name`, `staff_name` — rather than trying to guess
 * which free-text words are names.
 */
export function collectNames(
  payload: Record<string, unknown>,
  extraNameKeys: NameBearingKey[] = [],
): Map<string, string> {
  const personNames = new Set<string>();
  const staffNames = new Set<string>();

  const walk = (node: unknown, keyHint?: string, depth = 0) => {
    if (depth > 6) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, keyHint, depth + 1)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, k, depth + 1);
      return;
    }
    if (typeof node !== 'string' || !node.trim()) return;

    // The payloads arrive already serialised — `records` is a JSON.stringify
    // result, not an object — so without this the walker stops at the string
    // and never sees the nested person_name. Every capability sends it that
    // way, so this is the case that actually occurs, not an edge case.
    const trimmed = node.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        walk(JSON.parse(trimmed), keyHint, depth + 1);
      } catch {
        // Not JSON after all; fall through and treat it as plain text.
      }
    }

    if (!keyHint || !isNameBearingKey(keyHint, extraNameKeys)) return;
    for (const part of node.split(',')) {
      const trimmed = part.trim();
      // Guard against a field that is not actually a name, and against
      // short fragments that would redact half the prompt.
      if (trimmed.length < 3 || trimmed.length > 80) continue;
      if (!/^[\p{L}][\p{L}\s'-]*$/u.test(trimmed)) continue;
      if (keyHint.toLowerCase().startsWith('staff')) staffNames.add(trimmed);
      else personNames.add(trimmed);
    }
  };

  walk(payload);
  // Names and staff names are pseudonymised through separate prefixes so a
  // model does not conclude that a client and a carer are the same person.
  const names = new Map<string, string>();
  for (const name of personNames) names.set(name, pseudonymFor(name, '', 'person'));
  for (const name of staffNames) names.set(name, pseudonymFor(name, '', 'staff'));
  return names;
}

/**
 * Redacts one payload value. Returns the text with every known name replaced
 * and every direct identifier stripped.
 */
export function redactText(text: string, names: Map<string, string>): string {
  let out = substituteNames(text, names);
  for (const { pattern, replace } of DIRECT_IDENTIFIERS) {
    // Recreated per call: a shared global regex carries lastIndex between uses.
    out = out.replace(new RegExp(pattern.source, pattern.flags), replace);
  }
  return out;
}

/**
 * Redacts every value in a prompt's variables.
 *
 * Names are collected from the variables as a whole before any substitution, so
 * a name that appears only in free text is still replaced — the `person_name`
 * field is what tells us the string "Margaret" is a name.
 */
export function redactVariables(
  variables: Record<string, string>,
  orgId: string,
  extraNameKeys: NameBearingKey[] = [],
): Record<string, string> {
  const names = collectNames(variables as Record<string, unknown>, extraNameKeys);
  // Re-key the collected names through the org-scoped HMAC now that the org is
  // known; collectNames cannot do it because it does not see the org.
  const scoped = new Map<string, string>();
  for (const [name, pseudonym] of names) {
    const kind = pseudonym.startsWith(STAFF_PREFIX) ? 'staff' : 'person';
    scoped.set(name, pseudonymFor(name, orgId, kind));
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    out[key] = typeof value === 'string' ? redactText(value, scoped) : value;
  }
  return out;
}
