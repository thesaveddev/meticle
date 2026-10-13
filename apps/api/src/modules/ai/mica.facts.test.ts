import { describe, expect, it } from 'vitest'
import {
  parseFactQuestion, formatFactAnswer, formatFactReply, factPageFor, parseFactConfirmation,
  formatSpokenDay, formatSpokenTime,
} from './mica.facts'
import type { MicaFactRequest } from './mica.facts'
import { parseNavigationRequest } from './mica.navigation'

/**
 * Mica's deterministic list answers, pinned.
 *
 * Two properties matter here and nothing else is asserted: the questions a carer
 * asks every shift resolve to a bounded list of the organisation's own rows —
 * with no model, no provider and no budget — and every question whose answer
 * needs judgement, a different day window, or a write stays exactly where it was
 * (the model path, or the action gateway).
 *
 * `today` is always passed explicitly: the day arithmetic is deterministic and
 * must be tested without a clock. 12 October 2026 is the phrasing test's date.
 */

const TODAY = '2026-10-12'

const request = (overrides: Partial<MicaFactRequest>): MicaFactRequest => ({
  kind: 'rota',
  tool: 'get_staff_on_shift',
  date: TODAY,
  today: TODAY,
  dayLabel: 'today',
  dayNamed: true,
  args: { date: TODAY },
  ...overrides,
})

describe('parseFactQuestion — the questions a carer asks every shift', () => {
  it('reads the rota question, with and without a day word', () => {
    expect(parseFactQuestion('Who is on shift today?', TODAY)).toMatchObject({
      kind: 'rota', tool: 'get_staff_on_shift', date: TODAY, dayLabel: 'today', dayNamed: true,
    })
    // No day said: "who is on shift?" means today, and the answer says so aloud.
    expect(parseFactQuestion("Who's on shift?", TODAY)).toMatchObject({
      kind: 'rota', date: TODAY, dayNamed: false,
    })
    expect(parseFactQuestion('any staff on shift tomorrow', TODAY)).toMatchObject({
      kind: 'rota', date: '2026-10-13', dayLabel: 'tomorrow',
    })
  })

  it('reads today\'s appointments and does not mistake the day for a name', () => {
    const parsed = parseFactQuestion("Give me today's appointments", TODAY)
    expect(parsed).toMatchObject({ kind: 'appointments', tool: 'get_appointments', date: TODAY })
    // "Today's" is a possessive, and scoping the list to a person called Today
    // would answer about nobody. The stop-list is what prevents it.
    expect(parsed?.personName).toBeUndefined()
    expect(parseFactQuestion('what appointments do we have today', TODAY)?.kind).toBe('appointments')
  })

  it('scopes the list to a person when one is named', () => {
    expect(parseFactQuestion("Ade Okafor's appointments today", TODAY)).toMatchObject({
      kind: 'appointments', personName: 'Ade Okafor',
    })
    expect(parseFactQuestion('any appointments for Ade Okafor today', TODAY)?.personName).toBe('Ade Okafor')
  })

  it('reads a medication round, org-wide or for one person', () => {
    expect(parseFactQuestion('how is the medication round looking today', TODAY)).toMatchObject({
      kind: 'medication-round', tool: 'get_medication_round', date: TODAY,
    })
    expect(parseFactQuestion("how is Grace Roberts's medication round looking today", TODAY)).toMatchObject({
      kind: 'medication-round', personName: 'Grace Roberts',
    })
    expect(parseFactQuestion("what's left on Nora's med round", TODAY)).toMatchObject({
      kind: 'medication-round', personName: 'Nora',
    })
  })

  it('reads who is on leave', () => {
    expect(parseFactQuestion('who is on leave today', TODAY)).toMatchObject({
      kind: 'leave', tool: 'get_staff_on_leave', date: TODAY,
    })
    expect(parseFactQuestion('anyone on leave tomorrow', TODAY)?.dayLabel).toBe('tomorrow')
  })
})

