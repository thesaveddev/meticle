import { describe, expect, it } from 'vitest'
import {
  parseFactQuestion, formatFactAnswer, formatFactReply, factPageFor,
  TRAINING_WINDOW_DAYS,
} from './mica.facts'
import type { MicaFactKind, MicaFactRequest } from './mica.facts'
import { parseNavigationRequest } from './mica.navigation'
import { AI_CAPABILITIES } from './ai.capabilities'
import { findMicaTool } from './mica.tools'

/**
 * The phrasing corpus — Mica's deterministic vocabulary, as one table.
 *
 * Why this file exists. Paragraphs of `expect(...)` assertions scattered through a
 * unit test protect the phrases somebody thought of on the day they wrote them.
 * They do not protect the *boundary*: the fact path is narrow on purpose (a
 * question whose answer is a bounded list or a count of the organisation's own
 * rows), and every widening of that vocabulary is one regex away from swallowing a
 * question the model should have answered — a summary read as a list, a
 * percentage read as a count, a write read as a question. That failure is silent:
 * the carer hears a confident wrong answer, and no type changes.
 *
 * So the corpus pins both directions, and it is meant to be extended by adding a
 * row rather than by adding an assertion:
 *
 *   - `ANSWERED` — the phrases that must resolve, each naming the kind and the
 *     read-only tool that answers it. Every kind must appear here at least twice,
 *     so a kind cannot be added to `mica.facts.ts` without its vocabulary.
 *   - `REFUSED` — the phrases that must stay on the model path, each carrying the
 *     class of refusal it is an example of. Every class is guarded by more than one
 *     phrase, because one lucky word is not what keeps a class safe: "summarise
 *     this month's incidents" would still pass if a rule accidentally accepted
 *     everything with the word "incidents" in it and the only counter-example was
 *     a sentence the model happened to answer anyway.
 *
 * Three structural invariants come with it, and they are what catch drift no
 * table can: every fact kind formats without leaking a placeholder, every tool the
 * parser asks is asked for arguments it actually declares, and the pages a list
 * answer may offer are still exactly the two that are workspaces a carer moves in.
 *
 * `today` is always passed explicitly — the same 12 October 2026 the rest of the
 * Mica suites use — so nothing here depends on a clock.
 */

const TODAY = '2026-10-12'

interface CorpusRow {
  said: string
  /**
   * `null` means "the model path keeps this". Anything else is the kind and tool
   * the phrase must resolve to.
   */
  expect: { kind: MicaFactKind; tool: MicaFactRequest['tool'] } | null
  /**
   * Why this must resolve this way. For a refusal the *first word* is the class
   * of refusal (`judgement`, `write`, `window`, `statement`, `no-person`), which
   * the breadth check reads; the rest is the reasoning a future edit has to argue
   * with before changing the row.
   */
  why: string
}

const answered = (said: string, kind: MicaFactKind, tool: MicaFactRequest['tool'], why: string): CorpusRow =>
  ({ said, expect: { kind, tool }, why })

const refused = (said: string, why: string): CorpusRow => ({ said, expect: null, why })

