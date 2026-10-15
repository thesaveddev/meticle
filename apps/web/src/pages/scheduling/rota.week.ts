/**
 * The week a deep link asks for.
 *
 * Why this exists. Mica navigates by pushing a route, and a route for the rota has
 * to say *which* week: "open the rota for next week" is answered by
 * `/scheduling?week=2026-11-02`. Without a parser the page would open whatever week
 * it opens by default and silently ignore the one the carer asked for — a
 * navigation that looks like it worked and took them somewhere else. The parsing
 * lives here, in one small function, so the rules can be tested without rendering a
 * two-thousand-line planner, and so the same rules are decided once.
 *
 * Two details are deliberate.
 *
 * **The day is parsed by hand.** `new Date('2026-11-04')` is parsed as *UTC*
 * midnight, so west of Greenwich it is the third of November locally and the link
 * would open the wrong week for everyone in a negative offset. Splitting the string
 * and building the date from its parts keeps it on the day that was written down.
 *
 * **Nonsense falls back instead of failing.** A hand-edited URL, a truncated paste,
 * or a day the month does not have — `2026-02-31`, which `Date` would roll forward
 * into March — leaves the planner on the week it shows by default rather than on an
 * empty week somewhere unexpected. A carer asked for a page, and the page is still
 * useful; refusing to render it would not be.
 */

/** The only shape accepted, so a partial or padded string cannot be half-read. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The Monday of the week `day` falls in, at local midnight.
 *
 * Sunday belongs to the week that began six days earlier, which is the same rule
 * the planner's own default has always used — a week here starts on Monday.
 */
function mondayOf(day: Date): Date {
  const monday = new Date(day)
  const weekday = monday.getDay()
  monday.setDate(monday.getDate() - weekday + (weekday === 0 ? -6 : 1))
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * The Monday of the week a `?week=` value names, or the Monday of `now`'s week when
 * the value is absent, malformed, or a day that does not exist.
 *
 * `now` is a parameter so the fallback is testable without a clock. The returned
 * date is always a local-midnight Monday: the page mutates it with `setDate(±7)` to
 * page through weeks, and it must not carry a time of day into the API's date range.
 */
export function weekStartFromParam(value: string | null | undefined, now: Date = new Date()): Date {
  const match = typeof value === 'string' ? ISO_DAY.exec(value.trim()) : null
  if (!match) return mondayOf(now)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const parsed = new Date(year, month - 1, day)
  parsed.setHours(0, 0, 0, 0)

  // A day the month does not have rolls forward rather than failing: 31 February
  // becomes 3 March. Checking the parts back is what tells the two apart, and it
  // also catches the two-digit-year case `Date` maps into the 1900s.
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return mondayOf(now)
  }

  return mondayOf(parsed)
}
