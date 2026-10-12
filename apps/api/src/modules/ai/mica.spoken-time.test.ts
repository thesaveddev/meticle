import { describe, expect, it } from 'vitest'
import { MICA_TIMEZONE, resolveSpokenTime, zonedWallClockToUtc } from './mica.spoken-time'

/**
 * Mica's spoken times, pinned.
 *
 * Two failure modes are covered here and nothing else is: a phrase whose time
 * was silently dropped (the 9 October phrasing test's "book podiatry" family),
 * and a phrase whose time was resolved against the wrong zone — which is how
 * "tomorrow at 2pm" became a 23:15 appointment. The DST cases are the ones that
 * matter most, because a fixed-offset implementation passes every summer test
 * and then books an hour wrong for the six months of GMT.
 *
 * 2026 UK transitions: clocks go forward 29 March, back 25 October.
 */

const SUMMER_MORNING = new Date('2026-10-12T09:15:00.000Z') // Monday, BST
const WINTER_MORNING = new Date('2026-01-05T09:15:00.000Z') // Monday, GMT

describe('resolveSpokenTime — the phrase the carer actually says', () => {
  it('resolves "tomorrow at 2pm" to the right instant in BST', () => {
    // 14:00 London on 13 October is BST (UTC+1) → 13:00Z.
    expect(resolveSpokenTime('book podiatry for tomorrow at 2pm', SUMMER_MORNING))
      .toBe('2026-10-13T13:00:00.000Z')
  })

  it('resolves the same phrase an hour differently in GMT', () => {
    // 14:00 London on 6 January is GMT (UTC+0) → 14:00Z.
    expect(resolveSpokenTime('book podiatry for tomorrow at 2pm', WINTER_MORNING))
      .toBe('2026-01-06T14:00:00.000Z')
  })

  it('follows the offset when the transition falls between today and tomorrow', () => {
    // Spoken on 24 October (BST), booked for 25 October, the day the clocks go
    // back: the *booked* day's offset is what has to be used, not today's.
    const beforeClocksGoBack = new Date('2026-10-24T09:00:00.000Z')
    expect(resolveSpokenTime('tomorrow at 2pm', beforeClocksGoBack))
      .toBe('2026-10-25T14:00:00.000Z')
    // And the day before that, the following day is still BST.
    expect(resolveSpokenTime('tomorrow at 2pm', new Date('2026-10-23T09:00:00.000Z')))
      .toBe('2026-10-24T13:00:00.000Z')
  })

  it('follows the offset across the spring transition too', () => {
    // Spoken on 28 March (GMT), booked for 29 March, the day the clocks go forward.
    expect(resolveSpokenTime('tomorrow at 2pm', new Date('2026-03-28T09:00:00.000Z')))
      .toBe('2026-03-29T13:00:00.000Z')
    expect(resolveSpokenTime('tomorrow at 2pm', new Date('2026-03-27T09:00:00.000Z')))
      .toBe('2026-03-28T14:00:00.000Z')
  })

  it('reads a 24-hour time, a dotted meridiem and a spoken half hour', () => {
    expect(resolveSpokenTime('podiatry tomorrow at 14:00', SUMMER_MORNING)).toBe('2026-10-13T13:00:00.000Z')
    expect(resolveSpokenTime('podiatry tomorrow at 2.30 p.m.', SUMMER_MORNING)).toBe('2026-10-13T13:30:00.000Z')
    expect(resolveSpokenTime('podiatry for tomorrow at half past two pm', SUMMER_MORNING)).toBe('2026-10-13T13:30:00.000Z')
    expect(resolveSpokenTime('podiatry for tomorrow at quarter past two pm', SUMMER_MORNING)).toBe('2026-10-13T13:15:00.000Z')
    // "quarter to three" is 02:45, so the hour is borrowed from before the named one.
    expect(resolveSpokenTime('podiatry for tomorrow at quarter to three pm', SUMMER_MORNING)).toBe('2026-10-13T13:45:00.000Z')
  })

  it('reads noon and midnight', () => {
    expect(resolveSpokenTime('podiatry tomorrow at noon', SUMMER_MORNING)).toBe('2026-10-13T11:00:00.000Z')
    // Midnight of the 13th in BST is still the evening of the 12th in UTC.
    expect(resolveSpokenTime('podiatry tomorrow at midnight', SUMMER_MORNING)).toBe('2026-10-12T23:00:00.000Z')
  })

  it('is not case sensitive', () => {
    expect(resolveSpokenTime('Book Podiatry Tomorrow At 2PM', SUMMER_MORNING)).toBe('2026-10-13T13:00:00.000Z')
  })
})