/** The phrases that must be answered, without a model. */
const ANSWERED: CorpusRow[] = [
  answered('Who is on shift today?', 'rota', 'get_staff_on_shift', 'the platform\'s own example, and the first list question a carer asks'),
  answered("Who's on shift?", 'rota', 'get_staff_on_shift', 'no day said means today, and the answer says so aloud'),
  answered('any staff on shift tomorrow', 'rota', 'get_staff_on_shift', 'a resolvable day window'),
  answered('who is working today', 'rota', 'get_staff_on_shift', '"working today" is the same question in other words'),
  answered('who is on duty tonight', 'rota', 'get_staff_on_shift', '"on duty" and "tonight" are both in the vocabulary'),
  answered('who is on the rota today', 'rota', 'get_staff_on_shift', 'the page\'s own name is the question'),
  answered('who is on shift 2026-10-15', 'rota', 'get_staff_on_shift', 'a stated ISO day is the one day format that needs no arithmetic'),
  answered('how many staff are on shift today', 'rota', 'get_staff_on_shift', 'the count is the answer\'s own lead sentence'),

  answered("Give me today's appointments", 'appointments', 'get_appointments', 'a plural list, not a request for the page'),
  answered('what appointments do we have today', 'appointments', 'get_appointments', 'an outright ask'),
  answered('any appointments today', 'appointments', 'get_appointments', '"any" is an ask'),
  answered("Ade Okafor's appointments today", 'appointments', 'get_appointments', 'the plural plus a name is the person-scoped list'),
  answered('any appointments for Ade Okafor today', 'appointments', 'get_appointments', 'the same list, asked with "for"'),

  answered('how is the medication round looking today', 'medication-round', 'get_medication_round', 'the round is a list of doses, not the urgency advice behind them'),
  answered("how is Nora Whitfield's medication round looking today", 'medication-round', 'get_medication_round', 'the same round scoped to one person'),
  answered("what's left on Nora's med round", 'medication-round', 'get_medication_round', '"med round" and a bare first name both resolve'),
  answered("is Nora's medication round looking ok", 'medication-round', 'get_medication_round', 'a question shape, and still a list question'),

  answered('who is on leave today', 'leave', 'get_staff_on_leave', 'the approved-leave list'),
  answered('anyone on leave tomorrow', 'leave', 'get_staff_on_leave', 'a resolvable day window'),

  answered('who is supporting Grace Roberts today', 'support', 'who_supports_person', 'the supporting question, whose name follows the verb'),
  answered("who's caring for Nora Whitfield today", 'support', 'who_supports_person', '"caring for" is the same question in other words'),
  answered('who is working with Grace Roberts today', 'support', 'who_supports_person', '"working with" too — and it must not be read as the rota'),
  answered('who is supporting Ade Okafor tomorrow', 'support', 'who_supports_person', 'a resolvable day window on a person'),

  answered('whose training is expiring', 'training-expiry', 'get_training_expiring', 'an expiry verb plus an ask, and no name: the whole roster'),
  answered('whose training is expiring soon', 'training-expiry', 'get_training_expiring', '"soon" is the default window, not a window to parse'),
  answered('which staff training has expired', 'training-expiry', 'get_training_expiring', 'already-expired records are in the same list'),
  answered('is Priya Sharma\'s training expiring', 'training-expiry', 'get_training_expiring', 'a possessive makes it one staff member\'s record'),
  answered('who has out of date training', 'training-expiry', 'get_training_expiring', '"out of date" is the same fact as "expiring"'),
  answered('how many staff have expired training', 'training-expiry', 'get_training_expiring', 'a count of records is still a list read, never a narrative'),
  answered('has Priya Sharma\'s training lapsed', 'training-expiry', 'get_training_expiring', '"lapsed" is an expiry verb, and the question form is the one a carer can reach: the client drafts a *statement* about a certificate as a renewal task and sends the question here'),

  answered('how much leave does Priya Sharma have left', 'leave-balance', 'get_leave_balance', 'the subject-of-the-sentence name shape'),
  answered('how much leave does Priya have left today', 'leave-balance', 'get_leave_balance', 'a bare first name resolves through the staff resolver'),
  answered('how many days leave has Jane Doyle got left', 'leave-balance', 'get_leave_balance', 'the "has X got left" shape'),
  answered('how much annual leave does Marcus Bell have left', 'leave-balance', 'get_leave_balance', '"annual leave" is the same balance'),
  answered("what's Priya Sharma's leave balance", 'leave-balance', 'get_leave_balance', '"balance" is an ask'),

  answered('how many incidents this month', 'incidents', 'get_incidents_in_month', 'a count of the month\'s incidents, which is not a narrative'),
  answered('how many incidents have we had this month', 'incidents', 'get_incidents_in_month', 'the same count, asked at length'),
  answered('how many incidents so far this month', 'incidents', 'get_incidents_in_month', '"so far this month" is month-to-date'),
  answered("what's the total incidents this month", 'incidents', 'get_incidents_in_month', '"total" is a count ask'),
  answered('how many near miss incidents last month', 'incidents', 'get_incidents_in_month', 'last month is the one month window with arithmetic, and January must roll the year back'),
]

