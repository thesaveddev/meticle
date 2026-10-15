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
 * Where a destination has more than one view, the detail the carer said travels
 * with it: which week for the rota, which tab for a person's profile, and which
 * incident for the incidents page — that last one as the *subject* they called it
 * by, because an incident is named by its free-text title and matching that is a
 * database read, not a parse. The pages read the parameters they are given and
 * ignore the rest, which is the same bargain `/emedication` already makes with
 * `?personId=` and `?month=`.
 *
 * Pure by design: `today` is a parameter, so the month and week arithmetic is
 * testable without a clock or a frozen process timezone. The caller passes the
 * database's CURRENT_DATE, the same source `cleanDate` uses in `mica.tools.ts`.
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
   * The Monday of the week to open, YYYY-MM-DD, only ever for the `rota`
   * destination.
   *
   * Absent when the carer said nothing about a week, which is deliberate: the
   * planner's own default (this week) is what they get today, so a rota request
   * with no week in it keeps opening the week it always did.
   */
  week?: string;
  /**
   * A profile tab slug, only for the `person` destination.
   *
   * The slugs are `PersonProfilePage`'s own (`TAB_SLUGS` there), because that page
   * reads `?tab=` and a slug it does not know would open the profile on its first
   * tab instead of the one asked for. See `TAB_PHRASES`.
   */
  tab?: string;
  /**
   * The subject of one incident, as the carer referred to it — "the fire door
   * incident" is the subject `fire door`.
   *
   * The caller resolves it against the organisation's incident titles; the parser
   * cannot, and guessing an id would open a record nobody asked for.
   */
  incidentSubject?: string;
  /**
   * True when the destination is person-specific *and* a name was heard, so the
   * caller must resolve `personName` to an id (and append `/:id` for 'person').
   * Absent when no name was said, which is why "open the medications" still
   * navigates to the module rather than failing: the destination is useful
   * without a person, and inventing one would be worse than not resolving one.
   */
  needsPerson?: boolean;
  /**
   * True when the incident was named by its subject, so the caller must resolve it
   * to one record before a route can exist at all. Without it, an incident request
   * is the directory (`/incidents`), which is what it has always been.
   */
  needsIncident?: boolean;
  /** Query-parameter names the destination's page actually honours. */
  monthParam?: 'month';
  weekParam?: 'week';
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

/** Two digits, for the ISO days this module builds. */
const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Whole days added to an ISO day. Pure UTC arithmetic on the date, exactly as
 * `mica.facts.ts` shifts its days, so no local timezone can move the answer.
 */
function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * The Monday of the week an ISO day falls in.
 *
 * Weeks start on Monday here, because that is what the rota planner itself does
 * (`RotaPlannerPage` builds its default week from `getDay()` with Sunday counting
 * back six days). Getting that case wrong is the whole risk of this function: a
 * Sunday that snapped forward would open the week the carer is not looking at.
 */
function mondayOfIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysIso(iso, weekday === 0 ? -6 : 1 - weekday);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * The week a rota request is about, as that week's Monday, or undefined.
 *
 * The shapes are the ones a carer says: "this week", "next week", "last week", a
 * weekday, and a stated ISO date. A weekday means the *coming* one — said on a
 * Wednesday, "the rota for Monday" is the Monday five days away rather than the
 * one that has just gone — which is the reading that cannot send someone to a week
 * already behind them.
 *
 * Deliberately absent: "the week after next", "in three weeks", "the week of the
 * 4th". Those are arithmetic or resolution this module does not do, and the honest
 * answer is the planner's default week rather than a confident wrong one. ("the
 * week of the 4th" is the same refusal `mica.facts.ts` makes for windows it cannot
 * resolve.)
 */
