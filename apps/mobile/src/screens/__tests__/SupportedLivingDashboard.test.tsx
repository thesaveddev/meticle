import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SupportedLivingDashboard } from '../SupportedLivingDashboard'
import { getDashboardStats, getDashboardTodayRota, getDashboardWidgets } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getDashboardStats: jest.fn(),
  getDashboardWidgets: jest.fn(),
  getDashboardTodayRota: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticMedium: jest.fn(),
}))

const mockedStats = getDashboardStats as jest.MockedFunction<typeof getDashboardStats>
const mockedWidgets = getDashboardWidgets as jest.MockedFunction<typeof getDashboardWidgets>
const mockedRota = getDashboardTodayRota as jest.MockedFunction<typeof getDashboardTodayRota>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'manager@example.com', role: 'MANAGER', first_name: 'Priya' },
  organization: { id: 'org-1', primary_service_type: 'supported_living' },
} as AuthSession

const stats = {
  total_staff: 22,
  compliance_rate: 84.4,
  open_shifts: 3,
  agency_saved: 0,
  active_people: 18,
  staff_on_duty: 7,
  open_incidents: 2,
  locations: 3,
}

const clearWidgets = {
  dbs_expiring_soon: 0,
  training_expiring_soon: 0,
  pending_leave_requests: 0,
  overdue_medications: 0,
  competency_due: 0,
  staff_below_threshold: 0,
  open_severe_incidents: 0,
  satisfaction_avg: 4.2,
  satisfaction_total: 12,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedStats.mockResolvedValue(stats)
  mockedWidgets.mockResolvedValue(clearWidgets)
  mockedRota.mockResolvedValue([])
})

/**
 * The Team tab used to mount the domiciliary dashboard, which asks `/homecare/*`
 * — tables a supported-living provider never writes to. A manager read "0
 * completed, 0 missed, 0% cover" and the app was telling them the service was
 * quiet because it had asked the wrong question.
 */
describe('SupportedLivingDashboard', () => {
  it('shows the service figures rather than an empty visit list', async () => {
    const screen = render(<SupportedLivingDashboard session={session} onNavigate={jest.fn()} />)

    expect(await screen.findByText('84%')).toBeTruthy()
    expect(screen.getByText('7/22')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('Supported living')).toBeTruthy()
  })

  it('lists only what needs attention, and says so plainly when nothing does', async () => {
    const screen = render(<SupportedLivingDashboard session={session} onNavigate={jest.fn()} />)

    expect(await screen.findByText(/Nothing overdue/)).toBeTruthy()
    expect(screen.queryByText('Medication overdue')).toBeNull()
  })

  it('opens the staff list from a compliance row and leaves a row with no screen inert', async () => {
    mockedWidgets.mockResolvedValue({
      ...clearWidgets,
      staff_below_threshold: 3,
      overdue_medications: 2,
    })
    const onNavigate = jest.fn()
    const screen = render(<SupportedLivingDashboard session={session} onNavigate={onNavigate} />)

    fireEvent.press(await screen.findByRole('button', { name: 'Staff below compliance threshold: 3' }))
    expect(onNavigate).toHaveBeenCalledWith('staffDirectory')

    // There is no medication round screen on the phone, so the row is a fact and
    // not a button that would do nothing.
    expect(screen.getByText('Medication overdue')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Medication overdue/ })).toBeNull()
  })

  it("shows today's rota, and says when a shift has nobody on it", async () => {
    mockedRota.mockResolvedValue([
      {
        id: 'shift-1',
        start_time: '2030-01-01T07:00:00.000Z',
        end_time: '2030-01-01T15:00:00.000Z',
        status: 'filled',
        location_name: 'Oak House',
        assigned_staff: 'priya@example.com, sam@example.com',
      },
      {
        id: 'shift-2',
        start_time: '2030-01-01T15:00:00.000Z',
        end_time: '2030-01-01T22:00:00.000Z',
        status: 'open',
        location_name: 'Ash Grove',
        assigned_staff: '',
      },
    ])

    const screen = render(<SupportedLivingDashboard session={session} onNavigate={jest.fn()} />)

    expect(await screen.findByText('Oak House')).toBeTruthy()
    expect(screen.getByText('priya@example.com, sam@example.com')).toBeTruthy()
    expect(screen.getByText('Ash Grove')).toBeTruthy()
    expect(screen.getByText('Nobody rostered')).toBeTruthy()
  })

  it('reports a failed figures load instead of rendering zeroes', async () => {
    mockedStats.mockRejectedValueOnce(new Error('403'))
    mockedStats.mockResolvedValueOnce(stats)

    const screen = render(<SupportedLivingDashboard session={session} onNavigate={jest.fn()} />)

    expect(await screen.findByText('Your figures could not be loaded.')).toBeTruthy()
    // The failure this guards against: an unloaded dashboard reading as a quiet one.
    expect(screen.queryByText('0%')).toBeNull()

    fireEvent.press(screen.getByText('Try again'))
    expect(await screen.findByText('84%')).toBeTruthy()
  })

  it('keeps the figures on screen when only the attention list fails', async () => {
    mockedWidgets.mockRejectedValueOnce(new Error('offline'))

    const screen = render(<SupportedLivingDashboard session={session} onNavigate={jest.fn()} />)

    expect(await screen.findByText('84%')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('What needs attention could not be loaded.')).toBeTruthy())
  })

  it('labels a residential provider as residential', async () => {
    const residential = {
      ...session,
      organization: { id: 'org-2', primary_service_type: 'residential' },
    } as AuthSession

    const screen = render(<SupportedLivingDashboard session={residential} onNavigate={jest.fn()} />)

    expect(await screen.findByText('Residential')).toBeTruthy()
    expect(screen.queryByText('Supported living')).toBeNull()
  })
})