describe('parseFactQuestion — everything that must stay where it was', () => {
  it('leaves a question needing judgement on the model path', () => {
    // The stock urgency bands are the model's job (mica.tools.ts says so), and a
    // deterministic path that quoted a number without them would be worse than
    // the round trip. The same rule keeps a *summary* of the month's incidents out
    // of the count that is answered: a count is a fact, a summary is judgement.
    expect(parseFactQuestion('Any medication overdue today?', TODAY)).toBeNull()
    expect(parseFactQuestion('how urgent is the Risperidone reorder', TODAY)).toBeNull()
    expect(parseFactQuestion('summarise this month\'s incidents', TODAY)).toBeNull()
    expect(parseFactQuestion('how is the rota looking today', TODAY)).toBeNull()
    expect(parseFactQuestion('is Grace on shift today', TODAY)).toBeNull()
    expect(parseFactQuestion('how is our training compliance looking', TODAY)).toBeNull()
    expect(parseFactQuestion('what happened with the fire door incident', TODAY)).toBeNull()
  })

  it('leaves a write to the action gateway', () => {
    expect(parseFactQuestion('book an appointment for the podiatry clinic', TODAY)).toBeNull()
    expect(parseFactQuestion("arrange a GP appointment for Ade Okafor's tomorrow", TODAY)).toBeNull()
    expect(parseFactQuestion('create a task to restock PPE', TODAY)).toBeNull()
    expect(parseFactQuestion('record a medication round check', TODAY)).toBeNull()
  })

  it('refuses a day window it cannot resolve rather than answering about today', () => {
    // A confident wrong answer about today is the failure this guards: the
    // carer asked about next Tuesday and would hear today's rota.
    expect(parseFactQuestion('who is on shift next Tuesday', TODAY)).toBeNull()
    expect(parseFactQuestion('who is on shift this week', TODAY)).toBeNull()
    expect(parseFactQuestion('who is on shift on 5 November', TODAY)).toBeNull()
    expect(parseFactQuestion('who is on shift in 3 days', TODAY)).toBeNull()
    expect(parseFactQuestion('are there any appointments coming up', TODAY)).toBeNull()
  })

  it('leaves empty input, observations and statements alone', () => {
    expect(parseFactQuestion('', TODAY)).toBeNull()
    expect(parseFactQuestion('   ', TODAY)).toBeNull()
    expect(parseFactQuestion('Grace had a good day at the day centre', TODAY)).toBeNull()
    expect(parseFactQuestion('the rota needs covering', TODAY)).toBeNull()
  })

  it('takes a stated ISO day', () => {
    expect(parseFactQuestion('who is on shift 2026-10-15', TODAY)).toMatchObject({
      date: '2026-10-15', dayLabel: 'on 15 October',
    })
  })
})

describe('formatFactAnswer — the rota', () => {
  const shift = (staff: string, start: string, end: string, type = 'day') => ({
    staff_name: staff, shift_type: type, location_name: 'Oak House', start_time: start, end_time: end,
    assignment_status: 'assigned',
  })

  it('names the staff, their shift and their hours in UK wall-clock', () => {
    const answer = formatFactAnswer(
      request({ kind: 'rota', tool: 'get_staff_on_shift' }),
      [
        shift('Fatima Iqbal', '2026-10-12T07:00:00.000Z', '2026-10-12T19:00:00.000Z'),
        shift('Sam Reed', '2026-10-12T19:00:00.000Z', '2026-10-13T07:00:00.000Z', 'wake_night'),
      ],
    )
    expect(answer).toBe(
      '2 staff are on shift today: Fatima Iqbal (day shift, Oak House, 8am to 8pm); ' +
      'Sam Reed (waking night, Oak House, 8pm to 8am).',
    )
  })

  it('summarises the rest rather than reading out a whole rota', () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      shift(`Carer ${index + 1}`, '2026-10-12T07:00:00.000Z', '2026-10-12T19:00:00.000Z'))
    const answer = formatFactAnswer(request({ kind: 'rota', tool: 'get_staff_on_shift' }), rows)
    expect(answer).toContain('8 staff are on shift today')
    expect(answer).toContain('Carer 5')
    expect(answer).not.toContain('Carer 6')
    expect(answer).toContain('and 3 more')
  })

  it('says nobody is assigned rather than leaving a silence', () => {
    expect(formatFactAnswer(request({ kind: 'rota', tool: 'get_staff_on_shift' }), []))
      .toBe('Nobody is assigned to a shift today.')
  })
})

