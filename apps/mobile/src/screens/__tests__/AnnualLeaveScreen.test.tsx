import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AnnualLeaveScreen } from '../AnnualLeaveScreen'
import * as api from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getLeaveTypes: jest.fn(async () => [{ id: 'annual', name: 'Annual leave' }]),
  getLeaveBalances: jest.fn(async () => [{ leave_type_id: 'annual', leave_type_name: 'Annual leave', year: 2026, days_remaining: 18, duration_type: 'days' }]),
  getMyLeaveRequests: jest.fn(async () => [{ id: 'request-1', leave_type_name: 'Annual leave', start_date: '2026-10-12', end_date: '2026-10-16', status: 'pending', reason: 'Family trip' }]),
  cancelLeaveRequest: jest.fn(async () => ({})),
  createLeaveRequest: jest.fn(async () => ({})),
}))

const session: AuthSession = {
  accessToken: 'token', refreshToken: 'refresh',
  user: { id: 'carer-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

const mockGetRequests = api.getMyLeaveRequests as jest.MockedFunction<typeof api.getMyLeaveRequests>

describe('AnnualLeaveScreen', () => {
  it('opens on applied leave and shows the request status first', async () => {
    const screen = render(<AnnualLeaveScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Family trip')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('YOUR APPLICATIONS')).toBeTruthy()
    expect(screen.getByText('pending')).toBeTruthy()
    expect(screen.queryByText('NEW REQUEST')).toBeNull()
    expect(mockGetRequests).toHaveBeenCalledWith('token')
  })

  it('opens the application form separately', async () => {
    const screen = render(<AnnualLeaveScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Applied leave')).toBeTruthy(), { timeout: 5000 })
    fireEvent.press(screen.getByText('Apply for leave'))
    expect(screen.getByText('NEW REQUEST')).toBeTruthy()
    expect(screen.getByText('Submit leave request')).toBeTruthy()
  })

})
