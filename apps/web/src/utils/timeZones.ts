/**
 * The time zones an organisation can set, and how to label them.
 *
 * The value is an IANA zone name, because that is what both PostgreSQL and the
 * browser resolve; the label beside it is only ever for a human choosing one. The
 * list comes from the browser's own tz database rather than a hand-written set,
 * so a zone added to the world's tz data is selectable without a code change, and
 * a saved value from another device is always a value this one can render.
 */

/**
 * Zones offered when the browser cannot enumerate its own.
 *
 * `Intl.supportedValuesOf` is ES2022 and present in every browser this app
 * supports, but a control that renders an empty list because one runtime lacks a
 * method is a worse failure than a shorter list, so there is a floor. It covers
 * the five nations this product is currently registered for, their nearest
 * neighbours in the EU, and the offsets a UK provider with overseas staff is
 * most likely to need.
 */
export const FALLBACK_TIME_ZONES: string[] = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Helsinki',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'UTC',
]

/** Every zone this device can resolve, sorted, or the fallback list. */
export function availableTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  if (typeof supported === 'function') {
    try {
      const zones = supported('timeZone')
      if (Array.isArray(zones) && zones.length > 0) {
        // `Europe/London` first would be a bigger kindness than alphabetical
        // order, but the list is searched rather than scanned and the ordering
        // has to be predictable for a test to assert against.
        return [...zones].sort((a, b) => a.localeCompare(b))
      }
    } catch {
      /* fall through to the floor below */
    }
  }
  return [...FALLBACK_TIME_ZONES]
}

/** The zone this device is currently in, when it can be determined. */
let deviceZone: string | null | undefined
export function deviceTimeZone(): string | null {
  if (deviceZone !== undefined) return deviceZone
  try {
    deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    deviceZone = null
  }
  return deviceZone
}

/**
 * The current UTC offset of a zone, for example `GMT+1`.
 *
 * Shown beside the name because `Europe/London` and `Europe/Dublin` are two zones
 * a person chooses between for reasons that have nothing to do with their offset,
 * while a provider with an overseas office is choosing on exactly that. `short`
 * is the fallback for a runtime without `shortOffset` — it reports `BST`, which is
 * less useful for comparison but still true.
 */
export function timeZoneOffsetLabel(zone: string, at: Date = new Date()): string {
  for (const style of ['shortOffset', 'short'] as const) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        timeZoneName: style,
        year: 'numeric',
      }).formatToParts(at)
      const offset = parts.find((part) => part.type === 'timeZoneName')?.value
      if (offset) return offset
    } catch {
      /* an unusable zone or style — try the next, then give up quietly */
    }
  }
  return ''
}

/** A zone as a human label: `Europe/London · GMT+1`. */
export function formatTimeZoneLabel(zone: string, at: Date = new Date()): string {
  const offset = timeZoneOffsetLabel(zone, at)
  return offset ? `${zone} · ${offset}` : zone
}

let cachedOptions: Array<{ value: string; label: string }> | null = null

/**
 * The zones as `{ value, label }` pairs, built once per page load.
 *
 * Labels cost an `Intl.DateTimeFormat` each, and there are around four hundred
 * zones: building them inside a render handler runs that four hundred times on
 * every keystroke of the settings form. The offset a label carries only moves
 * twice a year, so once per page load is not a staleness anyone can observe.
 */
export function timeZoneSelectOptions(): Array<{ value: string; label: string }> {
  if (!cachedOptions) {
    cachedOptions = availableTimeZones().map((zone) => ({ value: zone, label: formatTimeZoneLabel(zone) }))
  }
  return cachedOptions
}
