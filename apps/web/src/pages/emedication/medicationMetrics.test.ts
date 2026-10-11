import { describe, expect, it } from 'vitest'
import { countPeopleOnActiveMedication, getMedicationDailyMetrics } from './medicationMetrics'

describe('getMedicationDailyMetrics', () => {
  const date = '2026-10-11'
  const chart = {
    days: [date],
    items: [
      { id: 'scheduled', times: ['08:00', '20:00'], is_active: true, is_prn: false },
      { id: 'prn', times: ['09:00'], is_active: true, is_prn: true },
      { id: 'archived', times: ['10:00'], is_active: false, is_prn: false },
      { id: 'not-started', times: ['11:00'], is_active: true, is_prn: false, start_date: '2026-10-12' },
    ],
    adminMap: {
      scheduled: {
        [date]: [
          { scheduled_time: `${date}T08:00:00`, status: 'given' },
          { scheduled_time: `${date}T20:00:00`, status: 'missed' },
        ],
      },
    },
  }

  it('counts administered, explicitly missed, and due scheduled doses without treating absent records as missed', () => {
    expect(getMedicationDailyMetrics(chart, date)).toEqual({ dueToday: 0, administeredToday: 1, missedToday: 1 })
  })

  it('does not count doses outside medication dates, inactive items, PRN items, or dates outside the chart window', () => {
    expect(getMedicationDailyMetrics(chart, '2026-10-12')).toEqual({ dueToday: 0, administeredToday: 0, missedToday: 0 })
  })
})

describe('countPeopleOnActiveMedication', () => {
  it('counts each active person once only when an active MAR record exists', () => {
    expect(countPeopleOnActiveMedication(
      [{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'c', status: 'inactive' }],
      [
        { person_id: 'a', status: 'active' },
        { person_id: 'a', status: 'active' },
        { person_id: 'b', status: 'archived' },
        { person_id: 'c', status: 'active' },
        { person_id: 'other-org-person', status: 'active' },
      ],
    )).toBe(1)
  })
})
