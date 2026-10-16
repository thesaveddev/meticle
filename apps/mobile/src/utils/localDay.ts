/**
 * A calendar day is the carer's own day, not UTC's.
 *
 * `new Date().toISOString().split('T')[0]` reads as "today" and is today in
 * **UTC**. On a UK phone in summer that is yesterday's date between 00:00 and
 * 01:00 — the hour a night shift logs its notes, its medicines and its meals —
 * and west of UTC it is tomorrow's late in the evening. The web app has the same
 * helper (`apps/web/src/utils/dateFormat.ts`) and the same reasoning; the two apps
 * do not share a package yet, so the cases each one is tested against mirror the
 * other's.
 *
 * There is a second reason this matters on mobile beyond the date on a record:
 * the API's day ranges are `^\d{4}-\d{2}-\d{2}$`. Sending it a full ISO timestamp
 * is not a day boundary — it fails validation outright, which is how the pay
 * screen came to show "No earnings data" to every carer (see `MileageScreen`).
 */

/** A Date's calendar day as `YYYY-MM-DD`, in the device's own timezone. */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today's calendar day as `YYYY-MM-DD`, in the device's own timezone. */
export const localToday = (): string => localDate()

/**
 * A local midnight→local-midnight day as `YYYY-MM-DD:YYYY-MM-DD` bounds is not
 * what the API wants, so this is the only day arithmetic mobile needs.
 *
 * Anchored at midday so a DST transition cannot skip or repeat a day.
 */
export function shiftDay(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!match) return ymd
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  if (Number.isNaN(date.getTime())) return ymd
  date.setDate(date.getDate() + days)
  return localDate(date)
}
