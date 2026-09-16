import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { MileageScreen } from '../MileageScreen'
import type { AuthSession } from '../../types'
import * as api from '../../services/api'
import * as payslip from '../../services/payslip'

jest.mock('../../services/api', () => ({
  getMyEarnings: jest.fn(async () => null),
}))
jest.mock('../../services/payslip', () => ({
  downloadAndSharePayslip: jest.fn(async () => true),
}))

const mockGetMyEarnings = api.getMyEarnings as jest.MockedFunction<typeof api.getMyEarnings>
const mockDownloadPayslip = payslip.downloadAndSharePayslip as jest.MockedFunction<typeof payslip.downloadAndSharePayslip>

const session: AuthSession = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

interface Earnings {
  summary: Record<string, number>
  visits: any[]
  scheduled: any[]
}

const earnings = (overrides: Partial<Earnings> = {}): Earnings => ({
  summary: {},
  visits: [],
  scheduled: [],
  ...overrides,
})

/** The current pay period, computed independently of the screen's own helper. */
function thisMonthRange() {
  const now = new Date()
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
  }
}

function deferred<T>() {
  let settle!: (value: T) => void
  const promise = new Promise<T>(resolve => { settle = resolve })
  return { promise, settle }
}

async function renderEarnings(payload: Earnings) {
  mockGetMyEarnings.mockResolvedValue(payload)
  const screen = render(<MileageScreen session={session} />)
  await screen.findByText('Earnings')
  return screen
}

beforeEach(() => {
  mockGetMyEarnings.mockResolvedValue(earnings())
  mockDownloadPayslip.mockResolvedValue(true)
})

