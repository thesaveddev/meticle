import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { PoliciesScreen } from '../PoliciesScreen'
import { acknowledgePolicy, getPolicies, getPolicyAcknowledgements } from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getPolicies: jest.fn(),
  getPolicyAcknowledgements: jest.fn(),
  acknowledgePolicy: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticMedium: jest.fn(),
}))

const mockedPolicies = getPolicies as jest.MockedFunction<typeof getPolicies>
const mockedAcks = getPolicyAcknowledgements as jest.MockedFunction<typeof getPolicyAcknowledgements>
const mockedAcknowledge = acknowledgePolicy as jest.MockedFunction<typeof acknowledgePolicy>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'auditor@example.com', role: 'COMPLIANCE_OFFICER' },
} as AuthSession

const safeguarding = {
  id: 'policy-1',
  title: 'Safeguarding Adults Policy',
  category: 'Safeguarding',
  content: 'Purpose\nTo prevent abuse and neglect.\n\nRequired practice\nReport immediately.',
  version: '2.1',
}
const medication = {
  id: 'policy-2',
  title: 'Medication Management & Administration Policy',
  category: 'Medication',
  content: 'Purpose\nTo keep medicines safe.',
  version: '1.0',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedPolicies.mockResolvedValue([safeguarding, medication])
  mockedAcks.mockResolvedValue([])
})

/**
 * The policy library is the screen `blueprint §9.7` was missing: the
 * acknowledgement record existed at the API and nothing on the phone reached it,
 * so "had they read the safeguarding policy" could not be answered for anyone who
 * works from the app.
 */
describe('PoliciesScreen', () => {
  it('lists each policy with its version and whether it has been read', async () => {
    mockedAcks.mockImplementation(async (_token, policyId) => policyId === 'policy-1'
      ? [{ id: 'ack-1', policy_id: 'policy-1', user_id: 'user-1', acknowledged_at: '2026-11-01T09:00:00.000Z' }]
      : [])

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('Safeguarding Adults Policy')).toBeTruthy()
    expect(screen.getByText('SAFEGUARDING')).toBeTruthy()
    expect(await screen.findByText('Version 2.1 · Read 1 November 2026')).toBeTruthy()
    expect(await screen.findByText('Version 1.0 · Not yet read')).toBeTruthy()
  })

  it('records a read in the caller\'s own name and shows the date it was recorded', async () => {
    mockedAcknowledge.mockResolvedValue({
      id: 'ack-2', policy_id: 'policy-2', user_id: 'user-1', acknowledged_at: '2026-11-04T10:30:00.000Z',
    })

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('Medication Management & Administration Policy'))

    fireEvent.press(screen.getByRole('button', { name: 'I have read this policy' }))

    await waitFor(() => expect(mockedAcknowledge).toHaveBeenCalledWith('token-1', 'policy-2'))
    expect(await screen.findByText('Read 4 November 2026')).toBeTruthy()
    // The button is gone: the record now stands in its place.
    expect(screen.queryByRole('button', { name: 'I have read this policy' })).toBeNull()
  })

  it('does not claim a policy is unread when the read state could not be fetched', async () => {
    // A failed lookup must not read as "not read": it would send someone back to
    // re-read a policy they had already signed off.
    mockedAcks.mockRejectedValue(new Error('offline'))

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('Medication Management & Administration Policy')).toBeTruthy()
    expect(await screen.findByText('Version 2.1')).toBeTruthy()
    expect(screen.queryByText('Version 2.1 · Not yet read')).toBeNull()
  })

  it('keeps the acknowledgement error on the screen rather than losing the tap', async () => {
    mockedAcknowledge.mockRejectedValue(new Error('Policy not found'))

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)
    fireEvent.press(await screen.findByText('Safeguarding Adults Policy'))
    fireEvent.press(screen.getByRole('button', { name: 'I have read this policy' }))

    expect(await screen.findByText('Policy not found')).toBeTruthy()
  })

  it('says so when the organisation has published no policies, instead of looking empty', async () => {
    mockedPolicies.mockResolvedValue([])

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('No policies yet')).toBeTruthy()
  })

  it('reports a failed list load and offers a retry', async () => {
    mockedPolicies.mockRejectedValueOnce(new Error('Could not load the policies.'))
    mockedPolicies.mockResolvedValueOnce([safeguarding])

    const screen = render(<PoliciesScreen session={session} onBack={jest.fn()} />)

    expect(await screen.findByText('Could not load the policies.')).toBeTruthy()
    fireEvent.press(screen.getByText('Try again'))

    expect(await screen.findByText('Safeguarding Adults Policy')).toBeTruthy()
  })
})
