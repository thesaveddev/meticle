/**
 * Mica's navigation intent — the spoken destination, turned into a route.
 *
 * Why this exists. Mica could answer questions and draft writes, but every
 * answer came back as spoken text: "give me Evan Turner's MAR chart for March"
 * was recited, and the carer then had to find the chart themselves through the
 * nav. The product decision behind this module is that a destination phrase is a
 * request to *go* somewhere, not a question about somewhere — Mica should open
 * the page it was asked for and keep listening, instead of describing it.
 *
 * So this module is deliberately deterministic: no LLM, no database, no network,
 * nothing imported at all. The utterance is parsed in-process, the caller
 * resolves the one thing a parser cannot know (a spoken name → a person id), and
 * the client pushes the route. A model is not needed to know that "rota" is a
 * page, and paying tokens and a round trip to work it out would make navigation
 * slower and less predictable than the nav bar it stands in for.
 *
 * Two gates keep it from hijacking the paths that already work:
 *
 *   1. A destination noun alone is not enough. There has to be a navigation verb
 *      ("open", "show me", "take me to", "give me", …) *or* the possessive-chart
 *      shape ("Evan Turner's MAR chart"), which is what makes the phrase a
 *      request to go somewhere rather than a question about somewhere.
 *   2. A question stays a question. "how many incidents this month", "who is on
 *      shift today" and "list the rota" all return null, because the answer
 *      wanted is spoken; only an explicit open/navigate verb overrides that
 *      ("open the incidents" navigates, "what incidents happened" does not).
 *
 * Booking is not navigation either: "book an appointment for the podiatry
 * clinic" names an appointment and returns null, because `book` is not a
 * navigation verb. Write intents belong to the action gateway.
 *
 * Pure by design: `today` is a parameter, so the month arithmetic is testable
 * without a clock or a frozen process timezone. The caller passes the database's
 * CURRENT_DATE, the same source `cleanDate` uses in `mica.tools.ts`.
 */

export type MicaNavigationDestination =
  | 'mar-chart'
  | 'emedication'
  | 'person'
  | 'people'
  | 'rota'
  | 'incidents'
  | 'tasks'
  | 'appointments'
  | 'leave'
  | 'reports'
  | 'compliance'
  | 'training'
  | 'policies'
  | 'settings'
  | 'dashboard'
  | 'chat'
  | 'goals'
  | 'room-checks'
  | 'expenses'
  | 'marketplace'
  | 'agencies'
  | 'insights'
  | 'my-week'
  | 'live-map'
  | 'homecare'
  | 'payroll';

export interface MicaNavigationRequest {
  destination: MicaNavigationDestination;
  /** Route path to push, without a query string. Never contains an id. */
  path: string;
  /** Noun for the spoken/visible label, e.g. 'MAR chart', 'rota planner'. */
  label: string;
  /** Person named in the utterance, only for destinations that need one. */
  personName?: string;
  /** YYYY-MM, only for the month-scoped medication destinations. */
  month?: string;
  /**
   * True when the destination is person-specific *and* a name was heard, so the
   * caller must resolve `personName` to an id (and append `/:id` for 'person').
   * Absent when no name was said, which is why "open the medications" still
   * navigates to the module rather than failing: the destination is useful
   * without a person, and inventing one would be worse than not resolving one.
   */
  needsPerson?: boolean;
  /** Query-parameter names the destination's page actually honours. */
  monthParam?: 'month';
}

interface DestinationRule {
  destination: MicaNavigationDestination
  path: string
  label: string
  pattern: RegExp
}

const request = (
  destination: MicaNavigationDestination,
  path: string,
  label: string,
  extra: Partial<MicaNavigationRequest> = {},
): MicaNavigationRequest => ({ destination, path, label, ...extra });

/**
 * The destination table: one row per page Mica may open, in match order.
 *
 * Order matters only where phrases overlap: 'my week' has to be tested before
 * 'rota', because "open my rota" contains both and the narrower reading is the
 * one the user means. Everything else is disjoint by construction, and the
 * patterns are deliberately narrow — a destination noun is only ever a whole
 * word or a stated phrase, so "open the staff directory" matches nothing at all
 * rather than being stretched into a page that does not exist.
 */