describe('formatFactAnswer — appointments', () => {
  const appointment = (title: string, person: string, start: string) => ({
    title, person_name: person, start_time: start, end_time: start, status: 'scheduled',
  })

  it('reads out the home\'s list with the person each appointment is for', () => {
    const answer = formatFactAnswer(
      request({ kind: 'appointments', tool: 'get_appointments' }),
      [
        appointment('Dental check', 'Ade Okafor', '2026-10-12T13:00:00.000Z'),
        appointment('Physiotherapy', 'Nora Whitfield', '2026-10-12T14:30:00.000Z'),
      ],
    )
    expect(answer).toBe(
      'There are 2 appointments today: 2pm Dental check for Ade Okafor; 3:30pm Physiotherapy for Nora Whitfield.',
    )
  })

  it('does not repeat the name when the list is already theirs', () => {
    const answer = formatFactAnswer(
      request({ kind: 'appointments', tool: 'get_appointments', personName: 'Ade Okafor' }),
      [appointment('Dental check', 'Ade Okafor', '2026-10-12T13:00:00.000Z')],
    )
    expect(answer).toBe('Ade Okafor has one appointment today: 2pm Dental check.')
  })

  it('says so when there are none', () => {
    expect(formatFactAnswer(request({ kind: 'appointments', tool: 'get_appointments' }), []))
      .toBe('There are no appointments today.')
    expect(formatFactAnswer(
      request({ kind: 'appointments', tool: 'get_appointments', personName: 'Ade Okafor' }),
      [],
    )).toBe('Ade Okafor has no appointments today.')
  })
})

describe('formatFactAnswer — the medication round', () => {
  const summary = { total_scheduled: 2, given: 1, overdue: 1, still_due: 0, not_given_other: 0 }
  const overdue = {
    person_name: 'Nora Whitfield', medication: 'Risperidone', dosage: '1', unit: 'mg',
    scheduled_time: '2026-10-12T00:00:00.000Z', status: 'pending',
  }
  const lowStock = {
    medication_name: 'Risperidone', dosage: '1', unit: 'mg', quantity: 2, quantity_unit: 'tablet(s)',
    reorder_level: 10, out_of_stock: false, days_until_empty: 56, expired_first: true,
  }
  const outOfStock = {
    medication_name: 'Haloperidol', dosage: '0.5', unit: 'mg', quantity: 0, quantity_unit: 'tablet(s)',
    reorder_level: 10, out_of_stock: true, days_until_empty: null, expired_first: null,
  }

  it('states the counts, the overdue dose and the stock warnings as facts', () => {
    const answer = formatFactAnswer(
      request({ kind: 'medication-round', tool: 'get_medication_round' }),
      [summary, overdue, lowStock, outOfStock],
    )
    expect(answer).toBe(
      'Across the home, 2 doses are scheduled today: 1 given, 0 still due, 1 overdue. ' +
      "Overdue: Nora Whitfield's Risperidone 1 mg was due at 1am. " +
      'Stock to watch: Risperidone has 2 tablets, roughly 56 days left (expires before it runs out); ' +
      'Haloperidol is out of stock.',
    )
    // Facts, not advice: the urgency bands stay the model's job.
    expect(answer).not.toMatch(/urgent|reorder|order/i)
  })

  it('scopes the whole answer to the person when one was named', () => {
    const answer = formatFactAnswer(
      request({ kind: 'medication-round', tool: 'get_medication_round', personName: 'Nora Whitfield' }),
      [summary, overdue, lowStock],
    )
    expect(answer).toContain("Nora Whitfield's medication round today: 1 given, 0 still due, 1 overdue.")
    // The name is in the scope, so the overdue line does not repeat it.
    expect(answer).toContain('Overdue: Risperidone 1 mg was due at 1am.')
  })

  it('answers an empty chart without inventing a round', () => {
    expect(formatFactAnswer(
      request({ kind: 'medication-round', tool: 'get_medication_round' }),
      [{ total_scheduled: 0, given: 0, overdue: 0, still_due: 0, not_given_other: 0 }],
    )).toBe('No doses are scheduled today.')
    expect(formatFactAnswer(
      request({ kind: 'medication-round', tool: 'get_medication_round', personName: 'Nora Whitfield' }),
      [{ total_scheduled: 0, given: 0, overdue: 0, still_due: 0, not_given_other: 0 }],
    )).toBe('Nora Whitfield has no doses scheduled today.')
  })

  it('says nothing about stock when nothing is low', () => {
    const answer = formatFactAnswer(
      request({ kind: 'medication-round', tool: 'get_medication_round' }),
      [{ total_scheduled: 3, given: 3, overdue: 0, still_due: 0, not_given_other: 0 }],
    )
    expect(answer).toBe('Across the home, 3 doses are scheduled today: 3 given, 0 still due, none overdue.')
  })
})

