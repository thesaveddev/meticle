import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { AvailabilityScreen } from '../AvailabilityScreen'
import * as api from '../../services/api'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getMyAvailability: jest.fn(async () => []),
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
    await waitFor(() => expect(screen.getByText('Choose a date')).toBeTruthy())
    expect(screen.getByText('WEEKLY SCHEDULE')).toBeTruthy()
    expect(screen.getByLabelText('Next month')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/YYYY-MM-DD/)).toBeNull()
  })

  it('selects a calendar date for a dated availability submission', async () => {
    const screen = render(<AvailabilityScreen session={session} />)
    await waitFor(() => expect(screen.getByText('Choose a date')).toBeTruthy())
    const dateButtons = screen.getAllByRole('button')
    const selectableDate = dateButtons.find(button => button.props.accessibilityState?.disabled === false && String(button.props.accessibilityLabel || '').match(/^20/))
    expect(selectableDate).toBeTruthy()
    fireEvent.press(selectableDate!)
    expect(screen.getByText(/Selected/)).toBeTruthy()
  })
})
