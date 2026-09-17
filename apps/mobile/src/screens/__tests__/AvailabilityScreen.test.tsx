import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AvailabilityScreen } from '../AvailabilityScreen'
import * as api from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getMyAvailability: jest.fn(async () => []),
  getMyLeaveRequests: jest.fn(async () => []),
  addAvailability: jest.fn(async () => ({})),
  deleteAvailability: jest.fn(async () => ({})),
}))
jest.mock('../../services/haptics', () => ({ hapticLight: jest.fn(), hapticMedium: jest.fn(), hapticWarning: jest.fn() }))

const session: AuthSession = {
  accessToken: 'token', refreshToken: 'refresh',
  user: { id: 'carer-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

const mockGetAvailability = api.getMyAvailability as jest.MockedFunction<typeof api.getMyAvailability>

describe('AvailabilityScreen calendar', () => {
  beforeEach(() => mockGetAvailability.mockResolvedValue([]))

  it('shows a bounded calendar instead of a manual date field', async () => {
    const screen = render(<AvailabilityScreen session={session} />)
    await waitFor(() => expect(screen.getByText('THIS WEEK')).toBeTruthy())
    fireEvent.press(screen.getByText('Submit availability'))
    expect(screen.getByText('Choose a date')).toBeTruthy()
    expect(screen.getByLabelText('Next month')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/YYYY-MM-DD/)).toBeNull()
  })

  it('shows leave context when the carer has pending or approved leave', async () => {
    mockGetAvailability.mockResolvedValue([{ id: 'slot-1', staff_id: 'carer-1', day_of_week: 1, start_time: '09:00:00.000Z', end_time: '17:00:00.000Z', is_available: true }])
    ;(api.getMyLeaveRequests as jest.Mock).mockResolvedValue([{ id: 'leave-1', start_date: '2026-10-12', end_date: '2026-10-16', status: 'approved' }])
    const screen = render(<AvailabilityScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Booked time away')).toBeTruthy())
    expect(screen.getByText(/12 Oct 2026/)).toBeTruthy()
    expect(screen.getByText('09:00 – 17:00')).toBeTruthy()
  })

  it('builds a batch and submits multiple dates together', async () => {
    const addAvailability = api.addAvailability as jest.MockedFunction<typeof api.addAvailability>
    addAvailability.mockClear()
    const screen = render(<AvailabilityScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Submit availability')).toBeTruthy())
    fireEvent.press(screen.getByText('Submit availability'))
    const dateButtons = screen.getAllByRole('button')
    const selectableDate = dateButtons.find(button => button.props.accessibilityState?.disabled === false && String(button.props.accessibilityLabel || '').match(/^20/))
    expect(selectableDate).toBeTruthy()
    fireEvent.press(selectableDate!)
    fireEvent.press(screen.getByText('Add to submission'))
    expect(screen.getByText('Ready to submit')).toBeTruthy()
    expect(screen.getByText('Submit 1 entry')).toBeTruthy()
    fireEvent.press(screen.getByText('Submit 1 entry'))
    await waitFor(() => expect(addAvailability).toHaveBeenCalled())
    expect(addAvailability.mock.calls[0][5]).toMatch(/^20/)
  })

  it('selects a calendar date for a dated availability submission', async () => {
    const screen = render(<AvailabilityScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Schedule')).toBeTruthy())
    fireEvent.press(screen.getByText('Submit availability'))
    expect(screen.getByText('Choose a date')).toBeTruthy()
    const dateButtons = screen.getAllByRole('button')
    const selectableDate = dateButtons.find(button => button.props.accessibilityState?.disabled === false && String(button.props.accessibilityLabel || '').match(/^20/))
    expect(selectableDate).toBeTruthy()
    fireEvent.press(selectableDate!)
    expect(screen.getByText(/Selected/)).toBeTruthy()
  })
})
