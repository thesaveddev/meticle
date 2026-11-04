import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { CarerTotalsScreen } from '../CarerTotalsScreen'
import {
  approveTimesheet,
  getCarerTimesheetDetail,
  getMonthlyCarerTotals,
  getPendingTimesheets,
  rejectTimesheet,
} from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getMonthlyCarerTotals: jest.fn(),
  getCarerTimesheetDetail: jest.fn(),
  getPendingTimesheets: jest.fn(),
  approveTimesheet: jest.fn(),
  rejectTimesheet: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticWarning: jest.fn(),
}))

const mockedTotals = getMonthlyCarerTotals as jest.MockedFunction<typeof getMonthlyCarerTotals>
const mockedDetail = getCarerTimesheetDetail as jest.MockedFunction<typeof getCarerTimesheetDetail>
const mockedPending = getPendingTimesheets as jest.MockedFunction<typeof getPendingTimesheets>
const mockedApprove = approveTimesheet as jest.MockedFunction<typeof approveTimesheet>
const mockedReject = rejectTimesheet as jest.MockedFunction<typeof rejectTimesheet>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'manager@example.com', role: 'MANAGER' },
} as AuthSession

const total = {
  staff_id: 'staff-1',
  staff_name: 'Priya Sharma',
  visit_count: 12,
  total_work_minutes: 600,
  total_paid_travel_minutes: 90,
  total_mileage_miles: 22.5,
  total_gross_pay_pence: 18000,
  pending_count: 2,
}

const visit = {
  id: 'visit-1',
  timesheet_id: 'ts-1',
  staff_name: 'Priya Sharma',
  person_name: 'Grace Roberts',
  visit_label: 'Morning call',
  timesheet_status: 'submitted',
  status: 'completed',
  scheduled_start: '2026-11-03T08:00:00.000Z',
  scheduled_end: '2026-11-03T09:00:00.000Z',
  work_minutes: 60,
  paid_travel_minutes: 10,
  mileage_miles: 3.2,
  gross_pay_pence: 1800,
}

function renderScreen() {
  return render(<CarerTotalsScreen session={session} onBack={jest.fn()} />)
}

describe('CarerTotalsScreen', () => {
  beforeEach(() => {
    mockedTotals.mockResolvedValue([total] as any)
    mockedDetail.mockResolvedValue([visit] as any)
    mockedPending.mockResolvedValue([visit] as any)
    mockedApprove.mockResolvedValue({} as any)
    mockedReject.mockResolvedValue({} as any)
  })

  it('shows the staff totals for the month', async () => {
    const { findByText } = renderScreen()

    expect(await findByText('Priya Sharma')).toBeTruthy()
    expect(await findByText('12 visits')).toBeTruthy()
  })

  it('does not report "No data for this period" when the totals request failed', async () => {
    mockedTotals.mockRejectedValue(new Error('Could not reach the server'))
    const { findByTestId, findByText, queryByText } = renderScreen()

    expect(await findByTestId('carer-totals-failure')).toBeTruthy()
    expect(await findByText('Could not load carer totals')).toBeTruthy()
    expect(queryByText('No data for this period')).toBeNull()
  })

  it('retries the failed totals load', async () => {
    mockedTotals.mockRejectedValueOnce(new Error('Could not reach the server'))
    const { findByTestId, findByText } = renderScreen()

    fireEvent.press(await findByTestId('carer-totals-retry'))

    expect(await findByText('Priya Sharma')).toBeTruthy()
    await waitFor(() => expect(mockedTotals).toHaveBeenCalledTimes(2))
  })

  it('says the carer detail failed instead of showing "No visits"', async () => {
    // "No visits" for a carer who worked is a payroll dispute waiting to happen:
    // the manager concludes the month is empty and approves nothing.
    mockedDetail.mockRejectedValue(new Error('Could not reach the server'))
    const { findByText, findByTestId, queryByText } = renderScreen()

    fireEvent.press(await findByText('Priya Sharma'))

    expect(await findByTestId('carer-detail-error')).toBeTruthy()
    expect(await findByText(/Could not load this carer/)).toBeTruthy()
    expect(queryByText('No visits')).toBeNull()
  })

  it('says the pending list failed instead of showing "All timesheets reviewed"', async () => {
    mockedPending.mockRejectedValue(new Error('Could not reach the server'))
    const { findByText, findByTestId, queryByText } = renderScreen()

    fireEvent.press(await findByText('2 awaiting approval'))

    expect(await findByTestId('carer-pending-error')).toBeTruthy()
    expect(queryByText('All timesheets reviewed')).toBeNull()
  })

  it('keeps a timesheet in the pending list when its approval fails', async () => {
    mockedApprove.mockRejectedValue(new Error('Only a manager can approve timesheets'))
    const { findAllByText, findByText, findByTestId, queryByText } = renderScreen()

    fireEvent.press(await findByText('2 awaiting approval'))
    const [approveButton] = await findAllByText('Approve')
    fireEvent.press(approveButton)

    expect(await findByTestId('carer-action-error')).toBeTruthy()
    // Still listed, because it is still unapproved.
    expect(queryByText('All timesheets reviewed')).toBeNull()
    expect(await findByText('Morning call')).toBeTruthy()
  })
})