describe('formatFactAnswer — leave', () => {
  it('names who is off and until when', () => {
    const answer = formatFactAnswer(
      request({ kind: 'leave', tool: 'get_staff_on_leave' }),
      [
        { staff_name: 'Jane Doyle', leave_type: 'Annual Leave', start_date: '2026-10-10', end_date: '2026-10-15' },
        { staff_name: 'Marcus Bell', leave_type: 'Sick', start_date: '2026-10-12', end_date: '2027-01-04' },
      ],
    )
    expect(answer).toBe(
      '2 staff are on approved leave today: Jane Doyle (Annual Leave, until 15 October); ' +
      'Marcus Bell (Sick, until 4 January 2027).',
    )
  })

  it('says so when nobody is off', () => {
    expect(formatFactAnswer(request({ kind: 'leave', tool: 'get_staff_on_leave' }), []))
      .toBe('Nobody is on approved leave today.')
  })
})

describe('parseFactQuestion — the second batch of list questions', () => {
  it('reads who is supporting one person, however the verb is said', () => {
    for (const said of [
      'who is supporting Grace Roberts today',
      "who's caring for Grace Roberts today",
      'who is working with Grace Roberts today',
    ]) {
      expect(parseFactQuestion(said, TODAY)).toMatchObject({
        kind: 'support', tool: 'who_supports_person', personName: 'Grace Roberts', date: TODAY,
      })
    }
    // The name follows the verb, so it is found without a possessive or a "for".
    expect(parseFactQuestion("who's caring for Nora Whitfield today", TODAY)?.personName).toBe('Nora Whitfield')
    expect(parseFactQuestion('who is supporting Ade Okafor tomorrow', TODAY)?.dayLabel).toBe('tomorrow')
  })

  it('reads whose training is expiring, for the roster or for one member of staff', () => {
    expect(parseFactQuestion('whose training is expiring soon', TODAY)).toMatchObject({
      kind: 'training-expiry', tool: 'get_training_expiring', windowDays: 30, args: { days: 30 },
    })
    expect(parseFactQuestion('whose training is expiring soon', TODAY)?.personName).toBeUndefined()
    // A name makes it one person's records, and the name is a *staff* name: the
    // caller resolves it against the staff directory, not the resident roster.
    expect(parseFactQuestion("is Priya Sharma's training expiring", TODAY)).toMatchObject({
      kind: 'training-expiry', staffName: 'Priya Sharma', personName: 'Priya Sharma',
    })
    expect(parseFactQuestion("Priya Sharma's training has lapsed", TODAY)?.staffName).toBe('Priya Sharma')
  })

  it('reads a staff member\'s leave balance, and only when a name is said', () => {
    expect(parseFactQuestion('how much leave does Priya Sharma have left', TODAY)).toMatchObject({
      kind: 'leave-balance', tool: 'get_leave_balance', staffName: 'Priya Sharma',
    })
    expect(parseFactQuestion('how many days leave has Jane Doyle got left', TODAY)?.staffName).toBe('Jane Doyle')
    // No name: the balance would have to be the whole organisation's, which is not
    // what the question meant, so it stays the model's.
    expect(parseFactQuestion('how much leave is left', TODAY)).toBeNull()
  })

  it('reads the month a count of incidents covers', () => {
    expect(parseFactQuestion('how many incidents this month', TODAY)).toMatchObject({
      kind: 'incidents', tool: 'get_incidents_in_month', month: '2026-10', dayLabel: 'this month', args: { month: '2026-10' },
    })
    expect(parseFactQuestion('how many incidents last month', TODAY)?.month).toBe('2026-09')
    // January is the case worth stating: last month is December of the year before.
    expect(parseFactQuestion('how many incidents last month', '2026-01-08')?.month).toBe('2025-12')
    // A named month, and a week, are windows this module will not invent.
    expect(parseFactQuestion('how many incidents in September', TODAY)).toBeNull()
    expect(parseFactQuestion('how many incidents this week', TODAY)).toBeNull()
  })

  it('keeps the questions with no person to answer about on the model path', () => {
    expect(parseFactQuestion('who is supporting today', TODAY)).toBeNull()
    expect(parseFactQuestion('how are we supporting people today', TODAY)).toBeNull()
  })
})

