/**
 * Mica's deterministic answers — the list questions that need no model.
 *
 * Why this exists. Navigation (`mica.navigation.ts`) made "take me to X" free and
 * instant, but the questions a carer asks far more often — "who is on shift
 * today", "give me today's appointments", "how is Nora's medication round
 * looking" — still went to `/ai/mica/ask`'s tool loop, which needs an OpenAI key,
 * the natural_language_assistant feature, budget headroom and a round trip. For
 * an organisation that has not configured a provider at all, those questions did
 * not degrade: they failed with "AI not configured", even though the answer was
 * four SQL rows and a sentence.
 *
 * The rule this module implements is the same one navigation follows: a question
 * whose answer is a bounded list of the organisation's own rows does not need a
 * model. "Who is on shift today" is a lookup. Asking a model to paraphrase four
 * names is slower, costs tokens, and can only introduce error.
 *
 * What it deliberately does *not* cover, and why the surface is this narrow:
 *
 *   - Anything needing judgement. "How urgent is the Risperidone reorder?"
 *     depends on the stock urgency bands the tool descriptions define, and
 *     "summarise this month's incidents" is a narrative. Those stay on the model
 *     path; the fact path answers *lists* and *counts*, never advice. A count is
 *     deliberately not a narrative: "how many incidents this month" is answered
 *     (the same total and severity breakdown the incidents stats endpoint shows,
 *     confidential rows excluded), while "summarise this month's incidents"
 *     stays the model's, because a summary is judgement.
 *   - Writes. "Book an appointment for the podiatry clinic" names an appointment
 *     and is a draft, not a list — `WRITE_VERB` sends it back to the action
 *     gateway untouched.
 *   - Any day the parser cannot resolve. "Who is on shift next Tuesday" and
 *     "appointments coming up" name windows this module has no arithmetic for,
 *     so they return null and the model answers them. A deterministic path that
 *     silently answered about *today* would be worse than no answer at all.
 *   - Facts about a person are never invented. When a name is heard it is
 *     resolved by the caller (one function, one query); a name that matches
 *     nobody or matches two people produces a spoken question instead of an
 *     answer about a stranger.
 *
 * Two of those answers also end by asking a question — "want me to open the rota
 * planner?" — because a list is the one shape a page answers better than a
 * sentence does: the carer's next word opens it, and the model is still nowhere
 * in the loop (`factPageFor`, `parseFactConfirmation`).
 *
 * Eight answers, in two batches. The first four are a day's rows: the rota, the
 * day's appointments, a medication round, who is on leave. The second four are the
 * questions this module used to hand to the model while they were the only ones it
 * could not read — whose training is expiring, how much leave a staff member has
 * left, who is supporting one person, and how many incidents the month has had.
 * They are the same shape of question (a bounded list, or a count, of the
 * organisation's own rows), which is the whole test for belonging here, and the
 * vocabulary is now held as a table rather than as scattered assertions:
 * `mica.facts.corpus.test.ts` is the corpus, and it fails both when a phrase stops
 * being read and when a model question starts being swallowed.
 *
 * Pure by design. `today` is a parameter and no database is imported: parsing,
 * day arithmetic and the spoken phrasing are all testable without a clock, a
 * connection or a frozen process timezone, exactly like `mica.navigation.ts`.
 * The caller executes the tool and hands the rows back.
 */

import { MICA_TIMEZONE } from './mica.spoken-time'
import type { MicaNavigationDestination } from './mica.navigation'

export type MicaFactKind =
  | 'rota'
  | 'appointments'
  | 'medication-round'
  | 'leave'
  | 'support'
  | 'training-expiry'
  | 'leave-balance'
  | 'incidents'

export interface MicaFactRequest {
  kind: MicaFactKind
  /** The read-only Mica tool that supplies the rows (`mica.tools.ts`). */
  tool:
    | 'get_staff_on_shift'
    | 'get_appointments'
    | 'get_medication_round'
    | 'get_staff_on_leave'
    | 'who_supports_person'
    | 'get_training_expiring'
    | 'get_leave_balance'
    | 'get_incidents_in_month'
  /** The day asked about, YYYY-MM-DD. Defaults to today when none was said. */
  date: string
  /** The caller's today, YYYY-MM-DD — the reference a bare day is spoken against. */
  today: string
  /** How that day is spoken: 'today', 'tomorrow', 'yesterday', 'on 3 November'. */
  dayLabel: string
  /** True when the utterance named the day, false when it defaulted to today. */
  dayNamed: boolean
  /** The person named in the utterance, if one was — resolved by the caller. */
  personName?: string
  /**
   * The staff member named in the utterance, if one was, for the two answers
   * that are scoped to a member of staff rather than to a resident. Kept apart
   * from `personName` because the two resolve against different tables and a name
   * that matches a resident must not be read as a colleague's leave balance.
   */
  staffName?: string
  /** How far ahead the training-expiry answer looks, in days. */
  windowDays?: number
  /** The calendar month (YYYY-MM) a month-scoped answer covers. */
  month?: string
  /** Arguments for the tool; a resolved name is added once the caller has one. */
  args: Record<string, unknown>
}

