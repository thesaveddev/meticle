import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { TimesheetsScreen } from '../TimesheetsScreen'
import { approveTimesheet, getPendingTimesheets, rejectTimesheet } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getPendingTimesheets: jest.fn(),
  approveTimesheet: jest.fn(),
  rejectTimesheet: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticWarning: jest.fn(),
}))

const mockedList = getPendingTimesheets as jest.MockedFunction<typeof getPendingTimesheets>
const mockedApprove = approveTimesheet as jest.MockedFunction<typeof approveTimesheet>
const mockedReject = rejectTimesheet as jest.MockedFunction<typeof rejectTimesheet>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'manager@example.com', role: 'MANAGER' },
} as AuthSession

const timesheet = {
  timesheet_id: 'ts-1',
  id: 'ts-1',
  staff_name: 'Priya Sharma',
  person_name: 'Grace Roberts',
  visit_label: 'Morning call',
  timesheet_status: 'submitted',
  scheduled_start: '2026-11-03T08:00:00.000Z',
  scheduled_end: '2026-11-03T09:00:00.000Z',
  work_minutes: 60,
  paid_travel_minutes: 10,
  mileage_miles: 3.2,
  gross_pay_pence: 1800,
  tasks_completed: 2,
  tasks_total: 2,
}

function renderScreen() {
  return render(<TimesheetsScreen session={session} onBack={jest.fn()} />)
}

describe('TimesheetsScreen', () => {
  beforeEach(() => {
    mockedList.mockResolvedValue([timesheet] as any)
    mockedApprove.mockResolvedValue({} as any)
    mockedReject.mockResolvedValue({} as any)
  })

  it('lists the timesheets waiting for approval', async () => {
    const { findByText } = renderScreen()

    expect(await findByText('Priya Sharma')).toBeTruthy()
    expect(await findByText(/1 pending review/)).toBeTruthy()
  })

  it('says the load failed instead of showing "All caught up"', async () => {
    // The empty state on this screen ends the approval run: a manager who reads
    // "All caught up" for a rejected request stops looking, and the month does
    // not get paid. So the failure has to look like a failure.
    mockedList.mockRejectedValue(new Error('Could not reach the server'))
    const { findByTestId, findByText, queryByText } = renderScreen()

    expect(await findByTestId('timesheets-error')).toBeTruthy()
    expect(await findByText('Could not load timesheets')).toBeTruthy()
    expect(queryByText('All caught up')).toBeNull()
  })

  it('retries the failed load and then shows the timesheets', async () => {
    mockedList.mockRejectedValueOnce(new Error('Could not reach the server'))
    const { findByTestId, findByText } = renderScreen()

    fireEvent.press(await findByTestId('timesheets-retry'))

    expect(await findByText('Priya Sharma')).toBeTruthy()
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  })

  it('leaves a timesheet unapproved when the approval is rejected, and says why', async () => {
    mockedApprove.mockRejectedValue(new Error('Only a manager can approve timesheets'))
    const { findAllByText, findByTestId, queryByText } = renderScreen()

    const [approveButton] = await findAllByText('Approve')
    fireEvent.press(approveButton)

    expect(await findByTestId('timesheets-action-error')).toBeTruthy()
    // The row must not claim it was approved: the payroll export reads this list.
    expect(queryByText('approved')).toBeNull()
    expect(await findAllByText('Reject')).toBeTruthy()
  })

  it('keeps the reject sheet open with the reason when the rejection fails', async () => {
    mockedReject.mockRejectedValue(new Error('Timesheet was already approved'))
    const { findAllByText, findByText, findByTestId } = renderScreen()

    const [rejectButton] = await findAllByText('Reject')
    fireEvent.press(rejectButton)
    fireEvent.changeText(await findByTestId('timesheets-reject-reason'), 'Hours look wrong')
    fireEvent.press(await findByTestId('timesheets-reject-confirm'))

    expect(await findByTestId('timesheets-reject-error')).toBeTruthy()
    // Still open, reason intact — a failed rejection must not discard what was typed.
    expect(await findByText('Reject Timesheet')).toBeTruthy()
    expect((await findByTestId('timesheets-reject-reason')).props.value).toBe('Hours look wrong')
  })
})
