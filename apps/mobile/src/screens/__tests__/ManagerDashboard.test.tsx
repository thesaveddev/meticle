import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ManagerDashboard } from '../ManagerDashboard'
import { getManagerDashboard } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({ getManagerDashboard: jest.fn() }))
jest.mock('../../services/haptics', () => ({ hapticLight: jest.fn() }))

const mockedDashboard = getManagerDashboard as jest.MockedFunction<typeof getManagerDashboard>
const session = { accessToken: 'token', refreshToken: 'refresh', user: { id: 'manager', email: 'manager@example.com', role: 'MANAGER', first_name: 'Manager', last_name: 'One' } } as AuthSession

function visit(id: string, status: string, staffName: string, staffId: string) {
  return {
    id, status, assigned_staff_name: staffName, assigned_staff_id: staffId,
    person_name: `Client ${id}`, label: `Call ${id}`,
    scheduled_start: '2026-09-16T09:00:00.000Z', scheduled_end: '2026-09-16T10:00:00.000Z',
  }
}

describe('ManagerDashboard alert navigation', () => {
  beforeEach(() => {
    mockedDashboard.mockResolvedValue({
      visits: [visit('missed-1', 'missed', 'Jane Carer', 'staff-jane'), visit('done-1', 'completed', 'Jane Carer', 'staff-jane')],
      exceptions: [visit('exception-1', 'missed', 'Jane Carer', 'staff-jane'), visit('exception-2', 'cancelled', 'Other Carer', 'staff-other')],
      staff: [], disruptions: [],
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('opens the exception-aware visits view for open exceptions', async () => {
    const onNavigate = jest.fn()
    const screen = render(<ManagerDashboard session={session} onNavigate={onNavigate} />)

    await waitFor(() => expect(screen.getByText('2 open exceptions')).toBeTruthy())
    fireEvent.press(screen.getByText('2 open exceptions'))

    expect(onNavigate).toHaveBeenCalledWith('allVisits', { status: 'exception' })
  })

  it('opens the missed filter when a missed-call alert is selected', async () => {
    const onNavigate = jest.fn()
    const screen = render(<ManagerDashboard session={session} onNavigate={onNavigate} />)

    await waitFor(() => expect(screen.getByText('1 missed call')).toBeTruthy())
    fireEvent.press(screen.getByText('1 missed call'))

    expect(onNavigate).toHaveBeenCalledWith('allVisits', { status: 'missed' })
  })

  it('passes the carer staff id, not just the display name, to drill-down', async () => {
    const onNavigate = jest.fn()
    const screen = render(<ManagerDashboard session={session} onNavigate={onNavigate} />)

    await waitFor(() => expect(screen.getByText('Jane Carer')).toBeTruthy())
    fireEvent.press(screen.getByText('Jane Carer'))

    expect(onNavigate).toHaveBeenCalledWith('allVisits', { staffName: 'Jane Carer', staffId: 'staff-jane' })
  })
})