/** The phrases that must keep the model path. */
const REFUSED: CorpusRow[] = [
  refused("summarise this month's incidents", 'judgement: a summary is narrative, whatever the window — the count of the same incidents is the deterministic half'),
  refused('how urgent is the Risperidone reorder', 'judgement: the stock urgency bands belong to the tool description and the model'),
  refused('any medication overdue today', 'judgement: overdue advice is the model\'s, even though the round counts overdue doses'),
  refused('how is the rota looking today', 'judgement: coverage needs reading open versus filled, not listing a day\'s rows'),
  refused('how is our training compliance looking', 'judgement: a percentage across a roster is not a list of records'),
  refused('what happened with the fire door incident', 'judgement: one incident\'s story is a record read, not a count'),

  refused('book an appointment for the podiatry clinic', 'write: the action gateway drafts it, and a write verb must never read as a list'),
  refused('book training for Jane Doyle', 'write: booking a course is a draft'),
  refused('log an incident about the fire door', 'write: reporting an incident is a write, however incident-shaped'),
  refused("approve Jane Doyle's leave request", 'write: approval is a write, and "leave" alone must not make it a balance question'),
  refused('create a task to restock PPE', 'write: the action gateway owns creation'),
  refused('record an observation for Grace Roberts', 'write: recording is a write, and a person\'s name alone does not make it a list'),

  refused('who is on shift next Tuesday', 'window: no weekday arithmetic — answering about today would be a confident wrong answer'),
  refused('who is on shift this week', 'window: a week is not a day'),
  refused('who is on shift on 5 November', 'window: a named day this module does not resolve'),
  refused('are there any appointments coming up', 'window: "coming up" names no resolvable window'),
  refused('whose training is expiring next month', 'window: the training window is the tool\'s own default, not a parsed one'),
  refused('whose training is expiring within 7 days', 'window: a stated span is the model\'s to pass to the tool, never a default silently substituted'),
  refused('how much leave does Priya Sharma have left last year', 'window: a year other than the current one is a balance this answer cannot read'),
  refused('how many incidents in September', 'window: a named month is left to the model, exactly like a named day'),
  refused('how many incidents this week', 'window: the incidents window is a calendar month'),

  refused('Grace had a good day at the day centre', 'statement: a care note, not a question'),
  refused('the rota needs covering', 'statement: a statement about the rota, not a request to read it'),
  refused('the fire door check is still outstanding', 'statement: no ask at all'),
  refused('', 'statement: nothing to parse'),
  refused('   ', 'statement: whitespace is nothing to parse'),

  refused('who is supporting today', 'no-person: the supporting question names nobody, and the tool takes a name'),
  refused('how much leave is left', 'no-person: a balance belongs to a member of staff, and the question names none'),
]

const CORPUS: CorpusRow[] = [...ANSWERED, ...REFUSED]

/** The refusal classes, and how many phrases each must be guarded by. */
const REFUSAL_FLOOR: Record<string, number> = {
  judgement: 3, write: 3, window: 3, statement: 3, 'no-person': 2,
}

/**
 * One answer's rows per kind, so formatting is exercised for every kind the parser
 * can produce. Typed as a total record: adding a kind to `MicaFactKind` fails to
 * compile until it has a sample, which is the point.
 */
