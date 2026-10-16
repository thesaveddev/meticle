import { localDate, localToday, shiftDay } from '../localDay'

/**
 * The mirror of the web suite's cases in
 * `apps/web/src/utils/dateFormat.test.ts`. Two apps, two implementations, the
 * same expectations — so a fix that lands in one and not the other is visible.
 */
describe('localDate', () => {
  it('reads the calendar day from local fields, not the UTC timestamp', () => {
    expect(localDate(new Date(2026, 5, 15, 0, 30))).toBe('2026-06-15')
    expect(localDate(new Date(2026, 5, 15, 23, 30))).toBe('2026-06-15')
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('disagrees with the UTC form at the hour the two differ, and only then', () => {
    // getTimezoneOffset is minutes behind UTC: −60 for BST, +300 for New York.
    const offset = new Date(2026, 5, 15, 0, 30).getTimezoneOffset()
    const early = new Date(2026, 5, 15, 0, 30)
    const late = new Date(2026, 5, 15, 23, 30)

    if (offset < 0) {
      expect(early.toISOString().slice(0, 10)).toBe('2026-06-14')
      expect(localDate(early)).toBe('2026-06-15')
      expect(late.toISOString().slice(0, 10)).toBe('2026-06-15')
    } else if (offset > 0) {
      expect(late.toISOString().slice(0, 10)).toBe('2026-06-16')
      expect(localDate(late)).toBe('2026-06-15')
      expect(early.toISOString().slice(0, 10)).toBe('2026-06-15')
    } else {
      // A device set to UTC cannot tell the two apart, which is why this defect
      // survives every green run in a UTC container.
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
  it('crosses month, year and DST boundaries', () => {
    expect(shiftDay('2026-06-30', 1)).toBe('2026-07-01')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29')
    // British Summer Time begins 29 March 2026 and ends 25 October 2026.
    expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29')
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
