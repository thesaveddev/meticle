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
    // the round trip.
    expect(parseFactQuestion('Any medication overdue today?', TODAY)).toBeNull()
    expect(parseFactQuestion('how urgent is the Risperidone reorder', TODAY)).toBeNull()
    expect(parseFactQuestion('summarise this month\'s incidents', TODAY)).toBeNull()
    expect(parseFactQuestion('how many incidents this month', TODAY)).toBeNull()
    expect(parseFactQuestion('how is the rota looking today', TODAY)).toBeNull()
    expect(parseFactQuestion('is Grace on shift today', TODAY)).toBeNull()
    expect(parseFactQuestion('how much leave does Priya Sharma have left', TODAY)).toBeNull()
    expect(parseFactQuestion('whose training is expiring soon', TODAY)).toBeNull()
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