const DESTINATIONS: readonly DestinationRule[] = [
  { destination: 'my-week', path: '/my-week', label: 'my week', pattern: /\b(my week|my shifts|my rota)\b/ },
  {
    destination: 'emedication',
    path: '/emedication',
    label: 'medication charts',
    pattern: /\b(medications?|medication charts?|mar[\s-]?chart|marchart|mar charts?|meds|e-?medication)\b/,
  },
  { destination: 'person', path: '/people', label: 'profile', pattern: /\b(profile|person record|care record)\b/ },
  { destination: 'people', path: '/people', label: 'people directory', pattern: /\b(people|service users?|residents?|clients?|people directory)\b/ },
  { destination: 'rota', path: '/scheduling', label: 'rota planner', pattern: /\b(rota|shift rota|rota planner|schedule|scheduling)\b/ },
  { destination: 'appointments', path: '/appointments', label: 'appointments', pattern: /\b(appointments?|diary|calendar)\b/ },
  { destination: 'incidents', path: '/incidents', label: 'incidents', pattern: /\b(incidents?|near miss(?:es)?)\b/ },
  { destination: 'tasks', path: '/tasks', label: 'tasks', pattern: /\b(tasks?|to-?dos?|task list)\b/ },
  { destination: 'leave', path: '/leave', label: 'leave', pattern: /\b(leave|holiday requests?|annual leave)\b/ },
  { destination: 'training', path: '/training', label: 'training', pattern: /\b(training|training matrix)\b/ },
  { destination: 'reports', path: '/reporting', label: 'reports', pattern: /\b(reports?|reporting)\b/ },
  { destination: 'compliance', path: '/compliance', label: 'compliance', pattern: /\b(compliance|audits?)\b/ },
  { destination: 'policies', path: '/policies', label: 'policies', pattern: /\bpolic(?:y|ies)\b/ },
  { destination: 'settings', path: '/settings', label: 'settings', pattern: /\bsettings\b/ },
  { destination: 'dashboard', path: '/dashboard', label: 'dashboard', pattern: /\b(dashboard|home page)\b/ },
  { destination: 'chat', path: '/chat', label: 'messages', pattern: /\b(chat|messages|communication)\b/ },
  { destination: 'goals', path: '/goals', label: 'goals', pattern: /\bgoals?\b/ },
  { destination: 'room-checks', path: '/room-checks', label: 'room checks', pattern: /\broom checks?\b/ },
  { destination: 'expenses', path: '/expenses', label: 'expenses', pattern: /\b(expenses?|petty cash)\b/ },
  { destination: 'marketplace', path: '/shift-marketplace', label: 'shift marketplace', pattern: /\b(shift marketplace|marketplace|open shifts?)\b/ },
  { destination: 'agencies', path: '/agencies', label: 'agencies', pattern: /\b(agencies|agency)\b/ },
  { destination: 'insights', path: '/insights', label: 'insights', pattern: /\binsights?\b/ },
  { destination: 'live-map', path: '/live-map', label: 'visit check-in map', pattern: /\b(live map|visit map|check-?in map)\b/ },
  { destination: 'homecare', path: '/homecare', label: 'visits and packages', pattern: /\b(homecare|visits and packages)\b/ },
  { destination: 'payroll', path: '/payroll-timesheets', label: 'payroll and timesheets', pattern: /\b(payroll|timesheets?)\b/ },
];

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * The verbs that turn a destination noun into "take me there". "show" covers
 * "show me"; "give me" is how the phrasing test's real utterance arrives.
 */
/**
 * "give me" is the weakest verb in the set: it is how people ask a question
 * ("give me today's appointments") at least as often as it is how they ask for a
 * page. It navigates only when a person or a chart is named — "give me Evan
 * Turner's MAR chart", "give me the MAR chart" — because that chart *is* a page,
 * where a list of today's appointments is an answer the carer expects to hear.
 * Every other verb here is an explicit request to be taken somewhere and
 * navigates on any destination.
 */
const GIVE_ME_ONLY = /\bgive me\b/;

const NAVIGATION_VERB =
  /\b(open|show|take me to|go to|navigate|pull up|bring up|jump to|display|view|give me|let me see|i want to see|i need to see)\b/;

/**
 * The subset strong enough to override a question opener. "show me today's
 * incidents" navigates because "show" is a request to be taken somewhere;
 * "tell me about the rota" does not, because the carer wants to hear it.
 */
const STRONG_NAVIGATION_VERB = /\b(open|take me to|go to|navigate|pull up|bring up|jump to|display)\b/;

/** A question opener keeps the utterance on the question path unless overridden. */
const QUESTION_PREFIX =
  /^(who|what|when|where|why|how|is|are|do|does|did|can|could|should|tell|summari[sz]e|list|give me a breakdown)\b/;

/**
 * "MAR chart" survives being said as "mar chart", "MAR-chart", "marchart" (the
 * phrasing test's own transcription) and "mar charts".
 */
const CHART_NOUN = /\b(?:mar[\s-]?charts?|marchart|medications?[\s-]?charts?)\b/;

/** "Evan Turner's" — capitalised words, so a name is only read from real text. */
const POSSESSIVE_NAME = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/;