describe('formatFactAnswer — who is supporting one person', () => {
  const support = (overrides: Partial<MicaFactRequest> = {}) =>
    request({ kind: 'support', tool: 'who_supports_person', personName: 'Grace Roberts', ...overrides })
  const shift = {
    source: 'rota', staff_name: 'Priya Sharma', shift_type: 'day', location_name: 'Oak House',
    start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T19:00:00.000Z',
  }
  const visit = {
    source: 'visit', staff_name: 'Jane Doyle', label: 'Lunch call',
    scheduled_start: '2026-10-12T11:00:00.000Z', scheduled_end: '2026-10-12T11:30:00.000Z',
  }

  it('reads rota shifts and visits as one list, in UK wall-clock', () => {
    expect(formatFactAnswer(support(), [shift, visit])).toBe(
      '2 people are supporting Grace Roberts today: Priya Sharma (day shift, Oak House, 8am to 8pm); ' +
      'Jane Doyle (Lunch call, 12pm to 12:30pm).',
    )
  })

  it('says a visit with nobody assigned rather than hiding it', () => {
    // "Grace has two visits and no carer" is the answer a manager needs; listing
    // only the one assigned carer would not be.
    expect(formatFactAnswer(support(), [{ ...visit, staff_name: null }]))
      .toBe('Grace Roberts has 1 visit today, with nobody assigned yet.')
    expect(formatFactAnswer(support(), [shift, { ...visit, staff_name: null }]))
      .toBe('One person is supporting Grace Roberts today: Priya Sharma (day shift, Oak House, 8am to 8pm). ' +
        '1 visit has nobody assigned yet.')
  })

  it('says nobody is assigned rather than leaving a silence', () => {
    expect(formatFactAnswer(support(), [])).toBe('Nobody is assigned to support Grace Roberts today.')
  })
})

describe('formatFactAnswer — training expiry', () => {
  const training = (overrides: Partial<MicaFactRequest> = {}) =>
    request({ kind: 'training-expiry', tool: 'get_training_expiring', dayNamed: false, windowDays: 30, args: { days: 30 }, ...overrides })

  it('says expired and expiring records apart by the phrasing of the date', () => {
    const answer = formatFactAnswer(training(), [
      { staff_name: 'Priya Sharma', module: 'Fire Safety', expires_at: '2026-10-01' },
      { staff_name: 'Jane Doyle', module: 'Safeguarding', expires_at: '2026-11-03' },
    ])
    expect(answer).toBe(
      '2 training records are expiring soon: Priya Sharma — Fire Safety, expired on 1 October; ' +
      'Jane Doyle — Safeguarding, expires 3 November.',
    )
  })

  it('does not repeat the name when the records are already theirs', () => {
    const answer = formatFactAnswer(
      training({ staffName: 'Priya Sharma' }),
      [{ staff_name: 'Priya Sharma', module: 'Fire Safety', expires_at: '2026-10-01' }],
    )
    expect(answer).toBe('Priya Sharma has 1 training record expiring soon: Fire Safety, expired on 1 October.')
  })

  it('says so when nothing is expiring, for the roster and for one person', () => {
    expect(formatFactAnswer(training(), [])).toBe('No staff training is expiring in the next 30 days.')
    expect(formatFactAnswer(training({ staffName: 'Priya Sharma' }), []))
      .toBe('Priya Sharma has no training expiring in the next 30 days.')
  })
})