const SAMPLES: Record<MicaFactKind, { request: MicaFactRequest; rows: unknown[] }> = {
  rota: {
    request: { kind: 'rota', tool: 'get_staff_on_shift', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: true, args: { date: TODAY } },
    rows: [{
      staff_name: 'Fatima Iqbal', shift_type: 'day', location_name: 'Oak House',
      start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T19:00:00.000Z',
    }],
  },
  appointments: {
    request: { kind: 'appointments', tool: 'get_appointments', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: true, args: { date: TODAY } },
    rows: [{ title: 'Dental check', person_name: 'Ade Okafor', start_time: '2026-10-12T13:00:00.000Z' }],
  },
  'medication-round': {
    request: { kind: 'medication-round', tool: 'get_medication_round', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: true, args: { date: TODAY } },
    rows: [{ total_scheduled: 2, given: 1, overdue: 1, still_due: 0, not_given_other: 0 }],
  },
  leave: {
    request: { kind: 'leave', tool: 'get_staff_on_leave', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: true, args: { date: TODAY } },
    rows: [{ staff_name: 'Jane Doyle', leave_type: 'Annual Leave', end_date: '2026-10-15' }],
  },
  support: {
    request: {
      kind: 'support', tool: 'who_supports_person', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: true,
      personName: 'Grace Roberts', args: { date: TODAY, person_name: 'Grace Roberts' },
    },
    rows: [
      {
        source: 'rota', person_name: 'Grace Roberts', staff_name: 'Priya Sharma', shift_type: 'day',
        location_name: 'Oak House', start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T19:00:00.000Z',
      },
      // A visit with nobody assigned, which the answer has to say rather than hide.
      { source: 'visit', person_name: 'Grace Roberts', staff_name: null, label: 'Lunch call', scheduled_start: '2026-10-12T12:00:00.000Z' },
    ],
  },
  'training-expiry': {
    request: {
      kind: 'training-expiry', tool: 'get_training_expiring', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: false,
      windowDays: TRAINING_WINDOW_DAYS, args: { days: TRAINING_WINDOW_DAYS },
    },
    rows: [
      { staff_name: 'Priya Sharma', module: 'Fire Safety', completed_at: '2025-10-01', expires_at: '2026-10-01' },
      { staff_name: 'Jane Doyle', module: 'Safeguarding', completed_at: '2025-11-03', expires_at: '2026-11-03' },
    ],
  },
  'leave-balance': {
    request: {
      kind: 'leave-balance', tool: 'get_leave_balance', date: TODAY, today: TODAY, dayLabel: 'today', dayNamed: false,
      staffName: 'Priya Sharma', args: { staff_name: 'Priya Sharma' },
    },
    rows: [
      { staff_name: 'Priya Sharma', leave_type: 'Annual Leave', duration_type: 'days', days_allocated: 28, days_taken: 16, days_remaining: 12, hours_allocated: 0, hours_taken: 0, hours_remaining: 6 },
      { staff_name: 'Priya Sharma', leave_type: 'Unpaid', duration_type: 'days', days_allocated: 0, days_taken: 0, days_remaining: 0, hours_allocated: 0, hours_taken: 0, hours_remaining: 0 },
    ],
  },
  incidents: {
    request: {
      kind: 'incidents', tool: 'get_incidents_in_month', date: TODAY, today: TODAY, dayLabel: 'this month', dayNamed: true,
      month: '2026-10', args: { month: '2026-10' },
    },
    rows: [{ month: '2026-10', total: 7, critical: 1, high: 2, medium: 3, low: 1, near_misses: 1, open: 4 }],
  },
}

describe('the phrasing corpus — every answered phrase', () => {
  it('resolves to the kind and the read-only tool it claims', () => {
    for (const row of ANSWERED) {
      const parsed = parseFactQuestion(row.said, TODAY)
      expect(
        parsed && { kind: parsed.kind, tool: parsed.tool },
        `"${row.said}" (${row.why})`,
      ).toEqual(row.expect)
    }
  })

  it('names each kind at least twice, so no kind is added without its vocabulary', () => {
    const kinds = Object.keys(SAMPLES) as MicaFactKind[]
    for (const kind of kinds) {
      const rows = ANSWERED.filter((row) => row.expect?.kind === kind)
      expect(rows.length, `kind "${kind}" has ${rows.length} corpus phrases`).toBeGreaterThanOrEqual(2)
    }
  })

  it('asks every tool for arguments that tool declares', () => {
    // A parser argument the tool never reads is a silent no-op: the answer is
    // computed for the whole organisation while the carer hears about one person.
    for (const row of ANSWERED) {
      const parsed = parseFactQuestion(row.said, TODAY)
      const tool = findMicaTool(parsed!.tool)
      expect(tool, `"${row.said}" asks for tool "${parsed!.tool}"`).toBeDefined()
      const declared = Object.keys((tool!.parameters as { properties?: Record<string, unknown> }).properties || {})
      for (const key of Object.keys(parsed!.args)) {
        expect(declared, `"${row.said}" passes undeclared argument "${key}"`).toContain(key)
      }
    }
  })

  it("reads the training window from the tool's own default, not from the sentence", () => {
    const parsed = parseFactQuestion('whose training is expiring', TODAY)
    expect(parsed?.windowDays).toBe(TRAINING_WINDOW_DAYS)
    expect(parsed?.args).toEqual({ days: TRAINING_WINDOW_DAYS })
  })

  it('reads the month a month-scoped count covers, rolling the year back in January', () => {
    expect(parseFactQuestion('how many incidents this month', TODAY)?.month).toBe('2026-10')
    expect(parseFactQuestion('how many incidents last month', TODAY)?.month).toBe('2026-09')
    expect(parseFactQuestion('how many incidents last month', '2026-01-08')?.month).toBe('2025-12')
  })
})

