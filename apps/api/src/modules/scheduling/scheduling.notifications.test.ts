import { describe, it, expect } from 'vitest'

function previewWindow(now: Date, start: Date, minHours = 2, maxHours = 4) {
  const leadHours = (start.getTime() - now.getTime()) / 3600000
  return leadHours >= minHours && leadHours <= maxHours
}

describe('Shift preview delivery window', () => {
  const now = new Date('2026-08-30T10:00:00Z')

  it('allows a shift starting three hours from now', () => {
    expect(previewWindow(now, new Date('2026-08-30T13:00:00Z'))).toBe(true)
  })

  it('does not send a day early', () => {
    expect(previewWindow(now, new Date('2026-08-31T10:00:00Z'))).toBe(false)
  })

  it('does not send immediately before the shift', () => {
    expect(previewWindow(now, new Date('2026-08-30T11:00:00Z'))).toBe(false)
  })

  it('does not send after the four-hour window', () => {
    expect(previewWindow(now, new Date('2026-08-30T14:01:00Z'))).toBe(false)
  })
})
