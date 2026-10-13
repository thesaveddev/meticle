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
 *     path; the fact path answers *lists*, never advice.
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
 * Pure by design. `today` is a parameter and no database is imported: parsing,
 * day arithmetic and the spoken phrasing are all testable without a clock, a
 * connection or a frozen process timezone, exactly like `mica.navigation.ts`.
 * The caller executes the tool and hands the rows back.
 */

import { MICA_TIMEZONE } from './mica.spoken-time'
import type { MicaNavigationDestination } from './mica.navigation'

export type MicaFactKind = 'rota' | 'appointments' | 'medication-round' | 'leave'

export interface MicaFactRequest {
  kind: MicaFactKind
  /** The read-only Mica tool that supplies the rows (`mica.tools.ts`). */
  tool: 'get_staff_on_shift' | 'get_appointments' | 'get_medication_round' | 'get_staff_on_leave'
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
  /** Arguments for the tool; `person_name` is added once the caller resolves it. */
  args: Record<string, unknown>
}

/** One row of a tool result, as node-postgres hands it back. */
type Row = Record<string, unknown>

/** How many entries Mica says before it summarises the rest. Spoken, so short. */
const ROTA_LIMIT = 5
const APPOINTMENT_LIMIT = 4
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
  if (/\bin \d+ (day|days|week|weeks)\b/.test(lower)) return null

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
 * The person named in the utterance, if one was.
 *
 * Every candidate is considered, not just the first: "what's left on Nora's med
 * round" opens with a possessive that is not a name, and stopping there would
 * lose the name that is. A possessive also outranks "for …", because "Grace
 * Roberts's round for today" has a name and a day and only the name is a person.
 */
function extractPersonName(raw: string): string | undefined {
  for (const pattern of [POSSESSIVE_NAME, PHRASE_NAME]) {
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

  if (WRITE_VERB.test(lower)) return null

  if (MEDICATION_ROUND.test(lower)) {
    return { kind: 'medication-round', tool: 'get_medication_round', ...base, ...(personName ? { personName } : {}) }
  }

  if (asksAboutAppointments(lower, personName)) {
    return { kind: 'appointments', tool: 'get_appointments', ...base, ...(personName ? { personName } : {}) }
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
 * Two, not four. The rota and the appointments list are places a carer works in
 * — the sentence is a summary of what is on them. A medication round and who is
 * on leave are answered by the sentence itself, and the chart behind a round is
 * reached by naming it ("open Nora's MAR chart"), so offering those would be
 * asking a question the carer did not need.
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