function resolveNavigationWeek(lower: string, today: string): string | undefined {
  const monday = mondayOfIso(today);
  if (/\bnext week\b/.test(lower)) return addDaysIso(monday, 7);
  if (/\b(?:last|previous) week\b/.test(lower)) return addDaysIso(monday, -7);
  if (/\bthis week\b/.test(lower)) return monday;

  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return mondayOfIso(iso[1]);

  const named = lower.match(new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`));
  if (named) {
    const from = new Date(`${today}T00:00:00Z`).getUTCDay();
    const to = WEEKDAYS.indexOf(named[1]);
    return mondayOfIso(addDaysIso(today, (to - from + 7) % 7));
  }
  return undefined;
}

/**
 * The profile tabs a carer can name out loud, and the slug the page reads.
 *
 * Every slug is one of `TAB_SLUGS` in `PersonProfilePage.tsx` — the page's own
 * vocabulary rather than a second one invented here — and `mica.navigation.test.ts`
 * holds the two together, because a slug the page does not know opens the profile
 * on its first tab instead of the one asked for, silently and plausibly.
 *
 * The list is the tabs a person would say out loud. That is the only criterion:
 * "open Grace's nutrition" is a sentence a carer says, so it is here, while a tab
 * nobody can name is one no phrase should map to. Order matters where nouns
 * overlap — "care plans" before "care assessments" — and the patterns are
 * word-bounded so "care record" (a profile) never reads as "care plans".
 */
const TAB_PHRASES: ReadonlyArray<{ pattern: RegExp; slug: string; label: string }> = [
  { pattern: /\bhealth\b|\bobservations?\b/, slug: 'health', label: 'health tab' },
  { pattern: /\bcare plans?\b|\bsupport plans?\b/, slug: 'care-plans', label: 'care plans' },
  { pattern: /\b(?:daily|care|progress) notes?\b/, slug: 'daily-notes', label: 'daily notes' },
  { pattern: /\brisk assessments?\b/, slug: 'risk-assessments', label: 'risk assessments' },
  { pattern: /\bfamily contacts?\b|\bnext of kin\b/, slug: 'family-contacts', label: 'family contacts' },
  { pattern: /\bgoals?\b/, slug: 'goals', label: 'goals' },
  { pattern: /\bmemory book\b/, slug: 'memory-book', label: 'memory book' },
  { pattern: /\bbody map\b/, slug: 'body-map', label: 'body map' },
  { pattern: /\bdocuments?\b/, slug: 'documents', label: 'documents' },
  { pattern: /\bwell-?being\b/, slug: 'wellbeing', label: 'wellbeing' },
  { pattern: /\bnutrition\b|\bfood and fluid\b|\bfluid intake\b/, slug: 'nutrition', label: 'nutrition' },
  { pattern: /\bmood\b/, slug: 'mood-chart', label: 'mood chart' },
  { pattern: /\bcare assessments?\b/, slug: 'care-assessments', label: 'care assessments' },
  { pattern: /\broom checks?\b/, slug: 'room-checks', label: 'room checks' },
  { pattern: /\bcapacity\b/, slug: 'capacity', label: 'capacity' },
  { pattern: /\bclinical scores?\b/, slug: 'clinical-scores', label: 'clinical scores' },
  { pattern: /\bcommunication\b/, slug: 'communication', label: 'communication' },
  { pattern: /\btime away\b/, slug: 'time-away', label: 'time away' },
  { pattern: /\bcare pathways?\b/, slug: 'care-pathways', label: 'care pathways' },
  { pattern: /\baudit trail\b/, slug: 'audit-trail', label: 'audit trail' },
  { pattern: /\btimeline\b/, slug: 'timeline', label: 'timeline' },
];

/** The tab an utterance names, or undefined. Only meaningful with a named person. */
function resolveNavigationTab(lower: string): { slug: string; label: string } | undefined {
  return TAB_PHRASES.find(entry => entry.pattern.test(lower));
}

/**
 * The words a carer used to name one incident.
 *
 * An incident has no reference number in this product — its handle is its title
 * ("Fire door held open") — so the subject is whatever the carer put around the
 * noun: "the fire door incident", "the incident about the fire door". Everything
 * that is not the subject is stripped back off it, including the verbs and articles
 * that precede it ("open the fire door incident" → "fire door").
 *
 * A day or a scope word is not a subject. "Show me today's incidents" is the whole
 * list, and searching the titles for the word "today's" would answer it with a
 * miss — so those fall back to the directory, which is the page that question was
 * always about. Nothing here is fuzzy: a subject that is not in a title is reported
 * as no match rather than widened until something fits.
 */
const INCIDENT_SUBJECT_AFTER =
  /\b(?:incidents?|near miss(?:es)?)\s+(?:about|where|involving|with|regarding|to do with)\s+([a-z0-9][a-z0-9'\u2019\- ]{1,60})/;
const INCIDENT_SUBJECT_BEFORE = /\b([a-z0-9][a-z0-9'\u2019\- ]{1,60}?)\s+(?:incidents?|near miss(?:es)?)\b/;

/** Words that introduce or dress the noun rather than name the incident. */
const INCIDENT_SUBJECT_FILLER = new Set([
  'open', 'show', 'me', 'see', 'view', 'display', 'pull', 'bring', 'jump', 'take', 'up', 'to',
  'please', 'can', 'could', 'you', 'i', 'want', 'need', 'the', 'a', 'an', 'that', 'this', 'these',
  'those', 'my', 'our', 'for', 'of', 'about', 'on', 'in', 'at', 'detail', 'details',
  'incident', 'incidents', 'near', 'miss', 'misses',
]);

/** A day or a scope word means the list, not a search for that word. */
const NOT_AN_INCIDENT_SUBJECT = new Set([
  'today', "today's", 'tonight', 'yesterday', "yesterday's", 'tomorrow', "tomorrow's",
  'all', 'any', 'every', 'each', 'recent', 'latest', 'new', 'last', 'week', 'month',
]);

function extractIncidentSubject(lower: string): string | undefined {
  const candidate = lower.match(INCIDENT_SUBJECT_AFTER)?.[1] ?? lower.match(INCIDENT_SUBJECT_BEFORE)?.[1];
  if (!candidate) return undefined;

  const words = candidate.split(/\s+/).filter(Boolean);
  while (words.length && INCIDENT_SUBJECT_FILLER.has(words[0])) words.shift();
  while (words.length && INCIDENT_SUBJECT_FILLER.has(words[words.length - 1])) words.pop();

  const subject = words.join(' ').replace(/[^a-z0-9'\u2019]+$/, '').trim();
  if (!subject || NOT_AN_INCIDENT_SUBJECT.has(subject)) return undefined;
  return subject;
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

  // A named person plus a tab noun is *that person's* tab, and it is read before
  // the destination table because the name is what makes it one: "open Grace's
  // goals" is her goals, where "open the goals" is the organisation's. This is the
  // same upgrade the chart branch above makes when a name turns "medications" into
  // that person's MAR chart.
  if (personName) {
    const tab = resolveNavigationTab(lower);
    if (tab) {
      return request('person', '/people', tab.label, {
        personName,
        needsPerson: true,
        tab: tab.slug,
      });
    }
  }

  // One incident named by its subject is read *before* the destination table, because
  // the noun the carer used is "incident" and whatever else is in the sentence only
  // qualifies it: "the medication incident" is an incident about medication, and the
  // table would match "medication" first and open the medication charts instead. A
  // phrase with no subject is not read here at all, so "open the incidents" is still
  // the directory it has always been.
  const incidentSubject = extractIncidentSubject(lower);
  if (incidentSubject) {
    return request('incidents', '/incidents', 'incidents', { incidentSubject, needsIncident: true });
  }

  const rule = DESTINATIONS.find(candidate => candidate.pattern.test(lower));
  if (!rule) return null;
  const destination = toRequest(rule, personName, lower, today);
  if (!destination) return null;

  // The week a rota request is about, when the carer named one. A rota request that
  // named no week keeps the planner's own default, which is what it does today.
  if (destination.destination === 'rota') {
    const week = resolveNavigationWeek(lower, today);
    return week ? { ...destination, week, weekParam: 'week' } : destination;
  }

  return destination;
}
