import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { OpenCallsScreen } from '../OpenCallsScreen'
import type { AuthSession } from '../../types'
import * as api from '../../services/api'

jest.mock('../../services/api', () => ({
  getOpenCalls: jest.fn(async () => []),
  claimOpenCall: jest.fn(async () => ({ id: 'a1', shift_id: 's1', status: 'assigned' })),
}))

const mockGetOpenCalls = api.getOpenCalls as jest.MockedFunction<typeof api.getOpenCalls>
const mockClaimOpenCall = api.claimOpenCall as jest.MockedFunction<typeof api.claimOpenCall>

const session: AuthSession = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'me', email: 'me@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

function openCall(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shift-1',
    location_id: 'loc-1',
    location_name: 'Riverside',
    department_name: 'Day team',
    start_time: '2026-02-10T09:00:00.000Z',
    end_time: '2026-02-10T17:00:00.000Z',
    status: 'open',
    shift_type: 'day',
    staff_count: 0,
    assignments: [],
    ...overrides,
  }
}

/** Drives the Alert confirm button, which is how a claim is actually started. */
async function confirmAlert() {
  const spy = jest.spyOn(Alert, 'alert')
  fireEvent.press(screen.getByLabelText('Claim this call'))
  const call = spy.mock.calls[spy.mock.calls.length - 1]
  const buttons = (call?.[2] ?? []) as any[]
  await act(async () => { buttons.find(b => b.text === 'Claim')?.onPress?.() })
  spy.mockRestore()
}

describe('OpenCallsScreen', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('lists the open calls the API returns', async () => {
    mockGetOpenCalls.mockResolvedValueOnce([openCall()] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('Riverside · Day team')).toBeTruthy()
    expect(screen.getByText('8h')).toBeTruthy()
    expect(mockGetOpenCalls).toHaveBeenCalledWith('token-1')
  })

  it('explains when there is nothing to pick up', async () => {
    mockGetOpenCalls.mockResolvedValueOnce([] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('No open calls')).toBeTruthy()
  })

  it('surfaces a load failure instead of showing an empty list', async () => {
    mockGetOpenCalls.mockRejectedValueOnce(new Error('Network unavailable'))

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('Network unavailable')).toBeTruthy()
  })

  it('says the call is theirs when the claim auto-approves', async () => {
    mockGetOpenCalls.mockResolvedValue([openCall()] as any)
    mockClaimOpenCall.mockResolvedValueOnce({ id: 'a1', shift_id: 'shift-1', status: 'assigned', auto_approved: true, requires_approval: false } as any)
    const alerts: string[] = []
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b) => { alerts.push(_t) })

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    await screen.findByText('Riverside · Day team')
    await confirmAlert()

    await waitFor(() => expect(alerts).toContain('Call claimed'))
    expect(mockClaimOpenCall).toHaveBeenCalledWith('token-1', 'shift-1')
  })

  it('says it still needs manager approval when the claim is not auto-approved', async () => {
    mockGetOpenCalls.mockResolvedValue([openCall()] as any)
    mockClaimOpenCall.mockResolvedValueOnce({ id: 'a1', shift_id: 'shift-1', status: 'pending' } as any)
    const alerts: string[] = []
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b) => { alerts.push(_t) })

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    await screen.findByText('Riverside · Day team')
    await confirmAlert()

    await waitFor(() => expect(alerts).toContain('Claim sent'))
  })

  it('shows how many others have already claimed a call', async () => {
    mockGetOpenCalls.mockResolvedValueOnce([openCall({ staff_count: 2 })] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('2 people have already claimed this')).toBeTruthy()
  })
})
