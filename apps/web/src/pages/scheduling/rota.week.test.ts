import { describe, expect, it } from 'vitest'
import { weekStartFromParam } from './rota.week'

/**
 * The `?week=` deep link, pinned.
 *
 * Two properties matter and nothing else is asserted: the week a written-down day
 * belongs to is read the way a person means it (a Monday is its own Monday, a
 * Sunday belongs to the week that began six days earlier), and anything that is not
 * a real day leaves the planner on this week rather than somewhere else.
 *
 * 4 November 2026 is a Wednesday and the Monday of its week is the 2nd, so that is
 * the fixed `now` the fallbacks are asserted against. Assertions are on local date
 * parts, never on ISO strings: a string is what the bug this file guards against
 * was made of.
 */
const WEDNESDAY = new Date(2026, 10, 4)

const localDay = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]

describe('weekStartFromParam', () => {
  it('opens the week a Monday names, reading it locally rather than as UTC midnight', () => {
    // A Monday is the discriminating case: parsed from UTC midnight, a negative
    // offset reads this string as Sunday the 1st and opens the *previous* week.
    // The parse is manual precisely so it stays on the 2nd.
    expect(localDay(weekStartFromParam('2026-11-02'))).toEqual([2026, 11, 2])
  })

  it('snaps a mid-week day back to its Monday', () => {
    expect(localDay(weekStartFromParam('2026-11-04'))).toEqual([2026, 11, 2])
  })

  it('puts a Sunday in the week that began six days earlier', () => {
    // The off-by-one every week grid gets wrong once: Sunday is the *end* of a
    // Monday-to-Sunday week, not the start of the next one.
    expect(localDay(weekStartFromParam('2026-11-08'))).toEqual([2026, 11, 2])
  })

  it('opens the following week for a day in it', () => {
    expect(localDay(weekStartFromParam('2026-11-09'))).toEqual([2026, 11, 9])
  })

  it('falls back to this week when the route names no week', () => {
    for (const value of [null, undefined, '', '   ']) {
      expect(localDay(weekStartFromParam(value, WEDNESDAY)), `param ${JSON.stringify(value)}`).toEqual([2026, 11, 2])
    }
  })

  it('falls back rather than inventing a week from a malformed value', () => {
    for (const value of [
      'not-a-date',
      '2026-13-01', // no thirteenth month
      '2026-02-31', // a day February does not have, which Date would roll into March
      '2026-11-4', // not the shape the link writes
      '2026-11-04T00:00:00Z', // a full timestamp is not a day
      '04/11/2026',
    ]) {
      expect(localDay(weekStartFromParam(value, WEDNESDAY)), `param ${value}`).toEqual([2026, 11, 2])
    }
  })

  it('returns local midnight, so a week can be paged by whole days', () => {
    const monday = weekStartFromParam('2026-11-04')
    expect([monday.getHours(), monday.getMinutes(), monday.getSeconds(), monday.getMilliseconds()]).toEqual([0, 0, 0, 0])

    // The page pages with `setDate(±7)`; a time of day can skip a date across a
    // daylight-saving boundary, so midnight is load-bearing rather than tidy.
    const nextWeek = new Date(monday)
    nextWeek.setDate(nextWeek.getDate() + 7)
    expect(localDay(nextWeek)).toEqual([2026, 11, 9])
  })

  it('falls back to a local-midnight Monday too', () => {
    const fallback = weekStartFromParam(null, WEDNESDAY)
    expect([fallback.getHours(), fallback.getMinutes()]).toEqual([0, 0])
    expect(fallback.getDay()).toBe(1)
  })
})