/** One row of a tool result, as node-postgres hands it back. */
type Row = Record<string, unknown>

/** How many entries Mica says before it summarises the rest. Spoken, so short. */
const ROTA_LIMIT = 5
const APPOINTMENT_LIMIT = 4
const SUPPORT_LIMIT = 4
const TRAINING_LIMIT = 4
const MEDICATION_LIMIT = 3
const STOCK_LIMIT = 3

const SHIFT_TYPE_LABEL: Record<string, string> = {
  day: 'day shift',
  sleep: 'sleep-in',
  wake_night: 'waking night',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad = (value: number): string => String(value).padStart(2, '0')

/** Shifts `today` (YYYY-MM-DD) by whole days. Pure UTC arithmetic on the date. */
function shiftDay(today: string, days: number): string {
  const [year, month, day] = today.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/**
 * An ISO day as a person would say it: "3 November", with the year only when it
 * is not the current one — "until 12 October" is what a carer hears, "until 12
 * October 2027" is only worth saying when it is a different year.
 */
export function formatSpokenDay(iso: unknown, today: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!match) return String(iso ?? '')
  const [, year, month, day] = match
  const name = MONTH_NAMES[Number(month) - 1] || month
  const spoken = `${Number(day)} ${name}`
  return year === today.slice(0, 4) ? spoken : `${spoken} ${year}`
}

/** An instant as a spoken UK wall-clock time: "8am", "8:30am". */
export function formatSpokenTime(value: unknown, timezone: string = MICA_TIMEZONE): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const instant = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(instant.getTime())) return undefined
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant)
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value)
  // `hour12: false` renders midnight as 24 in some ICU builds.
  const hour = read('hour') % 24
  const minute = read('minute')
  const suffix = hour < 12 ? 'am' : 'pm'
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${twelveHour}${suffix}` : `${twelveHour}:${pad(minute)}${suffix}`
}

/**
 * The day an utterance names, or null when it names one this module cannot
 * resolve. The distinction is the whole safety valve: null means "hand this to
 * the model", not "assume today" — and `named: false` is the case where no day
 * was said at all, which is today by every tool's own default.
 */
function resolveDay(lower: string, today: string): { date: string; dayLabel: string; named: boolean } | null {
  // A window with arithmetic this module does not do. Answering about today
  // would be a confident wrong answer, which is the failure mode to avoid.
  if (/\b(next|last|previous|following|coming|this)\s+(week|month|weekend)\b/.test(lower)) return null
  if (/\b(upcoming|coming up|later today|this time tomorrow)\b/.test(lower)) return null
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) return null
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(lower)) return null
  // A window with arithmetic this module does not do, in every shape it is said:
  // "within 7 days", "in the next 90 days", "3 weeks from now". Only a bare day,
  // yesterday, tomorrow and a stated ISO day are resolved, and answering a window
  // with today's rows is exactly the confident wrong answer these refusals exist
  // to prevent — the model, which can pass a window to the tool, is where it goes.
  if (/\b(?:next|within|in|over|after|past)\s+\d+\s*(?:day|days|week|weeks|month|months)\b/.test(lower)) return null
  if (/\b\d+\s*(?:day|days|week|weeks|month|months)\s+(?:ahead|from now|out)\b/.test(lower)) return null

  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return { date: iso[1], dayLabel: `on ${formatSpokenDay(iso[1], today)}`, named: true }

  if (/\btoday\b|\btonight\b|\bthis (morning|afternoon|evening)\b/.test(lower)) {
    return { date: today, dayLabel: 'today', named: true }
  }
  if (/\btomorrow\b/.test(lower)) {
    const date = shiftDay(today, 1)
    return { date, dayLabel: 'tomorrow', named: true }
  }
  if (/\byesterday\b/.test(lower)) {
    const date = shiftDay(today, -1)
    return { date, dayLabel: 'yesterday', named: true }
  }
  // No day said at all: "who is on shift?" means today, and every tool here
  // defaults to today too, so this is the same day the answer names aloud.
  return { date: today, dayLabel: 'today', named: false }
}

/**
 * The calendar month a month-scoped question is about, or null when it is not one
 * this module can name.
 *
 * The incidents count is the one answer whose window is a month rather than a day,
 * so it is the one place with month arithmetic — and it is deliberately as narrow
 * as the day arithmetic: "this month" and "last month" are the windows a carer
 * says when they mean a count they can act on, and a named month
 * ("how many in September") is left to the model, exactly like a named day the day
 * resolver cannot place. January is the case worth stating: last month of January
 * is December of the *previous* year, not December of this one.
 */
function resolveFactMonth(lower: string, today: string): { month: string; monthLabel: string } | null {
  const [year, month] = today.split('-').map(Number)
  const iso = (y: number, m: number) => `${y}-${pad(m)}`

  if (/\bthis month\b|\bmonth to date\b|\bso far this month\b|\bthis month's\b/.test(lower)) {
    return { month: iso(year, month), monthLabel: 'this month' }
  }
  if (/\blast month\b|\bprevious month\b/.test(lower)) {
    return { month: month === 1 ? iso(year - 1, 12) : iso(year, month - 1), monthLabel: 'last month' }
  }
  return null
}

/**
 * Words a name-shaped match must not be read as. "Who's on shift" contains a
 * possessive, and "today's appointments" contains a proper-looking noun; reading
 * either as a person would scope a question to someone who does not exist.
 */
const NOT_A_NAME = new Set([
  'who', 'what', 'when', 'where', 'why', 'how', 'here', 'there', 'it', 'she', 'he', 'they', 'we', 'you',
  'today', 'tonight', 'tomorrow', 'yesterday', 'this', 'that', 'the', 'my', 'our', 'their', 'any', 'all',
  'everyone', 'everybody', 'nobody', 'someone', 'anybody', 'staff', 'medication', 'medications', 'meds',
  'appointment', 'appointments', 'round', 'leave', 'shift', 'shifts', 'chart',
])

/** "Nora Whitfield's" — capitalised words, so a name is only read from real text. */
const POSSESSIVE_NAME = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/g

/** "for Nora Whitfield" / "about Nora Whitfield". */
const PHRASE_NAME = /\b(?:for|about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g

/**
 * "does Priya Sharma have left" / "has Jane Doyle got left" — the staff-scoped
 * shape, where the name is the subject of the sentence rather than a possessive
 * or an object.
 *
 * Only a verb that introduces a subject is listed, so "is on shift" (lower-case
 * "on") and "is expiring" never read as names.
 */
const SUBJECT_NAME = /\b(?:does|did|has|have|is|are|was|were)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g

/**
 * "supporting Grace Roberts" / "caring for Ade Okafor" — the name the supporting
 * question puts after its verb.
 *
 * The three patterns above miss this shape entirely (there is no possessive and no
 * "for"), and without this one the platform's own example phrase — "who is
 * supporting Grace Roberts today" — would name nobody and fall to the model.
 */
const SUPPORT_NAME = /\b(?:supporting|supports|support|caring for|working with|looking after)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g

/**
 * The person named in the utterance, if one was.
 *
 * Every candidate is considered, not just the first: "what's left on Nora's med
 * round" opens with a possessive that is not a name, and stopping there would
 * lose the name that is. A possessive also outranks "for …", because "Grace
 * Roberts's round for today" has a name and a day and only the name is a person.
 */
function extractPersonName(raw: string): string | undefined {
  for (const pattern of [POSSESSIVE_NAME, PHRASE_NAME, SUBJECT_NAME, SUPPORT_NAME]) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(raw)) !== null) {
      if (!NOT_A_NAME.has(match[1].toLowerCase())) return match[1]
    }
  }
  return undefined
}

/** A write belongs to the action gateway, never to a list answer. */
const WRITE_VERB = /\b(book|re-?book|arrange|schedule|create|add|record|log|move|reschedule|cancel|delete|assign|approve|reject)\b/

/** The "who … on shift" shape — the topic alone is not enough. */
const ROTA = {
  topic: /\bon shift\b|\bon duty\b|\bon the rota\b|\bworking today\b/,
  who: /\bwho(?:'s| is| are| was| were)?\b|\banyone\b|\bany staff\b|\bstaff\b|\bany carers?\b/,
}

const ON_LEAVE = /\bon leave\b|\boff on leave\b/

/**
 * "who is supporting Grace Roberts" — one person's carers for a day.
 *
 * The topic needs both halves: the supporting verb (or the phrase a carer uses
 * instead of it: "caring for", "working with", "looking after") and a named
 * person. "Who is supporting today" names nobody, and the tool takes a name — so
 * it stays a model question rather than a rota read under a misleading title.
 */
const SUPPORT_TOPIC = /\bsupport(?:s|ing|ed)?\b|\bcaring for\b|\bworking with\b|\blooking after\b/
const SUPPORT_WHO = /\bwho(?:'s| is| are| was| were)?\b|\bwhich staff\b|\bany staff\b/

/**
 * "whose training is expiring" — an expiry verb is what makes it that question.
 *
 * Without one it is a different question entirely: "how is our training looking"
 * is a compliance percentage and stays the model's, and "book training for Jane"
 * is a write.
 */
const TRAINING_TOPIC = /\btraining\b/
const TRAINING_EXPIRY =
  /\bexpir(?:e|es|ed|ing|y)\b|\blaps(?:e|es|ed)\b|\bruns? out\b|\brunning out\b|\bout of date\b|\boverdue\b/
/** The ask, not the topic: "how are our training figures" names no expiry. */
const TRAINING_ASK =
  /\bwhose\b|\bwho\b|\bwhich\b|\bany\b|\bhow many\b|\blist\b|\bshow\b|\bis\b|\bare\b|\bdoes\b|\bhas\b|\bhave\b/

/** The window a training-expiry answer covers — the tool's own default. */
export const TRAINING_WINDOW_DAYS = 30

/** "how much leave does Priya have left" — a staff member's own balance. */
const LEAVE_BALANCE_TOPIC = /\b(?:leave|holiday|annual leave)\b/
const LEAVE_BALANCE_ASK = /\bhow much\b|\bhow many (?:days|hours)\b|\bleft\b|\bremaining\b|\bbalance\b/

/** "how many incidents this month" — a count, not a narrative. */
const INCIDENT_TOPIC = /\bincidents?\b/
const INCIDENT_COUNT_ASK = /\bhow many\b|\bhow much\b|\bcount of\b|\bnumber of\b|\btotal\b/

const APPOINTMENT_TOPIC = /\b(appointments?|diary)\b/
/** The plural is the list shape: "Ade Okafor's appointments" needs no verb. */
const APPOINTMENT_PLURAL = /\bappointments\b/
const APPOINTMENT_ASK = /\b(any|all|do we have|have we got|are there|is there|what|which|list|show|give|tell)\b/

/**
 * Is this a question about the appointment list, or a statement about one
 * appointment? "Ade Okafor's appointments today" asks for a list; "Ade Okafor's
 * appointment is tomorrow" is a statement to be recorded, so it needs the plural
 * or an outright ask.
 */
function asksAboutAppointments(lower: string, personName: string | undefined): boolean {
  if (!APPOINTMENT_TOPIC.test(lower)) return false
  if (APPOINTMENT_ASK.test(lower)) return true
  return APPOINTMENT_PLURAL.test(lower) && Boolean(personName)
}

const MEDICATION_ROUND = /\b(?:medication|medications|med|meds|mar)\s+round\b/

/**
 * The fact this question is, or null to leave it on the question path.
 *
 * Order matters only where two topics could match one sentence ("who is on shift
 * and what appointments do we have"); the first match wins, which is the reading
 * a carer would accept either way.
 */
export function parseFactQuestion(utterance: string, today: string): MicaFactRequest | null {
  const raw = (utterance || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  // A write is a write whichever window it names, so this is checked before the
  // windows are read at all: "log an incident this month" must not reach the count.
  if (WRITE_VERB.test(lower)) return null

  // The month-scoped count is read *before* the day gate. "this month" is a window
  // the day arithmetic deliberately refuses, so leaving this below the gate would
  // send the one question whose window is a month down the model path for the
  // wrong reason — the gate refusing a window it was never meant to resolve.
  if (INCIDENT_TOPIC.test(lower) && INCIDENT_COUNT_ASK.test(lower)) {
    const month = resolveFactMonth(lower, today)
    if (month) {
      return {
        kind: 'incidents',
        tool: 'get_incidents_in_month',
        date: today,
        today,
        dayLabel: month.monthLabel,
        dayNamed: true,
        month: month.month,
        args: { month: month.month },
      }
    }
  }

  const day = resolveDay(lower, today)
  if (!day) return null
  const personName = extractPersonName(raw)
  const base = {
    date: day.date,
    today,
    dayLabel: day.dayLabel,
    dayNamed: day.named,
    args: { date: day.date } as Record<string, unknown>,
  }

  if (MEDICATION_ROUND.test(lower)) {
    return { kind: 'medication-round', tool: 'get_medication_round', ...base, ...(personName ? { personName } : {}) }
  }

  if (asksAboutAppointments(lower, personName)) {
    return { kind: 'appointments', tool: 'get_appointments', ...base, ...(personName ? { personName } : {}) }
  }

  // A named person is what makes this question askable at all: the tool takes a
  // name, and "who is supporting today" has no single answer to give.
  if (SUPPORT_TOPIC.test(lower) && SUPPORT_WHO.test(lower) && personName) {
    return {
      kind: 'support',
      tool: 'who_supports_person',
      ...base,
      personName,
      args: { date: day.date, person_name: personName },
    }
  }

  if (TRAINING_TOPIC.test(lower) && TRAINING_EXPIRY.test(lower) && TRAINING_ASK.test(lower)) {
    return {
      kind: 'training-expiry',
      tool: 'get_training_expiring',
      ...base,
      windowDays: TRAINING_WINDOW_DAYS,
      args: { days: TRAINING_WINDOW_DAYS },
      ...(personName ? { personName, staffName: personName, args: { days: TRAINING_WINDOW_DAYS, staff_name: personName } } : {}),
    }
  }

  // The balance is a staff member's, so a name is required: "how much leave is
  // left" names nobody and would have to be answered for the whole organisation.
  if (LEAVE_BALANCE_TOPIC.test(lower) && LEAVE_BALANCE_ASK.test(lower) && personName) {
    // Any year but the current one is a window this answer cannot cover. The tool
    // takes a year, but nothing here parses "last year" into one — reading this
    // year's balance out against that question would be a wrong number with a
    // person's name on it.
    if (/\b(?:last|next|previous)\s+year\b|\b(?:19|20)\d{2}\b/.test(lower)) return null;
    return {
      kind: 'leave-balance',
      tool: 'get_leave_balance',
      ...base,
      personName,
      staffName: personName,
      args: { staff_name: personName },
    }
  }

  if (ON_LEAVE.test(lower) && ROTA.who.test(lower)) {
    return { kind: 'leave', tool: 'get_staff_on_leave', ...base }
  }

  if (ROTA.topic.test(lower) && ROTA.who.test(lower)) {
    return { kind: 'rota', tool: 'get_staff_on_shift', ...base }
  }

  return null
}

/**
 * The words that confirm the page Mica just offered, and nothing else.
 *
 * Matched against the whole utterance (after punctuation, and after a trailing
 * "please"/"thanks"), which is the same safety property the stop phrases use: "yes,
 * but what about tomorrow" is a new question, and a carer who says it must not be
 * pulled onto the rota mid-sentence. "no" is deliberately absent — declining is not
 * a confirmation, and an offer simply lapses when the conversation moves on.
 */
const AFFIRMATIVE = new Set([
  'yes', 'yeah', 'yep', 'yup', 'aye',
  'ok', 'okay', 'sure', 'alright', 'all right',
  'go on', 'go ahead', 'go for it', 'please do', 'do it', 'open it', 'show me',
  'sounds good', 'great',
])

/**
 * Is this the answer to Mica's own question? The caller may only act on `true`
 * when it knows a page was offered: a bare "yes" with nothing pending is not a
 * navigation, it is an utterance for the paths that already handle it.
 */
export function parseFactConfirmation(utterance: string): boolean {
  const normalised = (utterance || '')
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalised) return false
  return AFFIRMATIVE.has(normalised.replace(/\s+(?:please|thanks|thank you)$/, ''))
}

/** "none overdue" / "1 overdue" / "3 overdue" — a count as a person says it. */
const countPhrase = (count: number, word: string): string => (count === 0 ? `none ${word}` : `${count} ${word}`)

const rowText = (value: unknown): string => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value))

/**
 * A stock unit as it is said: "tablet(s)" is a database convention, and a
 * carer hears "2 tablets" / "1 tablet".
 */
function spokenUnit(unit: string, quantity: unknown): string {
  const singular = Number(quantity) === 1
  return unit.replace(/\(s\)/i, singular ? '' : 's').trim()
}

/** `8am to 8pm`, or nothing when the row carries no times. */
function shiftWindow(row: Row): string | undefined {
  const start = formatSpokenTime(row.start_time)
  const end = formatSpokenTime(row.end_time)
  if (!start || !end) return undefined
  return `${start} to ${end}`
}

function formatRota(rows: Row[], dayLabel: string): string {
  const shifts = rows.filter((row) => rowText(row.staff_name))
  if (!shifts.length) return `Nobody is assigned to a shift ${dayLabel}.`

  const spoken = shifts.slice(0, ROTA_LIMIT).map((row) => {
    const details = [
      SHIFT_TYPE_LABEL[rowText(row.shift_type)] || rowText(row.shift_type) || 'shift',
      rowText(row.location_name) || undefined,
      shiftWindow(row),
    ].filter(Boolean).join(', ')
    return `${rowText(row.staff_name)} (${details})`
  })
  const remaining = shifts.length - spoken.length
  const lead = shifts.length === 1
    ? `One staff member is on shift ${dayLabel}`
    : `${shifts.length} staff are on shift ${dayLabel}`
  return `${lead}: ${spoken.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`
}

function formatAppointments(rows: Row[], dayLabel: string, personName?: string): string {
  const appointments = rows.filter((row) => rowText(row.title))
  if (!appointments.length) {
    return personName ? `${personName} has no appointments ${dayLabel}.` : `There are no appointments ${dayLabel}.`
  }

  const spoken = appointments.slice(0, APPOINTMENT_LIMIT).map((row) => {
    const time = formatSpokenTime(row.start_time)
    // A person-scoped answer has already said whose list this is, so the name is
    // only repeated when the list is the whole home's.
    const person = !personName && rowText(row.person_name) ? ` for ${rowText(row.person_name)}` : ''
    return `${time ? `${time} ` : ''}${rowText(row.title)}${person}`
  })
  const remaining = appointments.length - spoken.length
  const list = `${spoken.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}`
  if (personName) {
    const lead = appointments.length === 1 ? 'has one appointment' : `has ${appointments.length} appointments`
    return `${personName} ${lead} ${dayLabel}: ${list}.`
  }
  const lead = appointments.length === 1 ? `There is one appointment ${dayLabel}` : `There are ${appointments.length} appointments ${dayLabel}`
  return `${lead}: ${list}.`
}

function formatMedicationRound(rows: Row[], dayLabel: string, personName?: string): string {
  const summary = rows.find((row) => 'total_scheduled' in row)
  const overdue = rows.filter((row) => 'medication' in row)
  const stock = rows.filter((row) => 'medication_name' in row)

  const total = Number(summary?.total_scheduled ?? 0)
  if (!total) {
    return personName
      ? `${personName} has no doses scheduled ${dayLabel}.`
      : `No doses are scheduled ${dayLabel}.`
  }

  const scope = personName ? `${personName}'s medication round ${dayLabel}` : `Across the home, ${total} doses are scheduled ${dayLabel}`
  const counts = [
    `${Number(summary?.given ?? 0)} given`,
    `${Number(summary?.still_due ?? 0)} still due`,
    countPhrase(Number(summary?.overdue ?? 0), 'overdue'),
    ...(Number(summary?.not_given_other ?? 0) > 0 ? [`${Number(summary?.not_given_other)} not given`] : []),
  ].join(', ')

  const parts = [`${scope}: ${counts}.`]

  if (overdue.length) {
    const names = overdue.slice(0, MEDICATION_LIMIT).map((row) => {
      const dose = [rowText(row.medication), rowText(row.dosage), rowText(row.unit)].filter(Boolean).join(' ')
      const due = formatSpokenTime(row.scheduled_time)
      const person = personName ? '' : `${rowText(row.person_name) || 'Someone'}'s `
      return `${person}${dose}${due ? ` was due at ${due}` : ''}`
    })
    const remaining = overdue.length - names.length
    parts.push(`Overdue: ${names.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`)
  }

  if (stock.length) {
    const warnings = stock.slice(0, STOCK_LIMIT).map((row) => {
      const name = rowText(row.medication_name) || 'a medication'
      if (row.out_of_stock) return `${name} is out of stock`
      const left = `${rowText(row.quantity)} ${spokenUnit(rowText(row.quantity_unit) || 'left', row.quantity)}`.trim()
      const days = Number(row.days_until_empty)
      const runOut = Number.isFinite(days) && days > 0 ? `, roughly ${Math.ceil(days)} days left` : ''
      const expires = row.expired_first ? ' (expires before it runs out)' : ''
      return `${name} has ${left}${runOut}${expires}`
    })
    const remaining = stock.length - warnings.length
    parts.push(`Stock to watch: ${warnings.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`)
  }

  return parts.join(' ')
}

