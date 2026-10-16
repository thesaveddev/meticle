import { describe, expect, it } from 'vitest'
import { addLocalDays, formatDayOnly, localDate, localToday, shiftDay, toLocalDateTimeInput } from './dateFormat'

/**
 * These exist because `new Date().toISOString().slice(0, 10)` is today in **UTC**,
 * and for a UK care provider that is the wrong day for the first hour of every
 * BST day — the hour a night shift writes its notes and a manager opens the
 * board — and the wrong day in the evening west of UTC. On a UTC machine the two
 * forms agree, which is exactly why the defect survived a green suite: it is
 * invisible for the whole working day.
 */
describe('localDate', () => {
  it('reads the calendar day from local fields, not from the UTC timestamp', () => {
    expect(localDate(new Date(2026, 5, 15, 0, 30))).toBe('2026-06-15')
    expect(localDate(new Date(2026, 5, 15, 23, 30))).toBe('2026-06-15')
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('disagrees with the UTC form at the hour the two differ, and only then', () => {
    // getTimezoneOffset is minutes *behind* UTC: −60 for BST, +300 for New York.
    const offset = new Date(2026, 5, 15, 0, 30).getTimezoneOffset()
    const early = new Date(2026, 5, 15, 0, 30)
    const late = new Date(2026, 5, 15, 23, 30)

    if (offset < 0) {
      // Ahead of UTC (the UK in summer): half past midnight is still the
      // previous day in UTC — the night shift's note lands on yesterday.
      expect(early.toISOString().slice(0, 10)).toBe('2026-06-14')
      expect(localDate(early)).toBe('2026-06-15')
      expect(late.toISOString().slice(0, 10)).toBe('2026-06-15')
    } else if (offset > 0) {
      // Behind UTC: half past eleven at night is already tomorrow in UTC.
      expect(late.toISOString().slice(0, 10)).toBe('2026-06-16')
      expect(localDate(late)).toBe('2026-06-15')
      expect(early.toISOString().slice(0, 10)).toBe('2026-06-15')
    } else {
      // A UTC runner cannot tell the two apart at all — which is why this defect
      // passed every green run.
      expect(early.toISOString().slice(0, 10)).toBe(localDate(early))
      expect(late.toISOString().slice(0, 10)).toBe(localDate(late))
    }
  })

  it('defaults to now, so localToday is a day string', () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(localToday()).toBe(localDate())
  })
})

describe('shiftDay', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDay('2026-06-30', 1)).toBe('2026-07-01')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29') // leap year
  })

  it('steps across both DST transitions without skipping or repeating a day', () => {
    // British Summer Time begins 29 March 2026 and ends 25 October 2026. A
    // local-midnight anchor can fall inside the gap; a midday anchor cannot.
    expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDay('2026-10-24', 1)).toBe('2026-10-25')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('walks a whole month one day at a time, every day distinct', () => {
    const seen = new Set<string>()
    let day = '2026-03-01'
    for (let i = 0; i < 31; i++) {
      seen.add(day)
      day = shiftDay(day, 1)
    }
    expect(seen.size).toBe(31)
    expect(day).toBe('2026-04-01')
  })

  it('leaves anything that is not a day string alone', () => {
    expect(shiftDay('not a date', 1)).toBe('not a date')
  })
})

describe('addLocalDays', () => {
  it('keeps the time of day while moving the calendar day', () => {
    const nine = new Date(2026, 5, 15, 9, 0)
    const next = addLocalDays(nine, 1)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(5)
    expect(next.getDate()).toBe(16)
    expect(next.getHours()).toBe(9)
  })

  it('crosses a DST transition without turning into 08:00 or 10:00', () => {
    const nine = new Date(2026, 2, 28, 9, 0)
    expect(addLocalDays(nine, 1).getHours()).toBe(9)
    expect(localDate(addLocalDays(nine, 1))).toBe('2026-03-29')
  })
})

describe('toLocalDateTimeInput', () => {
  it('fills a datetime-local field from local fields, not from the UTC slice', () => {
    const nine = new Date(2026, 5, 15, 9, 0)
    expect(toLocalDateTimeInput(nine)).toBe('2026-06-15T09:00')
    expect(toLocalDateTimeInput(nine.toISOString())).toBe('2026-06-15T09:00')
    // The value a `datetime-local` control hands back is read as local, so the
    // round trip has to survive: parse what we wrote and get the same instant.
    expect(new Date(toLocalDateTimeInput(nine)).getTime()).toBe(nine.getTime())
  })

  it('pads and refuses rubbish', () => {
    expect(toLocalDateTimeInput(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
    expect(toLocalDateTimeInput('')).toBe('')
    expect(toLocalDateTimeInput(null)).toBe('')
    expect(toLocalDateTimeInput('not a date')).toBe('')
  })
})

describe('formatDayOnly', () => {
  it('names the day it was given, never the neighbouring one', () => {
    expect(formatDayOnly('2026-06-15')).toBe('Mon 15 Jun')
    expect(formatDayOnly('2026-12-31')).toBe('Thu 31 Dec')
    expect(formatDayOnly('2026-01-01')).toBe('Thu 1 Jan')
  })

  it('takes label options and a fallback', () => {
    expect(formatDayOnly('2026-06-15', { day: 'numeric', month: 'long' })).toBe('15 June')
    expect(formatDayOnly(null)).toBe('—')
    expect(formatDayOnly(undefined, undefined, 'none')).toBe('none')
    expect(formatDayOnly('rubbish')).toBe('—')
  })
})
