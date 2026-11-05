import { describe, it, expect } from 'vitest'
import { decodeRotaDrag, encodeRotaDrag, resolveRotaDrop } from './dragDrop'

/**
 * A drop is two independent halves — a date move and an assignment move — and
 * the page executes them against different endpoints. Every assertion here is
 * about which halves a drop needs, so a chip put back where it came from
 * issues no calls at all and a drop onto a past day is refused before it
 * reaches the API.
 */

const TODAY = '2026-11-05'

describe('decodeRotaDrag', () => {
  it('round-trips a payload', () => {
    const payload = { shiftId: 's1', fromStaffId: 'staff-a', fromDate: '2026-11-06' }
    expect(decodeRotaDrag(encodeRotaDrag(payload))).toEqual(payload)
  })

  it('rejects garbage without throwing', () => {
    expect(decodeRotaDrag(null)).toBeNull()
    expect(decodeRotaDrag('')).toBeNull()
    expect(decodeRotaDrag('not-json')).toBeNull()
    expect(decodeRotaDrag(JSON.stringify({ shiftId: '', fromDate: '2026-11-06' }))).toBeNull()
    expect(decodeRotaDrag(JSON.stringify({ shiftId: 's1' }))).toBeNull()
    expect(decodeRotaDrag(JSON.stringify({ shiftId: 's1', fromDate: '2026-11-06', fromStaffId: 42 }))).toBeNull()
  })

  it('defaults a missing source staff to null (pure assign)', () => {
    expect(decodeRotaDrag(JSON.stringify({ shiftId: 's1', fromDate: '2026-11-06' }))).toEqual({
      shiftId: 's1',
      fromStaffId: null,
      fromDate: '2026-11-06',
    })
  })
})

describe('resolveRotaDrop', () => {
  it('is a no-op when the chip returns to its own cell', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: 'staff-a', toDate: '2026-11-06', todayStr: TODAY,
    })).toEqual({ moveDate: null, reassignFrom: null, reassignTo: null })
  })

  it('moves only the date when the staff is unchanged', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: 'staff-a', toDate: '2026-11-07', todayStr: TODAY,
    })).toEqual({ moveDate: '2026-11-07', reassignFrom: null, reassignTo: null })
  })

  it('moves only the assignment when the day is unchanged', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: 'staff-b', toDate: '2026-11-06', todayStr: TODAY,
    })).toEqual({ moveDate: null, reassignFrom: 'staff-a', reassignTo: 'staff-b' })
  })

  it('moves both halves when staff and day change together', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: 'staff-b', toDate: '2026-11-08', todayStr: TODAY,
    })).toEqual({ moveDate: '2026-11-08', reassignFrom: 'staff-a', reassignTo: 'staff-b' })
  })

  it('assigns without unassigning when the drop has no source staff', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: null,
      toStaffId: 'staff-b', toDate: '2026-11-06', todayStr: TODAY,
    })).toEqual({ moveDate: null, reassignFrom: null, reassignTo: 'staff-b' })
  })

  it('refuses drops onto past days', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: 'staff-b', toDate: '2026-11-04', todayStr: TODAY,
    })).toEqual({ moveDate: null, reassignFrom: null, reassignTo: null })
  })

  it('refuses drops with no target', () => {
    expect(resolveRotaDrop({
      shiftStartDate: '2026-11-06', fromStaffId: 'staff-a',
      toStaffId: '', toDate: '', todayStr: TODAY,
    })).toEqual({ moveDate: null, reassignFrom: null, reassignTo: null })
  })
})
