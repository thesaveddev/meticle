export function parseDateOnly(value: string | Date): Date {
  const raw = String(value)
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
}

export function formatDateOnly(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const date = parseDateOnly(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A calendar day is a local idea, not a UTC one.
 *
 * `new Date().toISOString().slice(0, 10)` is *today in UTC*. For a UK care
 * provider under BST that is yesterday's date for the first hour of every day —
 * the hour a night shift hands over and records its notes — and west of UTC it
 * is tomorrow's for the last hour of the evening. Anything that names the day a
 * person is recording, looking at or being rostered on has to come from here.
 *
 * A UTC timestamp is still the right thing for an instant (an audit row, a
 * download filename's precise moment); what is wrong is using one to name a day.
 */

/** A Date's calendar day as `YYYY-MM-DD`, in the browser's own timezone. */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today's calendar day as `YYYY-MM-DD`, in the browser's own timezone. */
export const localToday = (): string => localDate()

/**
 * Shift a `YYYY-MM-DD` day by whole days without leaving local time.
 *
 * Anchored at midday on purpose: a local-midnight anchor lands inside a DST
 * transition in some timezones and rounds into the neighbouring day, while
 * midday never does.
 */
export function shiftDay(ymd: string, days: number): string {
  const date = parseDateOnly(ymd)
  if (Number.isNaN(date.getTime())) return ymd
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

/** A Date moved by whole calendar days, keeping its time of day. */
export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const DAY_LABEL: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }

/**
 * A `YYYY-MM-DD` day as a readable label (`Mon 15 Jun`).
 *
 * Parsed as a local day, so `new Date('2026-06-15')` — UTC midnight, which reads
 * as the 14th anywhere west of Greenwich — is never what a label is built from.
 */
export function formatDayOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = DAY_LABEL,
  fallback = '—',
): string {
  if (!value) return fallback
  const date = parseDateOnly(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-GB', options)
}

/**
 * A `datetime-local` input's value for an instant.
 *
 * The control has no timezone: it shows the string and hands back the string,
 * and the browser reads both as the user's own wall clock. So the value has to be
 * built from local fields. `toISOString().slice(0, 16)` is UTC, and for a UK user
 * in summer that shows the appointment an hour earlier — then saves that hour
 * back, so every open-and-save moved the booking by the offset.
 */
export function toLocalDateTimeInput(value?: string | Date | null): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatTimeOnly(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const raw = String(value)
  const clock = raw.match(/^(\d{1,2}):(\d{2})/)
  if (clock) return `${clock[1].padStart(2, '0')}:${clock[2]}`
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? raw.replace(/\.\d+Z?$/i, '').slice(0, 5)
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