describe('MileageScreen headline', () => {
  it('leads with the month’s pay and the figures behind it', async () => {
    const screen = await renderEarnings(earnings({
      summary: {
        total_gross_pay_pence: 14725,
        visit_count: 5,
        total_work_minutes: 495,
        total_mileage_miles: 98.2,
      },
    }))

    expect(screen.getByText('Estimated gross pay')).toBeTruthy()
    expect(screen.getByText('£147.25')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('8h 15m')).toBeTruthy()
    expect(screen.getByText('98.2mi')).toBeTruthy()
  })

  it('shows a dash rather than a wrong number before rates are set', async () => {
    const screen = await renderEarnings(earnings({ summary: { total_mileage_miles: 10 } }))

    expect(screen.getByText('10.0mi')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('still renders when the earnings request fails', async () => {
    mockGetMyEarnings.mockRejectedValue(new Error('offline'))

    const screen = render(<MileageScreen session={session} />)

    expect(await screen.findByText('No earnings data')).toBeTruthy()
  })
})

describe('MileageScreen pay breakdown', () => {
  const withRates = () => renderEarnings(earnings({
    summary: {
      hourly_rate_pence: 1500,
      mileage_rate_pence: 45,
      total_work_minutes: 480,
      total_mileage_miles: 20,
      total_paid_travel_minutes: 60,
      total_travel_minutes: 90,
    },
  }))

  it('prices work, mileage and paid travel at the carer’s own rates', async () => {
    const screen = await withRates()

    expect(screen.getByText('Work hours')).toBeTruthy()
    expect(screen.getByText('8h 0m at £15.00/hr')).toBeTruthy()
    expect(screen.getByText('£120.00')).toBeTruthy()

    expect(screen.getByText('20.0 miles at £0.45/mi')).toBeTruthy()
    expect(screen.getByText('£9.00')).toBeTruthy()

    expect(screen.getByText('Travel time (paid)')).toBeTruthy()
    expect(screen.getByText('1h 0m at £15.00/hr')).toBeTruthy()
  })

  it('shows unpaid travel as the difference from paid travel', async () => {
    const screen = await withRates()

    expect(screen.getByText('Travel time (unpaid)')).toBeTruthy()
    expect(screen.getByText('30m')).toBeTruthy()
  })

  it('hides the paid travel rows when the organisation does not pay for travel', async () => {
    const screen = await renderEarnings(earnings({
      summary: { hourly_rate_pence: 1500, total_work_minutes: 60, total_travel_minutes: 90, total_paid_travel_minutes: 0 },
    }))

    expect(screen.queryByText('Travel time (paid)')).toBeNull()
    expect(screen.getByText('Travel time (unpaid)')).toBeTruthy()
    expect(screen.getByText('1h 30m')).toBeTruthy()
  })

  it('states the rates in force and whether travel is paid', async () => {
    const screen = await withRates()

    expect(screen.getByText('Your rates')).toBeTruthy()
    expect(screen.getByText('£0.45/mi')).toBeTruthy()
    expect(screen.getByText('Yes')).toBeTruthy()
  })

  it('projects the rest of the month from what is already booked', async () => {
    const screen = await renderEarnings(earnings({
      summary: { scheduled_count: 6, projected_gross_pay_pence: 21000 },
    }))

    expect(screen.getByText('Upcoming this month')).toBeTruthy()
    expect(screen.getByText('6 scheduled calls')).toBeTruthy()
    expect(screen.getByText('≈ £210.00')).toBeTruthy()
  })
})

describe('MileageScreen call tabs', () => {
  const withCalls = () => renderEarnings(earnings({
    visits: [{
      id: 'v1',
      person_name: 'Margaret',
      label: 'Morning Call',
      status: 'completed',
      scheduled_start: '2026-09-01T09:00:00.000Z',
      work_minutes: 120,
      mileage_miles: 5,
      gross_pay_pence: 3000,
    }],
    scheduled: [{
      id: 's1',
      person_name: 'Bob',
      label: 'Evening Call',
      status: 'scheduled',
      scheduled_start: '2026-09-20T18:00:00.000Z',
      scheduled_end: '2026-09-20T19:00:00.000Z',
      hourly_rate_pence: 1500,
    }],
  }))

  it('counts completed and upcoming calls in the tab labels', async () => {
    const screen = await withCalls()

    expect(screen.getByText('Done (1)')).toBeTruthy()
    expect(screen.getByText('Upcoming (1)')).toBeTruthy()
  })

  it('shows what a completed call was worth, with its time and mileage', async () => {
    const screen = await withCalls()

    fireEvent.press(screen.getByText('Done (1)'))

    expect(screen.getByText('Margaret')).toBeTruthy()
    expect(screen.getByText('2h 0m work')).toBeTruthy()
    expect(screen.getByText('5.0 mi')).toBeTruthy()
    expect(screen.getByText('£30.00')).toBeTruthy()
  })

  it('estimates pay for a call that has not happened yet', async () => {
    const screen = await withCalls()

    fireEvent.press(screen.getByText('Upcoming (1)'))

    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('1h 0m call')).toBeTruthy()
    expect(screen.getByText('Est. pay')).toBeTruthy()
    expect(screen.getByText('£15.00')).toBeTruthy()
  })

  it('says so plainly when the carer has no calls this month', async () => {
    const screen = await renderEarnings(earnings())

    expect(screen.getByText('No earnings data')).toBeTruthy()
    expect(screen.getByText('Your earnings will appear here after you complete calls.')).toBeTruthy()
  })
})

describe('MileageScreen payslip download', () => {
  it('requests this month’s payslip and hands it to the share sheet', async () => {
    const { from, to } = thisMonthRange()
    const screen = await renderEarnings(earnings())

    fireEvent.press(screen.getByText('Download payslip'))

    await waitFor(() => expect(mockDownloadPayslip).toHaveBeenCalledWith('token-1', from, to))
    expect(screen.queryByText('Could not create your payslip. Please try again.')).toBeNull()
    expect(screen.getByText('Download payslip')).toBeTruthy()
  })

  it('shows progress while the payslip is being generated', async () => {
    const pending = deferred<boolean>()
    mockDownloadPayslip.mockReturnValue(pending.promise)

    const screen = await renderEarnings(earnings())
    fireEvent.press(screen.getByText('Download payslip'))

    expect(await screen.findByText('Generating payslip...')).toBeTruthy()
    expect(screen.queryByText('Download payslip')).toBeNull()

    pending.settle(true)

    await waitFor(() => expect(screen.getByText('Download payslip')).toBeTruthy())
  })

  it('tells the carer when the payslip cannot be created', async () => {
    mockDownloadPayslip.mockResolvedValue(false)

    const screen = await renderEarnings(earnings())
    fireEvent.press(screen.getByText('Download payslip'))

    expect(await screen.findByText('Could not create your payslip. Please try again.')).toBeTruthy()
    expect(screen.getByText('Download payslip')).toBeTruthy()
  })

  it('catches a failed download instead of leaving the button spinning', async () => {
    mockDownloadPayslip.mockRejectedValue(new Error('no storage'))

    const screen = await renderEarnings(earnings())
    fireEvent.press(screen.getByText('Download payslip'))

    expect(await screen.findByText('Could not create your payslip. Please try again.')).toBeTruthy()
    expect(screen.getByText('Download payslip')).toBeTruthy()
  })
})
