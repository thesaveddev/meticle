import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { SwapTransferScreen } from '../SwapTransferScreen'
import type { AuthSession, HomecareVisit, MobileUser, TeamMember } from '../../types'
import * as api from '../../services/api'

// SafeAreaProvider waits for a native layout pass before rendering children, which
// never arrives under jest — the library ships this mock to supply metrics.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

jest.mock('../../services/api', () => ({
  getMyVisits: jest.fn(async () => []),
  getTeamMembers: jest.fn(async () => []),
  getStaffVisits: jest.fn(async () => []),
}))

const mockGetMyVisits = api.getMyVisits as jest.MockedFunction<typeof api.getMyVisits>
const mockGetTeamMembers = api.getTeamMembers as jest.MockedFunction<typeof api.getTeamMembers>
const mockGetStaffVisits = api.getStaffVisits as jest.MockedFunction<typeof api.getStaffVisits>

const session: AuthSession = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}
const user: MobileUser = session.user

function makeVisit(overrides: Partial<HomecareVisit> = {}): HomecareVisit {
  return {
    id: 'v1',
    label: 'Morning Call — Margaret',
    visit_type: 'homecare',
    status: 'scheduled',
    scheduled_start: '2030-01-02T09:00:00.000Z',
    scheduled_end: '2030-01-02T10:00:00.000Z',
    person_name: 'Margaret',
    ...overrides,
  }
}

interface RequestRow {
  id: string
  visit_id: string
  visit_label: string
  visit_type: string
  scheduled_start: string
  scheduled_end: string
  client_name: string
  request_type: 'swap' | 'transfer'
  status: string
  message: string | null
  requested_by_name: string
  target_name: string | null
  created_at: string
}

function makeRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'req-1',
    visit_id: 'v9',
    visit_label: 'Evening Call — Alice',
    visit_type: 'homecare',
    scheduled_start: '2030-01-03T18:00:00.000Z',
    scheduled_end: '2030-01-03T19:00:00.000Z',
    client_name: 'Alice',
    request_type: 'swap',
    status: 'pending',
    message: null,
    requested_by_name: 'Jane Doe',
    target_name: 'Test',
    created_at: '2030-01-01T08:00:00.000Z',
    ...overrides,
  }
}

/** A swap aimed at me, and one I raised — plus one already resolved. */
const INCOMING = makeRequest()
const OUTGOING = makeRequest({
  id: 'req-2',
  visit_label: 'Morning Call — Bob',
  client_name: 'Bob',
  requested_by_name: 'Test',
  target_name: 'Jane Doe',
})
const SETTLED = makeRequest({ id: 'req-3', visit_label: 'Lunch Call — Cara', client_name: 'Cara', status: 'accepted', target_name: 'Someone Else' })

const TEAM: TeamMember[] = [
  { id: 'staff-2', first_name: 'Jane', last_name: 'Doe', user_id: 'user-2', email: 'jane@example.com', role: 'CARE_WORKER' },
  { id: 'staff-3', first_name: 'Ade', last_name: 'Bello', user_id: 'user-3', email: 'ade@example.com', role: 'CARE_WORKER' },
]

interface Call {
  url: string
  method: string
  body: any
}

let calls: Call[] = []
let listPayload: unknown[] = []
let respondOk = true
let createOk = true
let createMessage = 'Could not submit'

beforeEach(() => {
  calls = []
  listPayload = [INCOMING, OUTGOING, SETTLED]
  respondOk = true
  createOk = true

  // The screen talks to this endpoint directly rather than through services/api,
  // so the transport is what the tests stand in for.
  ;(global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method || 'GET'
    calls.push({ url: String(url), method, body: init.body ? JSON.parse(init.body) : undefined })

    if (method === 'GET') return { ok: true, json: async () => listPayload }
    if (method === 'PATCH') return { ok: respondOk, json: async () => ({ ok: respondOk }) }
    return { ok: createOk, json: async () => (createOk ? { id: 'created' } : { message: createMessage }) }
  })

  mockGetMyVisits.mockResolvedValue([makeVisit()])
  mockGetTeamMembers.mockResolvedValue(TEAM)
  mockGetStaffVisits.mockResolvedValue([])
})

afterEach(() => {
  jest.restoreAllMocks()
})

const postCalls = () => calls.filter(call => call.method === 'POST')
const patchCalls = () => calls.filter(call => call.method === 'PATCH')

function renderScreen(props: Partial<React.ComponentProps<typeof SwapTransferScreen>> = {}) {
  const onBack = jest.fn()
  const onRefresh = jest.fn()
  const screen = render(
    <SwapTransferScreen session={session} user={user} visits={[makeVisit()]} onBack={onBack} onRefresh={onRefresh} {...props} />
  )
  return { ...screen, onBack, onRefresh }
}

describe('SwapTransferScreen request list', () => {
  it('lists requests and offers a response only on the ones aimed at me', async () => {
    const { getByText, getAllByText } = renderScreen()

    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())
    expect(getByText('Morning Call — Bob')).toBeTruthy()
    expect(getByText('2 pending requests')).toBeTruthy()

    // Only INCOMING is addressed to this carer.
    expect(getAllByText('Accept')).toHaveLength(1)
    expect(getAllByText('Decline')).toHaveLength(1)
  })

  it('filters the list to what I sent and what I received', async () => {
    const { getByText, queryByText } = renderScreen()

    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())

    fireEvent.press(getByText('Sent'))
    expect(getByText('Morning Call — Bob')).toBeTruthy()
    expect(queryByText('Evening Call — Alice')).toBeNull()
    expect(queryByText('Accept')).toBeNull()

    fireEvent.press(getByText('Received'))
    expect(getByText('Evening Call — Alice')).toBeTruthy()
    expect(queryByText('Morning Call — Bob')).toBeNull()
    expect(queryByText('Accept')).toBeTruthy()
  })

  it('shows an empty state when there is nothing to show', async () => {
    listPayload = []

    const { getByText } = renderScreen()

    await waitFor(() => expect(getByText('No requests')).toBeTruthy())
    expect(getByText('Swap and transfer requests will appear here.')).toBeTruthy()
  })
})

