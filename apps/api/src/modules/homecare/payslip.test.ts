import { describe, it, expect } from 'vitest'
import { monthBounds, previousPeriod, periodLabel, summariseEarnings } from './payslip.service'
import { buildPayslipHtml, type PayslipData } from './payslip.pdf'

describe('payslip period helpers', () => {
  it('builds calendar month bounds inclusive of the final day', () => {
    expect(monthBounds(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthBounds(2024, 1)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthBounds(2026, 8)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('treats the pay period as the month that has just closed, across a year boundary', () => {
    expect(previousPeriod(new Date('2026-03-15T00:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28', label: 'February 2026' })
    expect(previousPeriod(new Date('2026-01-05T00:00:00Z')).from).toBe('2025-12-01')
    expect(previousPeriod(new Date('2026-01-05T00:00:00Z')).to).toBe('2025-12-31')
  })

  it('labels a period from its first day', () => {
    expect(periodLabel('2026-02-01')).toBe('February 2026')
    expect(periodLabel('2026-02-01T00:00:00.000Z')).toBe('February 2026')
  })
})

describe('summariseEarnings', () => {
  it('totals timesheet rows and takes the carer rates from the rows', () => {
    const summary = summariseEarnings([
      { work_minutes: 60, paid_travel_minutes: 20, travel_minutes: 30, mileage_miles: '4.2', hourly_rate_pence: 1500, mileage_rate_pence: 45, gross_pay_pence: 1700 },
      { work_minutes: 30, paid_travel_minutes: 0, travel_minutes: 10, mileage_miles: 4.2, hourly_rate_pence: 1500, mileage_rate_pence: 45, gross_pay_pence: 850 },
    ])

    expect(summary).toEqual({
      total_work_minutes: 90,
      total_paid_travel_minutes: 20,
      total_travel_minutes: 40,
      total_mileage_miles: 8.4,
      total_gross_pay_pence: 2550,
      hourly_rate_pence: 1500,
      mileage_rate_pence: 45,
      visit_count: 2,
    })
  })

  it('returns zeroed totals and no rates for a period with no calls', () => {
    const summary = summariseEarnings([])
    expect(summary.visit_count).toBe(0)
    expect(summary.total_gross_pay_pence).toBe(0)
    expect(summary.hourly_rate_pence).toBeNull()
  })
})

describe('payslip document', () => {
  const data: PayslipData = {
    orgName: 'Clean Care <Ltd>',
    userName: 'Opeyemi Test',
    userEmail: 'carer@example.test',
    periodFrom: '2026-02-01',
    periodTo: '2026-02-28',
    periodLabel: 'February 2026',
    summary: {
      total_gross_pay_pence: 3450,
      total_work_minutes: 120,
      total_paid_travel_minutes: 0,
      total_mileage_miles: 10,
      hourly_rate_pence: 1500,
      mileage_rate_pence: 45,
      visit_count: 1,
    },
    ytd: {
      year: 2026,
      total_gross_pay_pence: 123456,
      total_work_minutes: 480,
      total_mileage_miles: 32.5,
      visit_count: 4,
      months: [{ month: '2026-01', gross_pay_pence: 120006, work_minutes: 360, mileage_miles: 22.5, visit_count: 3 }],
    },
    visits: [
      { scheduled_start: '2026-02-10T09:00:00Z', person_name: 'Ada Client', label: 'Morning call', work_minutes: 120, paid_travel_minutes: 0, mileage_miles: 10, gross_pay_pence: 3450 },
    ],
  }

  it('shows the period pay breakdown and the rates it was calculated from', () => {
    const html = buildPayslipHtml(data)
    expect(html).toContain('Payslip')
    expect(html).toContain('February 2026')
    expect(html).toContain('Work hours (2h 0m at £15.00/hr)')
    expect(html).toContain('Mileage (10.0 mi at £0.45/mi)')
    expect(html).toContain('£34.50')
    expect(html).toContain('Ada Client')
  })

  it('shows every month of the year with a year-to-date total', () => {
    const html = buildPayslipHtml(data)
    expect(html).toContain('Year to date — 2026')
    expect(html).toContain('January 2026')
    expect(html).toContain('Total 2026 to date')
    expect(html).toContain('£1234.56')
  })

  it('escapes organisation and client supplied text', () => {
    const html = buildPayslipHtml(data)
    expect(html).toContain('Clean Care &lt;Ltd&gt;')
    expect(html).not.toContain('<Ltd>')
  })
})
