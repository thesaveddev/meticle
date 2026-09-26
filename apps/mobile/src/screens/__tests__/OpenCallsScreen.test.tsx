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
  withdrawOpenCallClaim: jest.fn(async () => ({ id: 'a1', shift_id: 's1', status: 'rejected' })),
  getPendingOpenCallClaims: jest.fn(async () => []),
  approveOpenCallClaim: jest.fn(async () => ({ id: 'a1', status: 'assigned' })),
  rejectOpenCallClaim: jest.fn(async () => ({ id: 'a1', status: 'rejected' })),
}))

const mockGetOpenCalls = api.getOpenCalls as jest.MockedFunction<typeof api.getOpenCalls>
const mockGetMyOpenCallClaims = api.getMyOpenCallClaims as jest.MockedFunction<typeof api.getMyOpenCallClaims>
const mockClaimOpenCall = api.claimOpenCall as jest.MockedFunction<typeof api.claimOpenCall>
const mockWithdrawOpenCallClaim = api.withdrawOpenCallClaim as jest.MockedFunction<typeof api.withdrawOpenCallClaim>
const mockGetPendingOpenCallClaims = api.getPendingOpenCallClaims as jest.MockedFunction<typeof api.getPendingOpenCallClaims>
const mockApproveOpenCallClaim = api.approveOpenCallClaim as jest.MockedFunction<typeof api.approveOpenCallClaim>
const mockRejectOpenCallClaim = api.rejectOpenCallClaim as jest.MockedFunction<typeof api.rejectOpenCallClaim>

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

/* ─── Withdrawing a claim ──────────────────────────────────── */

describe('OpenCallsScreen withdrawing a claim', () => {
  it('offers to withdraw only a claim still waiting on a manager', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([
      claim({ assignment_id: 'a-pending', shift_id: 'shift-1', assignment_status: 'pending' }),
      claim({ assignment_id: 'a-approved', shift_id: 'shift-2', assignment_status: 'assigned' }),
      claim({ assignment_id: 'a-rejected', shift_id: 'shift-3', assignment_status: 'rejected' }),
    ] as any)

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (3)'))

    const withdraw = await screen.findByText('Withdraw claim')
    expect(withdraw).toBeTruthy()
    // Once approved the worker is rostered on, so there is nothing to withdraw.
    expect(screen.getAllByText('Withdraw claim')).toHaveLength(1)
  })

  it('confirms, then withdraws and reloads', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([claim({ shift_id: 'shift-1' })] as any)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const withdraw = (buttons || []).find(button => button.text === 'Withdraw')
      withdraw?.onPress?.()
    })

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (1)'))
    fireEvent.press(await screen.findByText('Withdraw claim'))

    expect(alertSpy).toHaveBeenCalled()
    await waitFor(() => expect(mockWithdrawOpenCallClaim).toHaveBeenCalledWith('token-1', 'shift-1'))
    alertSpy.mockRestore()
  })

  it('says why when the manager got there first', async () => {
    mockGetMyOpenCallClaims.mockResolvedValue([claim({ shift_id: 'shift-1' })] as any)
    mockWithdrawOpenCallClaim.mockRejectedValueOnce(new Error('This claim has already been approved or withdrawn'))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const withdraw = (buttons || []).find(button => button.text === 'Withdraw')
      withdraw?.onPress?.()
    })

    render(<OpenCallsScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('My claims (1)'))
    fireEvent.press(await screen.findByText('Withdraw claim'))

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Could not withdraw',
      'This claim has already been approved or withdrawn',
    ))
    alertSpy.mockRestore()
  })
})

/* ─── The manager's side ───────────────────────────────────── */

describe('OpenCallsScreen for a manager', () => {
  const managerSession: AuthSession = {
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    user: { id: 'boss', email: 'boss@example.com', role: 'MANAGER', first_name: 'Boss', last_name: 'Manager' },
  }

  function pendingClaim(overrides: Record<string, unknown> = {}) {
    return {
      assignment_id: 'assign-9',
      assignment_status: 'pending',
      claimed_at: '2026-02-01T10:00:00.000Z',
      shift_id: 'shift-9',
      start_time: '2026-02-10T09:00:00.000Z',
      end_time: '2026-02-10T17:00:00.000Z',
      shift_status: 'open',
      shift_type: 'day',
      location_id: 'loc-9',
      location_name: 'Riverside',
      su_first_name: 'Eileen',
      su_last_name: 'Fairweather',
      staff_id: 'staff-9',
      first_name: 'Rosa',
      last_name: 'Mendes',
      ...overrides,
    }
  }

  it('shows the claims waiting on them, not the marketplace', async () => {
    mockGetPendingOpenCallClaims.mockResolvedValue([pendingClaim()] as any)

    render(<OpenCallsScreen session={managerSession} onBack={jest.fn()} />)

    expect(await screen.findByText('Rosa Mendes')).toBeTruthy()
    expect(screen.getByText('For Eileen Fairweather')).toBeTruthy()
    // A manager must not be offered shifts to claim.
    expect(screen.queryByText('Claim this call')).toBeNull()
    expect(mockGetOpenCalls).not.toHaveBeenCalled()
  })

  it('approves a claim, confirming first and telling the worker', async () => {
    mockGetPendingOpenCallClaims.mockResolvedValue([pendingClaim()] as any)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const approve = (buttons || []).find(button => button.text === 'Approve')
      approve?.onPress?.()
    })

    render(<OpenCallsScreen session={managerSession} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByLabelText('Approve the claim from Rosa Mendes'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Approve this claim?',
      expect.stringContaining('They are notified straight away.'),
      expect.anything(),
    )
    await waitFor(() => expect(mockApproveOpenCallClaim).toHaveBeenCalledWith('token-1', 'shift-9', 'staff-9'))
    alertSpy.mockRestore()
  })

  it('declines a claim against the right shift and staff member', async () => {
    mockGetPendingOpenCallClaims.mockResolvedValue([pendingClaim()] as any)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const decline = (buttons || []).find(button => button.text === 'Decline')
      decline?.onPress?.()
    })

    render(<OpenCallsScreen session={managerSession} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByLabelText('Decline the claim from Rosa Mendes'))

    await waitFor(() => expect(mockRejectOpenCallClaim).toHaveBeenCalledWith('token-1', 'shift-9', 'staff-9'))
    alertSpy.mockRestore()
  })

  it('reports a decision the server refused rather than failing silently', async () => {
    mockGetPendingOpenCallClaims.mockResolvedValue([pendingClaim()] as any)
    mockApproveOpenCallClaim.mockRejectedValueOnce(new Error('Cannot modify a shift that has already ended'))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const approve = (buttons || []).find(button => button.text === 'Approve')
      approve?.onPress?.()
    })

    render(<OpenCallsScreen session={managerSession} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByLabelText('Approve the claim from Rosa Mendes'))

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Could not approve',
      'Cannot modify a shift that has already ended',
    ))
    alertSpy.mockRestore()
  })

  it('says so when there is nothing waiting', async () => {
    mockGetPendingOpenCallClaims.mockResolvedValue([] as any)

    render(<OpenCallsScreen session={managerSession} onBack={jest.fn()} />)

    expect(await screen.findByText('Nothing waiting on you')).toBeTruthy()
  })
})