describe('formatFactAnswer — a leave balance', () => {
  const balance = (overrides: Partial<MicaFactRequest> = {}) =>
    request({ kind: 'leave-balance', tool: 'get_leave_balance', dayNamed: false, staffName: 'Priya Sharma', ...overrides })
  const row = (leave_type: string, days_remaining: number, hours_remaining: number, days_allocated = 28) => ({
    staff_name: 'Priya Sharma', leave_type, duration_type: 'days', days_allocated, days_taken: days_allocated - days_remaining,
    days_remaining, hours_allocated: 0, hours_taken: 0, hours_remaining,
  })

  it('aggregates the balance the way the leave cards do: days plus hours', () => {
    expect(formatFactAnswer(balance(), [row('Annual Leave', 12, 6), row('Sick', 8, 0, 10)])).toBe(
      'Priya Sharma has 20 days + 6 hours of leave left in 2026: Annual Leave 12 days + 6 hours; Sick 8 days.',
    )
  })

  it('does not say the same number twice when there is one type', () => {
    expect(formatFactAnswer(balance(), [row('Annual Leave', 12, 6)]))
      .toBe('Priya Sharma has 12 days + 6 hours of leave left in 2026.')
  })

  it('says an exhausted balance as "no leave left", not as zero days', () => {
    expect(formatFactAnswer(balance(), [row('Annual Leave', 0, 0)])).toBe('Priya Sharma has no leave left in 2026.')
  })

  it('says over-taken leave as "over" rather than as a negative number', () => {
    expect(formatFactAnswer(balance(), [row('Annual Leave', -2, 0)]))
      .toBe('Priya Sharma is 2 days over their 2026 allowance.')
  })

  it('drops a leave type that was never allocated, and says when none was', () => {
    expect(formatFactAnswer(balance(), [row('Annual Leave', 12, 6), row('Unpaid', 0, 0, 0)]))
      .toBe('Priya Sharma has 12 days + 6 hours of leave left in 2026.')
    expect(formatFactAnswer(balance(), [row('Unpaid', 0, 0, 0)]))
      .toBe('Priya Sharma has no leave allowance set up for 2026.')
  })
})

describe('formatFactAnswer — how many incidents this month', () => {
  const incidents = request({
    kind: 'incidents', tool: 'get_incidents_in_month', dayLabel: 'this month', month: '2026-10', args: { month: '2026-10' },
  })

  it('reads the count, the severity breakdown, the near misses and the open ones', () => {
    expect(formatFactAnswer(incidents, [
      { total: 7, critical: 1, high: 2, medium: 3, low: 1, near_misses: 1, open: 4 },
    ])).toBe(
      'There have been 7 incidents this month: 1 critical, 2 high, 3 medium and 1 low. ' +
      '1 was a near miss. 4 are still open.',
    )
  })

  it('drops the severities that did not happen rather than reading out zeros', () => {
    expect(formatFactAnswer(incidents, [
      { total: 1, critical: 0, high: 1, medium: 0, low: 0, near_misses: 0, open: 0 },
    ])).toBe('There have been 1 incident this month: 1 high. None were near misses. All of them are closed.')
  })

  it('says so when the month has had none', () => {
    expect(formatFactAnswer(incidents, [{ total: 0 }])).toBe('There have been no incidents this month.')
  })
})

describe('formatFactAnswer — a tool that could not answer', () => {
  it('passes a tool\'s own message through rather than re-phrasing it', () => {
    const answer = formatFactAnswer(
      request({ kind: 'appointments', tool: 'get_appointments' }),
      [{ result: 'No service user matching "Nobody Here" found.' }],
    )
    expect(answer).toBe('No service user matching "Nobody Here" found.')
  })
})

