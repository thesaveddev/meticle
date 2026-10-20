import { describe, expect, it } from 'vitest'
import { categoryLabel } from './alertLabels'

/**
 * The chip on an alert row is the only place an event type becomes words. An event
 * the map does not know falls through as `room_check.overdue`, which is an API
 * identifier, not a label — that is the failure these tests exist to catch, for the
 * supported-living events the room-check and handover sweeps raise.
 */
describe('alert category chip', () => {
  it('names a room check as one', () => {
    expect(categoryLabel('room_check.overdue')).toBe('Room Checks')
  })

  it('files the handover gap with staffing, where the manager looks for it', () => {
    expect(categoryLabel('shift.handover_due')).toBe('Staffing')
    expect(categoryLabel('shift.understaffed')).toBe('Staffing')
  })

  it('still labels the events it already knew', () => {
    expect(categoryLabel('medication.stock_low')).toBe('Medication')
    expect(categoryLabel('dbs.expiring')).toBe('DBS')
    expect(categoryLabel('incident.action_overdue')).toBe('Safety')
  })
})
