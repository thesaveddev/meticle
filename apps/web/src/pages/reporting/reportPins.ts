/**
 * Pinned reports, last-viewed dates and the landing location filter.
 *
 * Figma 10.1 marks pins and "Viewed" dates as new: they are personal
 * shortcuts, so they live in this browser (localStorage) rather than in a
 * shared table — nothing here changes what anyone else sees.
 */

const PINS_KEY = 'reports.pinned'
const VIEWED_KEY = 'reports.viewed'
const LOCATION_KEY = 'reports.location'

/** The three cards Figma pins out of the box, until the reader pins their own. */
export const DEFAULT_PINS = ['staff-by-location', 'mar-compliance', 'incident-summary']

function readArray(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : null
  } catch {
    return null
  }
}

function writeArray(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or a full store: pins quietly do not persist.
  }
}

export function getPinnedReports(): string[] {
  return readArray(PINS_KEY) ?? [...DEFAULT_PINS]
}

export function isPinned(reportId: string): boolean {
  return getPinnedReports().includes(reportId)
}

export function togglePin(reportId: string): string[] {
  const pins = getPinnedReports()
  const next = pins.includes(reportId) ? pins.filter(id => id !== reportId) : [...pins, reportId]
  writeArray(PINS_KEY, next)
  return next
}

type ViewedMap = Record<string, string>

function readViewed(): ViewedMap {
  try {
    const raw = localStorage.getItem(VIEWED_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function recordReportViewed(reportId: string) {
  const viewed = readViewed()
  viewed[reportId] = new Date().toISOString()
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify(viewed))
  } catch {
    // Non-persisted is fine: the date is a convenience, not the record.
  }
}

export function getReportViewedAt(reportId: string): string | null {
  return readViewed()[reportId] ?? null
}

/** "Viewed today", "Viewed yesterday", otherwise "Viewed 28 Oct". */
export function viewedLabel(iso: string | null): string | null {
  if (!iso) return null
  const viewed = new Date(iso)
  if (Number.isNaN(viewed.getTime())) return null
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(viewed)) / 86400000)
  if (days <= 0) return 'Viewed today'
  if (days === 1) return 'Viewed yesterday'
  return `Viewed ${viewed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

/** Landing location filter, reused as the default location filter on details. */
export function getReportsLocation(): string {
  try {
    return localStorage.getItem(LOCATION_KEY) || ''
  } catch {
    return ''
  }
}

export function setReportsLocation(locationId: string) {
  try {
    if (locationId) localStorage.setItem(LOCATION_KEY, locationId)
    else localStorage.removeItem(LOCATION_KEY)
  } catch {
    // Non-persisted is fine.
  }
}