describe('the phrasing corpus — every phrase that must not be swallowed', () => {
  it('stays on the model path', () => {
    for (const row of REFUSED) {
      expect(parseFactQuestion(row.said, TODAY), `"${row.said}" (${row.why})`).toBeNull()
    }
  })

  it('guards each class of refusal with more than one phrase', () => {
    for (const [label, floor] of Object.entries(REFUSAL_FLOOR)) {
      const rows = REFUSED.filter((row) => row.why.startsWith(`${label}:`))
      expect(rows.length, `class "${label}" has ${rows.length} counter-examples`).toBeGreaterThanOrEqual(floor)
    }
  })

  it('labels every refusal with a class the floor check knows', () => {
    // Guards the guard: a refusal row whose "why" is free prose would count towards
    // no class at all, quietly shrinking the breadth check.
    for (const row of REFUSED) {
      const label = row.why.split(':')[0]
      expect(Object.keys(REFUSAL_FLOOR), `"${row.said}" is labelled "${label}"`).toContain(label)
    }
  })

  it('keeps the corpus wide enough to be worth reading', () => {
    expect(ANSWERED.length).toBeGreaterThanOrEqual(24)
    expect(REFUSED.length).toBeGreaterThanOrEqual(20)
    expect(new Set([...ANSWERED, ...REFUSED].map((row) => row.said)).size).toBe(CORPUS.length)
  })
})

/**
 * What the capability disclosure an admin reads in Settings must say, per kind.
 * Typed as a total record, so a new kind fails to compile until the disclosure has
 * been updated with it — the summary is the privacy statement, and an answer that
 * is read from the organisation's own rows without being disclosed there would be
 * a quiet widening of what the platform claims to do with data.
 */
const DISCLOSURE_PHRASE: Record<MicaFactKind, string> = {
  rota: 'who is on shift',
  appointments: 'appointments',
  'medication-round': 'medication round',
  leave: 'who is on leave',
  support: 'who is supporting one person',
  'training-expiry': 'training is expiring',
  'leave-balance': 'leave balance',
  incidents: 'how many incidents the month has had',
}

describe('the phrasing corpus — the invariants no table can hold', () => {
  it('names every deterministic answer in the capability disclosure an admin reads', () => {
    const summary = AI_CAPABILITIES.natural_language_assistant.summary.toLowerCase()
    for (const [kind, phrase] of Object.entries(DISCLOSURE_PHRASE)) {
      expect(summary, `the disclosure does not mention the "${kind}" answer`).toContain(phrase)
    }
  })

  it('phrases every kind without leaking a placeholder', () => {
    for (const kind of Object.keys(SAMPLES) as MicaFactKind[]) {
      const { request: req, rows } = SAMPLES[kind]
      const answer = formatFactAnswer(req, rows)
      expect(answer.length, `kind "${kind}" answered nothing`).toBeGreaterThan(0)
      expect(answer, `kind "${kind}" leaked a placeholder`).not.toMatch(/undefined|NaN|\[object|null\b/)
    }
  })

  it('offers a page for exactly the two answers whose page is a workspace', () => {
    // Six of the eight answers are said and done. If a page offer is ever added to
    // one of them, this is the test that has to be changed on purpose.
    const withPages = (Object.keys(SAMPLES) as MicaFactKind[]).filter((kind) => factPageFor(kind))
    expect(withPages.sort()).toEqual(['appointments', 'rota'])
  })

  it('sends the same route for an offer and for asking to go there', () => {
    // Two ways into a page — confirming Mica's offer, and saying "open the rota" —
    // and they cannot be allowed to point at different pages.
    for (const [phrase, kind] of [['open the rota planner', 'rota'], ['open the appointments', 'appointments']] as const) {
      expect(parseNavigationRequest(phrase, TODAY)?.path).toBe(factPageFor(kind)?.path)
    }
  })

  it('adds the offer to the sentence a list answer already has', () => {
    const reply = formatFactReply(SAMPLES.rota.request, SAMPLES.rota.rows)
    expect(reply.answer).toBe(`${formatFactAnswer(SAMPLES.rota.request, SAMPLES.rota.rows)} ${reply.page?.offer}`)
    // The answers with no page are returned untouched.
    const counted = formatFactReply(SAMPLES.incidents.request, SAMPLES.incidents.rows)
    expect(counted.page).toBeUndefined()
    expect(counted.answer).toBe(formatFactAnswer(SAMPLES.incidents.request, SAMPLES.incidents.rows))
  })
})