describe('resolveSpokenTime — dates', () => {
  it('takes a weekday as its next occurrence, never today', () => {
    // 12 October 2026 is a Monday.
    expect(resolveSpokenTime('podiatry on Friday at 9am', SUMMER_MORNING)).toBe('2026-10-16T08:00:00.000Z')
    // "next Tuesday" takes the very next one, so from a Monday that is tomorrow.
    // The reading that differs by a week is visible in the draft's spoken date
    // before anything is booked, which is why the simple rule is the right one.
    expect(resolveSpokenTime('podiatry next Tuesday at 3pm', SUMMER_MORNING)).toBe('2026-10-13T14:00:00.000Z')
    // The same weekday as today is a week out, not this morning.
    expect(resolveSpokenTime('podiatry on Monday at 9am', SUMMER_MORNING)).toBe('2026-10-19T08:00:00.000Z')
  })

  it('takes a day count, an ordinal and a written month', () => {
    expect(resolveSpokenTime('podiatry in 3 days at 8:30am', SUMMER_MORNING)).toBe('2026-10-15T07:30:00.000Z')
    expect(resolveSpokenTime('podiatry on the 20th at 10am', SUMMER_MORNING)).toBe('2026-10-20T09:00:00.000Z')
    expect(resolveSpokenTime('podiatry on 15 November at 11am', SUMMER_MORNING)).toBe('2026-11-15T11:00:00.000Z')
  })

  it('rolls a passed ordinal or written month into the next one', () => {
    // The 20th has passed when the 21st-relative month rolls over, and 10
    // January is behind us in October.
    const lateOctober = new Date('2026-10-21T09:15:00.000Z')
    expect(resolveSpokenTime('podiatry on the 5th at 10am', lateOctober)).toBe('2026-11-05T10:00:00.000Z')
    expect(resolveSpokenTime('podiatry on 10 January at 10am', lateOctober)).toBe('2027-01-10T10:00:00.000Z')
  })

  it('accepts an explicit ISO day', () => {
    expect(resolveSpokenTime('podiatry on 2026-12-24 at 6pm', SUMMER_MORNING)).toBe('2026-12-24T18:00:00.000Z')
  })

  it('rolls a dated-less time forward a day once it has passed', () => {
    // 15:00 London, "at 2pm" can only mean tomorrow's 2pm.
    const midAfternoon = new Date('2026-10-12T14:00:00.000Z') // 15:00 BST
    expect(resolveSpokenTime('book podiatry at 2pm', midAfternoon)).toBe('2026-10-13T13:00:00.000Z')
  })

  it('leaves a date the speaker gave alone even when it has passed', () => {
    // "today at 2pm" said at 15:00 is the speaker's mistake, and the review card
    // is where it gets caught — silently moving it would hide it.
    const midAfternoon = new Date('2026-10-12T14:00:00.000Z')
    expect(resolveSpokenTime('book podiatry today at 2pm', midAfternoon)).toBe('2026-10-12T13:00:00.000Z')
  })
})

describe('resolveSpokenTime — refusals are answers, not failures', () => {
  it('refuses a bare hour it cannot disambiguate', () => {
    // 02:00 or 14:00? A wrong guess books the wrong appointment, so the caller
    // keeps its clarification instead.
    expect(resolveSpokenTime('book podiatry at 2', SUMMER_MORNING)).toBeUndefined()
    expect(resolveSpokenTime('book podiatry for two', SUMMER_MORNING)).toBeUndefined()
  })

  it('refuses a date with no time of day', () => {
    expect(resolveSpokenTime('book podiatry tomorrow', SUMMER_MORNING)).toBeUndefined()
    expect(resolveSpokenTime('book podiatry on Friday', SUMMER_MORNING)).toBeUndefined()
    expect(resolveSpokenTime('book a podiatry appointment', SUMMER_MORNING)).toBeUndefined()
    expect(resolveSpokenTime('', SUMMER_MORNING)).toBeUndefined()
  })

  it('reads a time without judging whether the utterance is a write', () => {
    // Deliberately narrow: this resolver only turns spoken clock faces into
    // instants. Deciding that a question is not a booking belongs to the settle
    // classifier and the question router, which run before the appointment
    // action is ever reached — a syntactic parser trying to guess at intent is
    // how the two doors ended up disagreeing in the first place.
    expect(resolveSpokenTime('what appointments does Elsie have at 2pm', SUMMER_MORNING)).toBe('2026-10-12T13:00:00.000Z')
  })
})

describe('zonedWallClockToUtc', () => {
  it('converts the same wall-clock to different instants either side of a transition', () => {
    expect(zonedWallClockToUtc({ year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, MICA_TIMEZONE).toISOString())
      .toBe('2026-06-01T08:00:00.000Z')
    expect(zonedWallClockToUtc({ year: 2026, month: 12, day: 1, hour: 9, minute: 0 }, MICA_TIMEZONE).toISOString())
      .toBe('2026-12-01T09:00:00.000Z')
  })

  it('settles the ambiguous hour onto its later reading, and says so', () => {
    // 01:30 on 25 October 2026 happens twice: 00:30Z (the last BST minute) and
    // 01:30Z (GMT). The naive guess is already past the change, so the second
    // pass lands on the later one — pinned here because "pick whichever" would
    // mean the same utterance booked two different instants on two runs.
    const instant = zonedWallClockToUtc({ year: 2026, month: 10, day: 25, hour: 1, minute: 30 }, MICA_TIMEZONE)
    expect(instant.toISOString()).toBe('2026-10-25T01:30:00.000Z')
    expect(new Intl.DateTimeFormat('en-GB', {
      timeZone: MICA_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(instant)).toBe('01:30')
  })
})
