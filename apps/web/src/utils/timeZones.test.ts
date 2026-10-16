import { describe, it, expect } from 'vitest'
import { availableTimeZones, deviceTimeZone, formatTimeZoneLabel, timeZoneOffsetLabel, timeZoneSelectOptions, FALLBACK_TIME_ZONES } from './timeZones'

describe('time zone options', () => {
  it('offers a real list, including the zones this product is registered for', () => {
    const zones = availableTimeZones()
    expect(zones.length).toBeGreaterThan(0)
    // The five nations the provider registry covers, so the default and the
    // non-UK cases a provider with an overseas office would choose are selectable
    // whatever the runtime can enumerate.
    for (const zone of ['Europe/London', 'Europe/Dublin']) {
      expect(zones).toContain(zone)
    }
    expect(zones).toEqual([...zones].sort((a, b) => a.localeCompare(b)))
    expect(new Set(zones).size).toBe(zones.length)
    for (const zone of zones) {
      expect(typeof zone).toBe('string')
      expect(zone.length).toBeGreaterThan(0)
    }
  })

  it('falls back rather than rendering an empty control when the runtime cannot enumerate zones', () => {
    const original = (Intl as any).supportedValuesOf
    try {
      delete (Intl as any).supportedValuesOf
      expect(availableTimeZones()).toEqual([...FALLBACK_TIME_ZONES])
    } finally {
      if (original) (Intl as any).supportedValuesOf = original
    }
  })

  it('reports the device zone, or nothing at all', () => {
    const device = deviceTimeZone()
    expect(device === null || typeof device === 'string').toBe(true)
  })

  it('labels an offset that does not move, so the label is comparable across zones', () => {
    // India has no DST, so this is the same string on every day of the year —
    // which is exactly why it is the zone to assert against.
    expect(timeZoneOffsetLabel('Asia/Kolkata')).toMatch(/GMT\+5:30/)
    expect(formatTimeZoneLabel('Asia/Kolkata')).toContain('Asia/Kolkata')
    expect(formatTimeZoneLabel('Asia/Kolkata')).toContain('GMT+5:30')
  })

  it('builds the select options once, so a keystroke does not rebuild four hundred formatters', () => {
    const first = timeZoneSelectOptions()
    const second = timeZoneSelectOptions()
    expect(first).toBe(second)
    expect(first.length).toBe(availableTimeZones().length)
    const london = first.find(option => option.value === 'Europe/London')
    expect(london?.label).toContain('Europe/London')
  })

  it('gives back an unusable zone unchanged rather than throwing', () => {
    // The saved value is rendered before it is validated anywhere; a control that
    // throws while displaying what is already stored is worse than one that
    // displays it plainly.
    expect(timeZoneOffsetLabel('Not/AZone')).toBe('')
    expect(formatTimeZoneLabel('Not/AZone')).toBe('Not/AZone')
  })
})
