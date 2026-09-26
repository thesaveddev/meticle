import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { OpenCallsScreen } from '../OpenCallsScreen'
import type { AuthSession } from '../../types'
import * as api from '../../services/api'

jest.mock('../../services/api', () => ({
  getOpenCalls: jest.fn(async () => []),
  getMyOpenCallClaims: jest.fn(async () => []),
  claimOpenCall: jest.fn(async () => ({ id: 'a1', shift_id: 's1', status: 'assigned' })),
}))

const mockGetOpenCalls = api.getOpenCalls as jest.MockedFunction<typeof api.getOpenCalls>
const mockGetMyOpenCallClaims = api.getMyOpenCallClaims as jest.MockedFunction<typeof api.getMyOpenCallClaims>
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

/** A claim as `GET /shifts/my-claims` returns it. */
function claim(overrides: Record<string, unknown> = {}) {
  return {
    assignment_id: 'assign-1',
    assignment_status: 'pending',
    claimed_at: '2026-02-01T10:00:00.000Z',
    is_overtime: true,
    shift_id: 'shift-1',
    start_time: '2026-02-10T09:00:00.000Z',
    end_time: '2026-02-10T17:00:00.000Z',
    shift_status: 'pending',
    shift_type: 'day',
    location_name: 'Riverside',
    department_name: 'Day team',
    su_first_name: 'Amy',
    su_last_name: 'Adams',
    staff_id: 'staff-1',
    first_name: 'Test',
    last_name: 'Carer',
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

describe('OpenCallsScreen my claims', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('shows each claim with the status the backend gave it', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([
      claim({ assignment_id: 'a1', assignment_status: 'pending' }),
      claim({ assignment_id: 'a2', assignment_status: 'assigned', claimed_at: '2026-02-02T10:00:00.000Z' }),
      claim({ assignment_id: 'a3', assignment_status: 'rejected', claimed_at: '2026-02-03T10:00:00.000Z' }),
    ] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (3)'))

    // Every status is spelled the way the web claims page spells it, so the
    // same claim is not called something different depending on the device.
    expect(await screen.findByText('Pending')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getByText('Rejected')).toBeTruthy()
    expect(screen.getByText(/Waiting on your manager to approve/)).toBeTruthy()
    expect(screen.getByText(/Added to your schedule/)).toBeTruthy()
    expect(screen.getByText(/Not approved/)).toBeTruthy()
    expect(mockGetMyOpenCallClaims).toHaveBeenCalledWith('token-1')
  })

  it('counts each status so a held claim is obvious', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([
      claim({ assignment_id: 'a1', assignment_status: 'pending' }),
      claim({ assignment_id: 'a2', assignment_status: 'assigned' }),
      claim({ assignment_id: 'a3', assignment_status: 'assigned' }),
    ] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (3)'))

    expect(await screen.findByText('Pending (1)')).toBeTruthy()
    expect(screen.getByText('Approved (2)')).toBeTruthy()
  })

  it('filters to one status', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([
      claim({ assignment_id: 'a1', assignment_status: 'pending' }),
      claim({ assignment_id: 'a2', assignment_status: 'assigned' }),
    ] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (2)'))
    await screen.findByText('Pending (1)')

    fireEvent.press(screen.getByText('Pending (1)'))

    await waitFor(() => expect(screen.queryByText(/Added to your schedule/)).toBeNull())
    expect(screen.getByText(/Waiting on your manager to approve/)).toBeTruthy()
  })

  it('explains an empty claims history', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims'))

    expect(await screen.findByText('No claims yet')).toBeTruthy()
  })

  it('marks a call the worker already claimed instead of offering it again', async () => {
    mockGetOpenCalls.mockResolvedValue([openCall()] as any)
    mockGetMyOpenCallClaims.mockResolvedValue([claim({ assignment_status: 'pending' })] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    expect(await screen.findByText('Riverside · Day team')).toBeTruthy()

    // Claiming again would only earn a 409, so the button is gone and the
    // status of the existing claim takes its place.
    expect(screen.getByText('Waiting on your manager')).toBeTruthy()
    expect(screen.queryByLabelText('Claim this call')).toBeNull()
  })

  it('re-offers a call whose claim was rejected', async () => {
    mockGetOpenCalls.mockResolvedValue([openCall()] as any)
    mockGetMyOpenCallClaims.mockResolvedValue([claim({ assignment_status: 'rejected' })] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    expect(await screen.findByText('Riverside · Day team')).toBeTruthy()

    expect(screen.getByLabelText('Claim this call')).toBeTruthy()
  })
})