/** "for Evan Turner" / "about Evan Turner". */
const PHRASE_NAME = /\b(?:for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;

/** Words a name-shaped match must not be read as: "for March" names a month. */
const NOT_A_NAME = new Set(['mar', 'chart', 'medications', 'medication', 'the', 'my', 'this', 'that', 'today', 'tomorrow']);

/**
 * The person named in the utterance, if one was.
 *
 * The possessive is preferred over "for …" because it cannot be confused with
 * the month: "Evan Turner's MAR chart for March" has a name and a month, and
 * reading "March" as a person would navigate to a stranger's record.
 */
function extractPersonName(raw: string): string | undefined {
  const candidate = raw.match(POSSESSIVE_NAME)?.[1] ?? raw.match(PHRASE_NAME)?.[1];
  if (!candidate) return undefined;
  const lowered = candidate.toLowerCase();
  // "for March" follows the name preposition but names a month.
  if (lowered in MONTHS || NOT_A_NAME.has(lowered)) return undefined;
  return candidate;
}

/**
 * The month an utterance names, as YYYY-MM, or undefined when it names none.
 *
 * Deterministic, including the awkward cases: a bare month name takes the
 * current year and never rolls forward (a carer saying "the March chart" in
 * October means this year's March — a chart that already exists — so rolling to
 * next March would open the wrong one), while an explicit 4-digit year anywhere
 * in the phrase always wins.
 */
function resolveMonth(lower: string, today: string): string | undefined {
  const [year, month] = today.split('-').map(Number);
  const iso = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  if (/\bthis month\b/.test(lower)) return iso(year, month);
  if (/\blast month\b/.test(lower)) return month === 1 ? iso(year - 1, 12) : iso(year, month - 1);
  if (/\bnext month\b/.test(lower)) return month === 12 ? iso(year + 1, 1) : iso(year, month + 1);

  const named = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
  if (!named) return undefined;
  const explicitYear = lower.match(/\b(20\d{2})\b/)?.[1];
  return iso(explicitYear ? Number(explicitYear) : year, MONTHS[named[1]]);
}

/** Builds the request for a matched destination, applying the person/month rules. */
function toRequest(
  rule: DestinationRule,
  personName: string | undefined,
  lower: string,
  today: string,
): MicaNavigationRequest | null {
  // "open the profile" names no person, and /people/:id cannot be built without
  // one — so this stays a question rather than opening the directory and hoping.
  if (rule.destination === 'person') {
    return personName ? request('person', rule.path, rule.label, { personName, needsPerson: true }) : null;
  }

  // A named person turns the medications module into that person's MAR chart:
  // "show me the medication chart for Evan Turner" is about one chart, and the
  // chart page is where the month selector lives.
  if (rule.destination === 'emedication') {
    const month = resolveMonth(lower, today);
    if (personName) {
      return request('mar-chart', '/emedication', 'MAR chart', {
        personName,
        needsPerson: true,
        monthParam: 'month',
        ...(month ? { month } : {}),
      });
    }
    return request('emedication', rule.path, rule.label, {
      monthParam: 'month',
      ...(month ? { month } : {}),
    });
  }

  return request(rule.destination, rule.path, rule.label);
}

/**
 * A YYYY-MM month as a person would say it ("2026-03" → "March 2026").
 *
 * The caller resolves the id, so this is the last step before the route is
 * described to the user — and the description is both spoken and shown, which
 * is why it cannot be the raw ISO string.
 */
export function formatNavigationMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '')
  if (!match) return month
  const name = Object.keys(MONTHS).find(key => MONTHS[key] === Number(match[2]))
  if (!name) return month
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${match[1]}`
}

/**
 * Returns the navigation request, or null when the utterance is a question or a
 * statement and must keep its existing path (the question loop, or the care-note
 * and action flows).
 */
export function parseNavigationRequest(utterance: string, today: string): MicaNavigationRequest | null {
  const raw = (utterance || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const personName = extractPersonName(raw);

  // The possessive chart is a navigation request with no verb at all: "Evan
  // Turner's MAR chart for March" is a person, a chart and a month — nothing
  // else it could be.
  if (CHART_NOUN.test(lower) && personName && POSSESSIVE_NAME.test(raw)) {
    return toRequest(
      { destination: 'emedication', path: '/emedication', label: 'medication charts', pattern: CHART_NOUN },
      personName,
      lower,
      today,
    );
  }

  if (!NAVIGATION_VERB.test(lower)) return null;
  if (QUESTION_PREFIX.test(lower) && !STRONG_NAVIGATION_VERB.test(lower)) return null;
  // A bare "give me <module>" stays a question — the answer is spoken, and
  // /ai/mica/ask's tool loop is what produces it. Naming a chart is the
  // exception: "give me the MAR chart" is a page even when the transcription
  // never capitalised a name, and the chart page is where the month lives.
  if (GIVE_ME_ONLY.test(lower) && !personName && !CHART_NOUN.test(lower)) return null;

  const rule = DESTINATIONS.find(candidate => candidate.pattern.test(lower));
  if (!rule) return null;
  return toRequest(rule, personName, lower, today);
}