function formatLeave(rows: Row[], dayLabel: string, today: string): string {
  const onLeave = rows.filter((row) => rowText(row.staff_name))
  if (!onLeave.length) return `Nobody is on approved leave ${dayLabel}.`

  const spoken = onLeave.slice(0, ROTA_LIMIT).map((row) => {
    const type = rowText(row.leave_type)
    const until = rowText(row.end_date) ? `until ${formatSpokenDay(row.end_date, today)}` : ''
    return `${rowText(row.staff_name)} (${[type, until].filter(Boolean).join(', ')})`
  })
  const remaining = onLeave.length - spoken.length
  const lead = onLeave.length === 1
    ? `One staff member is on approved leave ${dayLabel}`
    : `${onLeave.length} staff are on approved leave ${dayLabel}`
  return `${lead}: ${spoken.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`
}

/**
 * A list of counts as a person says it: "1 critical, 2 high and 3 medium".
 *
 * Zero counts are dropped — "0 critical" is noise in a spoken sentence, and the
 * sentence's job is to say what happened, not to read a table column out loud.
 */
function spokenCounts(pairs: Array<[string, number]>): string {
  const said = pairs.filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`)
  if (!said.length) return 'none'
  if (said.length === 1) return said[0]
  return `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}`
}

/** "1 day" / "3 days" — the agreement a spoken sentence cannot get wrong. */
const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many)

/**
 * Who is supporting one person on the day, across the rota and domiciliary visits.
 *
 * The rows come from `who_supports_person`, which returns shifts and visits in one
 * list, so the sentence has to read both shapes: a shift carries a shift type, a
 * location and a window, a visit carries its own label and scheduled window. A
 * visit with nobody assigned is said rather than hidden, because "Grace has two
 * visits and no carer" is the answer a manager needs; silently listing the one
 * assigned carer would not be.
 */
function formatSupport(rows: Row[], dayLabel: string, personName: string): string {
  const assigned = rows.filter((row) => rowText(row.staff_name))
  const unassigned = rows.length - assigned.length

  if (!assigned.length) {
    if (unassigned) {
      return `${personName} has ${unassigned} ${plural(unassigned, 'visit', 'visits')} ${dayLabel}, with nobody assigned yet.`
    }
    return `Nobody is assigned to support ${personName} ${dayLabel}.`
  }

  const spoken = assigned.slice(0, SUPPORT_LIMIT).map((row) => {
    const isVisit = rowText(row.source) === 'visit'
    const what = isVisit
      ? rowText(row.label) || `${rowText(row.visit_type)} visit`
      : SHIFT_TYPE_LABEL[rowText(row.shift_type)] || rowText(row.shift_type) || 'shift'
    const window = isVisit
      ? [formatSpokenTime(row.scheduled_start), formatSpokenTime(row.scheduled_end)].filter(Boolean).join(' to ') || undefined
      : shiftWindow(row)
    const details = [what, rowText(row.location_name) || undefined, window].filter(Boolean).join(', ')
    return `${rowText(row.staff_name)} (${details})`
  })

  const remaining = assigned.length - spoken.length
  const lead = assigned.length === 1
    ? `One person is supporting ${personName} ${dayLabel}`
    : `${assigned.length} people are supporting ${personName} ${dayLabel}`
  const note = unassigned
    ? ` ${unassigned} ${plural(unassigned, 'visit has', 'visits have')} nobody assigned yet.`
    : ''
  return `${lead}: ${spoken.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.${note}`
}

/**
 * Whose training is expiring, and how long is left on it.
 *
 * Two counts the same list can hold at once: records that have already expired
 * (the appointment has passed and the module is out of date) and records expiring
 * inside the window. Both are spoken with a date, and the phrasing of the date
 * itself says which is which — "expired on 1 October" versus "expires 3
 * November" — rather than leaving the carer to compare dates in their head.
 */
function formatTrainingExpiry(rows: Row[], today: string, windowDays: number, staffName?: string): string {
  const records = rows.filter((row) => rowText(row.module))
  if (!records.length) {
    return staffName
      ? `${staffName} has no training expiring in the next ${windowDays} days.`
      : `No staff training is expiring in the next ${windowDays} days.`
  }

  const spoken = records.slice(0, TRAINING_LIMIT).map((row) => {
    const expiry = rowText(row.expires_at)
    const when = expiry < today ? `expired on ${formatSpokenDay(expiry, today)}` : `expires ${formatSpokenDay(expiry, today)}`
    const owner = staffName ? '' : `${rowText(row.staff_name)} — `
    return `${owner}${rowText(row.module)}, ${when}`
  })
  const remaining = records.length - spoken.length
  const lead = staffName
    ? `${staffName} has ${records.length} ${plural(records.length, 'training record', 'training records')} expiring soon`
    : `${records.length} ${plural(records.length, 'training record is', 'training records are')} expiring soon`
  return `${lead}: ${spoken.join('; ')}${remaining > 0 ? `, and ${remaining} more` : ''}.`
}

/**
 * A remaining leave figure as the platform writes it elsewhere: "3 days + 6
 * hours", never a decimal — the balance cards aggregate the same way, and a
 * spoken "3.5 days" is a number the carer has to convert back into hours.
 *
 * Over-taken leave is said as "over" rather than as a negative number, and a type
 * with nothing left is "none left" rather than "0 days".
 */
function remainingPhrase(days: number, hours: number): string {
  const parts: string[] = []
  if (days > 0) parts.push(`${days} ${plural(days, 'day', 'days')}`)
  else if (days < 0) parts.push(`${Math.abs(days)} ${plural(Math.abs(days), 'day', 'days')} over`)
  if (hours > 0) parts.push(`${hours} ${plural(hours, 'hour', 'hours')}`)
  else if (hours < 0) parts.push(`${Math.abs(hours)} ${plural(Math.abs(hours), 'hour', 'hours')} over`)
  return parts.join(' + ') || 'none left'
}

/**
 * How much leave a staff member has left this year.
 *
 * The total comes first, because that is the question asked, and the per-type
 * breakdown follows only when there is more than one type to break down — a single
 * "Annual Leave 12 days + 6 hours" after "has 12 days + 6 hours of leave left" is
 * the same sentence twice. A leave type that was never allocated is dropped: an
 * untouched 'Unpaid' type is not a balance the carer needs read out.
 */
function formatLeaveBalance(rows: Row[], year: number, staffName?: string): string {
  const balances = rows.filter((row) => rowText(row.leave_type))
  const owner = staffName || rowText(balances[0]?.staff_name) || 'They'
  const allocated = balances.filter((row) => Number(row.days_allocated) > 0 || Number(row.hours_allocated) > 0)
  if (!allocated.length) return `${owner} has no leave allowance set up for ${year}.`

  const totalDays = allocated.reduce((sum, row) => sum + Number(row.days_remaining || 0), 0)
  const totalHours = allocated.reduce((sum, row) => sum + Number(row.hours_remaining || 0), 0)
  // Three readings of the same total, and each has to be a sentence a person would
  // say: "has none left of leave left" and "has 2 days over of leave left" are what
  // a single template produces, and neither is English.
  const overDays = totalDays < 0 ? -totalDays : 0
  const overHours = totalHours < 0 ? -totalHours : 0
  const head = overDays || overHours
    // Negated because it is `remainingPhrase` that owns the word "over": passing
    // the shortfall as a positive number would read it out as "2 days", which is
    // the one thing an over-taken balance must not sound like.
    ? `${owner} is ${remainingPhrase(-overDays, -overHours)} their ${year} allowance`
    : totalDays || totalHours
      ? `${owner} has ${remainingPhrase(totalDays, totalHours)} of leave left in ${year}`
      : `${owner} has no leave left in ${year}`
  if (allocated.length === 1) return `${head}.`

  const lines = allocated.map((row) => `${rowText(row.leave_type)} ${remainingPhrase(Number(row.days_remaining || 0), Number(row.hours_remaining || 0))}`)
  return `${head}: ${lines.join('; ')}.`
}

/**
 * How many incidents the month has had.
 *
 * A count, and only a count. The rows the tool returns are the summary row alone —
 * no titles, no names, and confidential incidents excluded the same way the
 * incidents stats endpoint excludes them — so this answer cannot become a second
 * door onto a confidential record, and it stays a sentence a carer can hear
 * without the carer having to be an ORG_ADMIN.
 */
function formatIncidentCount(rows: Row[], monthLabel: string): string {
  const summary = rows[0] || {}
  const total = Number(summary.total ?? 0)
  if (!total) return `There have been no incidents ${monthLabel}.`

  const severities = spokenCounts([
    ['critical', Number(summary.critical ?? 0)],
    ['high', Number(summary.high ?? 0)],
    ['medium', Number(summary.medium ?? 0)],
    ['low', Number(summary.low ?? 0)],
  ])
  const nearMisses = Number(summary.near_misses ?? 0)
  const open = Number(summary.open ?? 0)

  return [
    `There have been ${total} ${plural(total, 'incident', 'incidents')} ${monthLabel}: ${severities}.`,
    nearMisses
      ? `${nearMisses} ${plural(nearMisses, 'was', 'were')} ${plural(nearMisses, 'a near miss', 'near misses')}.`
      : 'None were near misses.',
    open ? `${open} ${plural(open, 'is', 'are')} still open.` : 'All of them are closed.',
  ].join(' ')
}

/**
 * A tool's own sentence, when it returned one instead of rows.
 *
 * A tool that could not resolve a name returns a single `{ result: "…" }` row by
 * design (`mica.tools.ts`), and that message is already written for a person to
 * hear, so it is passed straight through rather than being re-phrased. One
 * predicate, two callers: the sentence and the page offer have to agree about
 * whether a list was actually read.
 */
function toolMessage(list: Row[]): string | undefined {
  if (list.length === 1 && typeof list[0]?.result === 'string' && Object.keys(list[0]).length === 1) {
    return list[0].result as string
  }
  return undefined
}

/**
 * The rows a tool returned, as the sentence Mica speaks.
 */
export function formatFactAnswer(request: MicaFactRequest, rows: unknown[]): string {
  const list = (rows || []) as Row[]
  const message = toolMessage(list)
  if (message) return message

  switch (request.kind) {
    case 'rota':
      return formatRota(list, request.dayLabel)
    case 'appointments':
      return formatAppointments(list, request.dayLabel, request.personName)
    case 'medication-round':
      return formatMedicationRound(list, request.dayLabel, request.personName)
    case 'leave':
      return formatLeave(list, request.dayLabel, request.today)
    case 'support':
      return formatSupport(list, request.dayLabel, request.personName || 'They')
    case 'training-expiry':
      return formatTrainingExpiry(list, request.today, request.windowDays ?? TRAINING_WINDOW_DAYS, request.staffName)
    case 'leave-balance':
      return formatLeaveBalance(list, Number(request.today.slice(0, 4)), request.staffName)
    case 'incidents':
      return formatIncidentCount(list, request.dayLabel)
  }
}

/**
 * The page behind a list answer, when Mica can offer to open it.
 *
 * A list answer is the one shape a page beats: "who is on shift today" is
 * answered by a count and five names, and the rota itself is a 7×24 grid. So the
 * answer to the two questions that have a page behind them ends by asking whether
 * to open it — and the destination was already known when the list was read, so
 * the carer's next word needs no parse of its own.
 */
export interface MicaFactPage {
  /** The router's own destination union: the same value navigation sends. */
  destination: MicaNavigationDestination
  /** Route to push once the offer is confirmed. Never contains an id. */
  path: string
  /** What opening it is called aloud: "Opening the rota planner." */
  label: string
  /** The question the spoken answer ends with. */
  offer: string
}

/**
 * Which list answers offer their page, and which deliberately do not.
 *
 * Two, not eight. The rota and the appointments list are places a carer works in
 * — the sentence is a summary of what is on them. A medication round and who is
 * on leave are answered by the sentence itself, and the chart behind a round is
 * reached by naming it ("open Nora's MAR chart"), so offering those would be
 * asking a question the carer did not need. The same rule answers the four newer
 * kinds: "whose training is expiring" and "who is supporting Grace" are lists of
 * a handful of names and dates (the training matrix and the person's day are not
 * where that answer is read), and a count of incidents offers nothing at all.
 *
 * The paths are the ones `mica.navigation.ts` sends for "open the rota" and "open
 * the appointments", and `mica.facts.test.ts` holds the two tables together so
 * the two ways into a page cannot drift apart.
 */
const FACT_PAGES: Partial<Record<MicaFactKind, MicaFactPage>> = {
  rota: {
    destination: 'rota',
    path: '/scheduling',
    label: 'the rota planner',
    offer: 'Want me to open the rota planner?',
  },
  appointments: {
    destination: 'appointments',
    path: '/appointments',
    label: 'the appointments list',
    offer: 'Want me to open the appointments list?',
  },
}

/** The page behind a list answer, or undefined when the sentence is the answer. */
export function factPageFor(kind: MicaFactKind): MicaFactPage | undefined {
  return FACT_PAGES[kind]
}

/**
 * The whole reply: what Mica says, and the page it offers to open.
 *
 * The offer is the last thing said, so the carer's next word plainly answers it,
 * and it rides in the answer rather than in a field the client would have to
 * combine. `page` is absent where there is nothing to show — the two answers that
 * are only lists, and a name that did not resolve (no list was read, so offering
 * the page it would have come from would be a non sequitur).
 */
export function formatFactReply(
  request: MicaFactRequest,
  rows: unknown[],
): { answer: string; page?: MicaFactPage } {
  const answer = formatFactAnswer(request, rows)
  if (toolMessage((rows || []) as Row[])) return { answer }
  const page = factPageFor(request.kind)
  return page ? { answer: `${answer} ${page.offer}`, page } : { answer }
}