describe('SwapTransferScreen responding', () => {
  it('sends the decision to the API and refreshes the carer’s calls', async () => {
    const { getByText, onRefresh } = renderScreen()

    await waitFor(() => expect(getByText('Accept')).toBeTruthy())
    fireEvent.press(getByText('Accept'))

    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(patchCalls()[0].url).toContain('/homecare/swap-requests/req-1/respond')
    expect(patchCalls()[0].body).toEqual({ status: 'accepted' })
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
  })

  it('reports a rejected response through a native alert instead of throwing', async () => {
    respondOk = false
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const { getByText, onRefresh } = renderScreen()

    await waitFor(() => expect(getByText('Decline')).toBeTruthy())
    fireEvent.press(getByText('Decline'))

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Could not respond'))
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('SwapTransferScreen transfer flow', () => {
  it('walks a transfer to review and submits it without a replacement call', async () => {
    const { getByText, getByRole, queryByText } = renderScreen({ initialRequestType: 'transfer' })

    // The team list arrives with the request list, so waiting for one waits for both.
    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())

    // Arriving from a call's Transfer pill opens that flow directly.
    expect(getByText('Which of your calls?')).toBeTruthy()
    expect(getByText('Pick the call you want to transfer.')).toBeTruthy()

    fireEvent.press(getByText('Morning Call — Margaret'))
    expect(getByText('Who should receive this call?')).toBeTruthy()

    fireEvent.press(getByText('Jane Doe'))

    // A transfer hands a call over, so there is no "which of their calls" step —
    // it goes straight to review.
    expect(getByText('Review & submit')).toBeTruthy()
    expect(queryByText('Which of their calls?')).toBeNull()
    expect(mockGetStaffVisits).not.toHaveBeenCalled()

    fireEvent.press(getByRole('button', { name: 'Submit transfer' }))

    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(postCalls()[0].body).toEqual({ visit_id: 'v1', target_staff_id: 'staff-2', request_type: 'transfer' })
    await waitFor(() => expect(queryByText('Review & submit')).toBeNull())
  })

  it('keeps the request open and explains a rejected submission', async () => {
    createOk = false
    createMessage = 'That call has already been swapped'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const { getByText, getByRole } = renderScreen({ initialRequestType: 'transfer' })

    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())

    fireEvent.press(getByText('Morning Call — Margaret'))
    fireEvent.press(getByText('Jane Doe'))
    fireEvent.press(getByRole('button', { name: 'Submit transfer' }))

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'That call has already been swapped'))
    // The carer can pick a different call rather than losing their work.
    expect(getByText('Review & submit')).toBeTruthy()
  })
})

describe('SwapTransferScreen swap flow', () => {
  it('pre-selects the call the carer started from', async () => {
    const { getByText, queryByText } = renderScreen({ initialRequestType: 'swap', initialVisitId: 'v1' })

    // The call is already chosen, so the flow opens on choosing a colleague.
    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())
    await waitFor(() => expect(getByText('Who do you want to swap with?')).toBeTruthy())
    expect(queryByText('Which of your calls?')).toBeNull()
  })

  it('offers only the colleague’s open calls and submits the chosen one', async () => {
    mockGetStaffVisits.mockResolvedValue([
      makeVisit({ id: 'tv-1', label: 'Their Morning', person_name: 'Alice' }),
      makeVisit({ id: 'tv-2', label: 'Their Finished Call', person_name: 'Bob', status: 'completed' }),
    ])

    const { getByText, getByRole, queryByText } = renderScreen({ initialRequestType: 'swap', initialVisitId: 'v1' })

    await waitFor(() => expect(getByText('Evening Call — Alice')).toBeTruthy())
    await waitFor(() => expect(getByText('Who do you want to swap with?')).toBeTruthy())
    fireEvent.press(getByText('Jane Doe'))

    expect(mockGetStaffVisits).toHaveBeenCalledWith('token-1', 'staff-2', expect.any(String), expect.any(String))

    await waitFor(() => expect(getByText('Which of their calls?')).toBeTruthy())
    expect(getByText('Their Morning')).toBeTruthy()
    // A completed call is not something you can take on.
    expect(queryByText('Their Finished Call')).toBeNull()

    fireEvent.press(getByText('Their Morning'))
    expect(getByText('Review & submit')).toBeTruthy()
    // The summary names both calls, so the carer checks the exchange before sending it.
    expect(getByText('Morning Call — Margaret')).toBeTruthy()
    expect(getByText('Their Morning')).toBeTruthy()
    expect(getByText('Swap with')).toBeTruthy()

    fireEvent.press(getByRole('button', { name: 'Submit swap request' }))

    await waitFor(() => expect(postCalls()).toHaveLength(1))
    expect(postCalls()[0].body).toEqual({
      visit_id: 'v1',
      target_staff_id: 'staff-2',
      target_visit_id: 'tv-1',
      request_type: 'swap',
    })
  })
})
