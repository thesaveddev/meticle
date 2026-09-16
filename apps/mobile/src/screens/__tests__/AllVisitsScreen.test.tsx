import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { AllVisitsScreen } from '../AllVisitsScreen'
import { SafeAreaProvider } from 'react-native-safe-area-context'

const safeAreaMetrics = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
import { getAllVisits, getOpenHomecareExceptions } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getAllVisits: jest.fn(),
  getOpenHomecareExceptions: jest.fn(),
}))
jest.mock('../../services/haptics', () => ({ hapticLight: jest.fn() }))

const mockedVisits = getAllVisits as jest.MockedFunction<typeof getAllVisits>
const mockedExceptions = getOpenHomecareExceptions as jest.MockedFunction<typeof getOpenHomecareExceptions>
const session = { accessToken: 'token', refreshToken: 'refresh', user: { id: 'manager', email: 'manager@example.com', role: 'MANAGER' } } as AuthSession

function visit(id: string, status: string, staffId = 'staff-1', staffName = 'Jane Carer') {
  return {
    id, status, assigned_staff_id: staffId, assigned_staff_name: staffName,
    person_name: `Client ${id}`, label: `Call ${id}`,
    scheduled_start: '2026-09-15T09:00:00.000Z', scheduled_end: '2026-09-15T10:00:00.000Z',
  }
}

describe('AllVisitsScreen manager filters', () => {
  beforeEach(() => {
    mockedVisits.mockResolvedValue([visit('missed', 'missed'), visit('done', 'completed')])
    mockedExceptions.mockResolvedValue([])
  })

  afterEach(() => jest.clearAllMocks())

  it('shows a missed call from the recent history when opened on the missed filter', async () => {
    const screen = render(<SafeAreaProvider initialMetrics={safeAreaMetrics}><AllVisitsScreen session={session} initialStatus="missed" onBack={jest.fn()} /></SafeAreaProvider>)

    await waitFor(() => expect(screen.getByText('Client missed')).toBeTruthy())
    expect(screen.getByText('missed')).toBeTruthy()
    expect(mockedVisits).toHaveBeenCalledWith('token', expect.any(String), expect.any(String), undefined)
  })

  it('loads unresolved exception visits from the exceptions endpoint', async () => {
    mockedExceptions.mockResolvedValue([visit('exception', 'cancelled')])
    const screen = render(<SafeAreaProvider initialMetrics={safeAreaMetrics}><AllVisitsScreen session={session} initialStatus="exception" onBack={jest.fn()} /></SafeAreaProvider>)

    await waitFor(() => expect(screen.getByText('Client exception')).toBeTruthy())
    expect(mockedExceptions).toHaveBeenCalledWith('token')
  })

  it('uses staff id filtering for a carer drill-down', async () => {
    const screen = render(<SafeAreaProvider initialMetrics={safeAreaMetrics}><AllVisitsScreen session={session} initialStaffName="Jane Carer" initialStaffId="staff-1" onBack={jest.fn()} /></SafeAreaProvider>)

    await waitFor(() => expect(screen.getByText('Client missed')).toBeTruthy())
    expect(mockedVisits).toHaveBeenCalledWith('token', expect.any(String), expect.any(String), 'staff-1')

    expect(screen.getByText('Showing visits for Jane Carer')).toBeTruthy()
  })
})