describe('the page behind a list answer', () => {
  const rotaRows = [{
    staff_name: 'Fatima Iqbal', shift_type: 'day', location_name: 'Oak House',
    start_time: '2026-10-12T07:00:00.000Z', end_time: '2026-10-12T19:00:00.000Z',
  }]

  it('offers the rota after answering who is on shift', () => {
    const reply = formatFactReply(request({ kind: 'rota', tool: 'get_staff_on_shift' }), rotaRows)

    // The list first, the question last: the carer asked what is on the rota, so
    // the offer is the final sentence and a "yes" plainly answers it.
    expect(reply.answer).toContain('Fatima Iqbal')
    expect(reply.answer).toMatch(/Want me to open the rota planner\?$/)
    expect(reply.page).toEqual({
      destination: 'rota', path: '/scheduling', label: 'the rota planner',
      offer: 'Want me to open the rota planner?',
    })
  })

  it("offers the appointments list after answering the day's appointments", () => {
    const reply = formatFactReply(request({ kind: 'appointments', tool: 'get_appointments' }), [
      { title: 'Dental check', person_name: 'Ade Okafor', start_time: '2026-10-12T13:00:00.000Z' },
    ])

    expect(reply.answer).toMatch(/Want me to open the appointments list\?$/)
    expect(reply.page).toMatchObject({
      destination: 'appointments', path: '/appointments', label: 'the appointments list',
    })
  })

  it('offers nothing for the two answers that are only lists', () => {
    // The round and the leave list are answered by the sentence itself, and the
    // chart behind a round is reached by naming it ("open Nora's MAR chart"), so
    // a question here would be one the carer did not ask.
    const round = formatFactReply(request({ kind: 'medication-round', tool: 'get_medication_round' }), [
      { total_scheduled: 2, given: 2, overdue: 0, still_due: 0, not_given_other: 0 },
    ])
    expect(round.page).toBeUndefined()
    expect(round.answer).not.toMatch(/want me to open/i)

    const leave = formatFactReply(request({ kind: 'leave', tool: 'get_staff_on_leave' }), [])
    expect(leave.page).toBeUndefined()
    expect(leave.answer).not.toMatch(/want me to open/i)
  })

  it('offers no page when the list could not be read at all', () => {
    // A name that matched nobody: the carer has not heard the list they asked for,
    // so offering the page it would have come from is a non sequitur.
    const reply = formatFactReply(
      request({ kind: 'appointments', tool: 'get_appointments', personName: 'Nobody Here' }),
      [{ result: 'No service user matching "Nobody Here" found.' }],
    )

    expect(reply.page).toBeUndefined()
    expect(reply.answer).toBe('No service user matching "Nobody Here" found.')
  })

  it('sends the same route the navigation path sends for the same page', () => {
    // Asking for a page and confirming an offer are two ways in, and they cannot
    // be allowed to point at different pages.
    expect(parseNavigationRequest('open the rota planner', TODAY)?.path).toBe(factPageFor('rota')?.path)
    expect(parseNavigationRequest('open the appointments', TODAY)?.path)
      .toBe(factPageFor('appointments')?.path)
  })
})

describe("parseFactConfirmation — the answer to Mica's own question", () => {
  it('reads the confirmations a carer actually says', () => {
    for (const yes of [
      'yes', 'Yeah.', 'yep', 'OK', 'okay', 'sure', 'alright', 'go on', 'go ahead',
      'do it', 'open it', 'show me', 'Yes please', 'please do', 'sounds good',
    ]) {
      expect(parseFactConfirmation(yes)).toBe(true)
    }
  })

  it('does not read a new question, a refusal or a silence as one', () => {
    // "yes, but…" is the one that matters: it is a new question, and pulling the
    // carer onto the rota mid-sentence is the failure to avoid.
    expect(parseFactConfirmation('yes, but what about tomorrow')).toBe(false)
    expect(parseFactConfirmation('no')).toBe(false)
    expect(parseFactConfirmation('no thanks')).toBe(false)
    expect(parseFactConfirmation('who is on shift tomorrow')).toBe(false)
    expect(parseFactConfirmation('bye')).toBe(false)
    expect(parseFactConfirmation('')).toBe(false)
    expect(parseFactConfirmation('   ')).toBe(false)
  })
})

describe('spoken days and times', () => {
  it('says a day without a year when it is this year', () => {
    expect(formatSpokenDay('2026-10-15', TODAY)).toBe('15 October')
    expect(formatSpokenDay('2027-01-04', TODAY)).toBe('4 January 2027')
  })

  it('formats an instant as UK wall-clock, not UTC', () => {
    // 12 October is BST (UTC+1): the carer's 8am is 07:00Z.
    expect(formatSpokenTime('2026-10-12T07:00:00.000Z')).toBe('8am')
    expect(formatSpokenTime('2026-10-12T07:30:00.000Z')).toBe('8:30am')
    expect(formatSpokenTime('2026-10-12T13:05:00.000Z')).toBe('2:05pm')
    expect(formatSpokenTime('2026-10-12T00:00:00.000Z')).toBe('1am')
    expect(formatSpokenTime(null)).toBeUndefined()
    expect(formatSpokenTime('not a date')).toBeUndefined()
  })
})
