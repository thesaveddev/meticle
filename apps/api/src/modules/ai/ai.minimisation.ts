import { query } from '../../shared/database';

/**
 * How much of the clinical record is allowed to cross the LLM boundary.
 *
 * The distinction this file exists to make, because redaction alone does not
 * make it: `ai.redaction.ts` removes *identifiers*. A note reading "Margaret
 * refused her risperidone at 11am, seemed withdrawn" becomes "Client 4F2A
 * refused her risperidone at 11am, seemed withdrawn" — nobody is named, and it
 * is still health data about a person, which is what Article 9 and a US
 * processor's terms actually turn on. Redaction makes the transfer safer; it
 * does not make the content non-special-category.
 *
 * So there is a second, independent dial, and it is a per-organisation setting
 * rather than a global one because the right answer is not ours to pick. A
 * provider whose DPAs are signed and whose clients accept model-assisted
 * drafting wants the narrative; one preparing for a local-authority audit, or
 * subject to an enhanced confidentiality clause, does not. Making that a
 * product setting means the decision is recorded, visible to the manager who
 * made it, and auditable — instead of being buried in a constant that nobody
 * would remember to change.
 *
 * Default is `full`, deliberately. Every existing customer's behaviour is
 * unchanged, and a privacy control that silently degrades a feature people are
 * relying on gets switched off wholesale within a week, taking the setting's
 * existence with it. The default is the safer operational choice; the stricter
 * mode is one toggle away and is what a security questionnaire should be
 * answered with.
 */
export type AiMinimisation = 'full' | 'minimal';

/**
 * Keys whose values are clinical narrative rather than a coded fact.
 *
 * Declared, never inferred, for the reason `ai.redaction.ts` already documents
 * at length: guessing which strings are sensitive either misses them or
 * destroys the clinical meaning the feature exists to read. A key list is
 * auditable — a reader can see exactly what is withheld, and a new call site
 * that adds a narrative field has to add it here or it crosses in the clear.
 *
 * The line drawn is narrative vs. fact. `status: 'refused'`, `severity:
 * 'moderate'`, `category: 'medication'` and every date are kept: they are the
 * signal, they are coded, and they identify nobody. `content`,
 * `description`, `medication_name` and the rest are the clinician's or
 * carer's own sentences about a person, which is the part that is both
 * highest-risk and least necessary — "a note was recorded on Tuesday" is
 * enough for change detection to have something to notice.
 */
export const CLINICAL_NARRATIVE_KEYS: readonly string[] = [
  // Daily and visit notes. Up to 600 characters each, 300 rows per request.
  'content',
  'note',
  'notes',
  'visit_notes',
  // Incident free text, plus the title, which is often a person's name or a
  // diagnosis in the author's own words.
  'description',
  'incident_detail',
  'details',
  'title',
  // A drug name implies a condition. "Risperidone" is psychiatric information
  // about an identifiable person even with the name removed.
  'medication_name',
  'medication_notes',
];

/**
 * What replaces withheld text. A constant rather than an empty string so the
 * model can still count and date-stamp the events — an empty field would read
 * as "no note was made", which is a different and wrong clinical statement.
 */
export const WITHHELD_MARKER = '[clinical narrative withheld: minimisation mode]';

function isNarrativeKey(key: string): boolean {
  return CLINICAL_NARRATIVE_KEYS.includes(key.toLowerCase());
}

/**
 * Replaces narrative values with a marker, walking into serialised JSON.
 *
 * The walk matters: every capability sends its rows as `JSON.stringify(rows)`
 * inside a single `records` variable, so without parsing that string the
 * function would see one opaque key named `records`, match nothing, and
 * return the payload unchanged. This is the same trap `collectNames` documents.
 */
function minimiseNode(node: unknown, depth = 0): unknown {
  if (depth > 6) return node;
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.stringify(minimiseNode(JSON.parse(trimmed), depth + 1));
      } catch {
        return node;
      }
    }
    return node;
  }
  if (Array.isArray(node)) return node.map((n) => minimiseNode(n, depth + 1));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = isNarrativeKey(k) ? WITHHELD_MARKER : minimiseNode(v, depth + 1);
    }
    return out;
  }
  return node;
}

/**
 * Applies the organisation's minimisation mode to a prompt's variables.
 *
 * Runs BEFORE redaction rather than after. Order is deliberate: withdrawing the
 * narrative first means the redaction pass has less text to reason about and,
 * more importantly, means no narrative can be reintroduced downstream by a
 * later template substitution. Redaction still runs on everything that remains.
 */
export function minimiseVariables(
  variables: Record<string, string>,
  mode: AiMinimisation,
): Record<string, string> {
  if (mode !== 'minimal') return variables;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value !== 'string') {
      out[key] = value;
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      out[key] = value;
      continue;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        out[key] = JSON.stringify(minimiseNode(JSON.parse(trimmed), 0));
      } catch {
        // Not JSON after all. Leave it alone rather than blanket-withholding a
        // field we could not parse — a service user's care plan is not
        // guaranteed to be JSON and a parse failure must not become a silent
        // data-loss bug on a clinical record.
        out[key] = value;
      }
      continue;
    }
    out[key] = isNarrativeKey(key) ? WITHHELD_MARKER : value;
  }
  return out;
}

/**
 * Reads an organisation's minimisation mode.
 *
 * Deliberately uncached. The alternative is a per-org TTL cache, and an AI
 * call costs seconds of latency and real money, so a single indexed primary-key
 * read underneath it is noise — while a cache would introduce a window in which
 * a manager had tightened the setting and we were still sending the narrative,
 * which is precisely the failure this control exists to prevent. There is no
 * version of that cache that is worth having.
 *
 * Uses the RLS-scoped `query`, not the admin pool: reading a tenant's own
 * setting should go through the same isolation as reading their data, and this
 * module is called on a request path where the tenant context is already set.
 */
export async function resolveAiMinimisation(orgId: string): Promise<AiMinimisation> {
  const result = await query('SELECT ai_data_minimisation FROM organizations WHERE id = $1', [orgId]);
  const value = result.rows[0]?.ai_data_minimisation;
  return value === 'minimal' ? 'minimal' : 'full';
}
