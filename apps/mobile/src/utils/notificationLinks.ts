/**
 * Where a notification's link should take a carer on the phone.
 *
 * The server stores one relative record path per notification (`micaRecordPath` in
 * `@meticle/shared`) and the web app routes on it. The phone is a smaller app: it has
 * no rota grid and no MAR chart, so a link the web app opens cannot always be opened
 * here. This module is the phone's half of that contract —
 * it decides which of the app's own destinations a link maps to, and admits when the
 * answer is "none of them".
 *
 * The failure mode this exists to prevent is a tap that appears to do nothing. A link
 * that maps nowhere still lands the carer on the notifications screen, where the
 * message that referenced the record is, rather than silently discarding the tap.
 */

/** The app's tab keys, as `App.tsx` names them. */
export type NotificationTab =
  | 'today'
  | 'schedule'
  | 'chat'
  | 'mileage'
  | 'settings'
  | 'team'
  | 'clients'
  | 'visits'

export type NotificationTarget =
  | { kind: 'tab'; tab: NotificationTab }
  /**
   * One shift's handover. The server's shift link carries the shift id in the query
   * (`/scheduling?week=…&shift=…`), and the phone now has a screen for exactly that
   * record — so a handover-due message opens the handover rather than the week view,
   * where the carer would have to find the shift again.
   */
  | { kind: 'handover'; shiftId: string }
  /**
   * The room-check board. The overdue nudge names a room at a location and asks for a
   * check; the phone has that list and that form now, so the message opens the record it
   * is about instead of only reminding the worker to do it on a computer later.
   */
  | { kind: 'roomChecks' }
  /** No native destination: show the screen the message itself lives on. */
  | { kind: 'notifications' }

/** The query parameters of a link, without a dependency on URL parsing. */
function linkQuery(link: string): Record<string, string> {
  const raw = (link || '').trim()
  const start = raw.indexOf('?')
  if (start === -1) return {}
  const params: Record<string, string> = {}
  for (const pair of raw.slice(start + 1).split('#')[0].split('&')) {
    if (!pair) continue
    const [key, value = ''] = pair.split('=')
    try { params[decodeURIComponent(key)] = decodeURIComponent(value) } catch { params[key] = value }
  }
  return params
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** The path of a link, without its query string or a trailing slash. */
export function linkPath(link: string | null | undefined): string {
  const raw = (link || '').trim()
  if (!raw) return ''
  const withoutQuery = raw.split('?')[0].split('#')[0]
  const path = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/**
 * Map a record link to a destination in this app.
 *
 * Only the paths the phone genuinely has are mapped, and a path is matched on the
 * whole segment rather than by prefix: `/scheduling-archive` is not `/scheduling`, and
 * a prefix match would quietly send somebody to the rota for an unrelated record.
 */
export function notificationTarget(link: string | null | undefined): NotificationTarget {
  const path = linkPath(link)
  if (!path) return { kind: 'notifications' }

  switch (path) {
    case '/chat':
      return { kind: 'tab', tab: 'chat' }
    // A shift and its handover are read on the week view, which is the phone's
    // Schedule tab. `/my-week` and `/shifts` are the other spellings of the same
    // place the API and older links use.
    case '/scheduling':
    case '/my-week':
    case '/shifts': {
      // A link that names one shift is about that shift's handover; a malformed id
      // falls back to the week view rather than opening a screen that cannot load.
      const shiftId = linkQuery(link || '').shift || ''
      if (UUID.test(shiftId)) return { kind: 'handover', shiftId }
      return { kind: 'tab', tab: 'schedule' }
    }
    case '/mileage':
    case '/earnings':
      return { kind: 'tab', tab: 'mileage' }
    case '/settings':
      return { kind: 'tab', tab: 'settings' }
    case '/room-checks':
      return { kind: 'roomChecks' }
    default:
      // Compliance, the MAR chart, a resident's profile: the phone has no screen for
      // these, and the message is the useful part of the notification.
      return { kind: 'notifications' }
  }
}

/**
 * What a notification's link points at, in the row's own words.
 *
 * The row has to say where a tap goes before it is tapped, and it has to say it
 * honestly: "Room checks" is a web page, and a carer who taps expecting the phone to
 * open it should not be surprised. `native` is the same answer `notificationTarget`
 * gives, so the label and the navigation cannot disagree.
 */
export interface NotificationAction {
  /** The record's name, as a carer would say it. Empty when the link names nothing. */
  label: string
  /** Whether this app has a screen for it, rather than only a message about it. */
  native: boolean
}

const RECORD_LABELS: Record<string, string> = {
  '/chat': 'Chat',
  '/scheduling': 'the week view',
  '/my-week': 'the week view',
  '/shifts': 'the week view',
  '/mileage': 'earnings',
  '/earnings': 'earnings',
  '/settings': 'settings',
  '/room-checks': 'Room checks',
  '/compliance': 'Compliance',
  '/emedication': 'the medication chart',
  '/incidents': 'Incidents',
  '/people': 'the person record',
  '/tasks': 'Tasks',
  '/leave': 'Leave',
  '/reports': 'Reports',
}

export function notificationAction(link: string | null | undefined): NotificationAction {
  const target = notificationTarget(link)
  if (target.kind === 'handover') return { label: 'the shift handover', native: true }
  if (target.kind === 'roomChecks') return { label: 'Room checks', native: true }
  const path = linkPath(link)
  const label = RECORD_LABELS[path] || ''
  return { label, native: target.kind === 'tab' }
}

/**
 * The tab to actually open, given the tabs this role has.
 *
 * A manager's tab set has no Schedule, so a shift notification for a manager would
 * otherwise set a tab that is not in the bar and leave them on a screen with no way
 * back. The first tab of the role's own set is the honest fallback.
 */
export function resolveTab(target: NotificationTarget, available: readonly string[]): NotificationTab | null {
  if (target.kind !== 'tab') return null
  if (available.includes(target.tab)) return target.tab
  return (available[0] as NotificationTab) || null
}
