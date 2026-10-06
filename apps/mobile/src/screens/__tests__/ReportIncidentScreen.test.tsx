import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ReportIncidentScreen } from '../ReportIncidentScreen'
import * as api from '../../services/api'
import * as incidentQueue from '../../services/incidentQueue'
import type { AuthSession } from '../../types'

jest.mock('../../services/api', () => ({
  getIncidentCategories: jest.fn(),
}))

jest.mock('../../services/incidentQueue', () => ({
  submitIncidentReport: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticWarning: jest.fn(),
}))

const session: AuthSession = {
  accessToken: 'token',
  refreshToken: 'refresh',
  user: { id: 'carer-1', email: 'carer@example.com', role: 'CARE_WORKER' },
}

const mockGetCategories = api.getIncidentCategories as jest.MockedFunction<typeof api.getIncidentCategories>
const mockSubmitIncidentReport = incidentQueue.submitIncidentReport as jest.MockedFunction<typeof incidentQueue.submitIncidentReport>

function enterTitle(screen: ReturnType<typeof render>) {
  fireEvent.changeText(screen.getByPlaceholderText('Brief title of the incident'), 'Fall in hallway')
}

describe('ReportIncidentScreen', () => {
  beforeEach(() => {
    mockGetCategories.mockResolvedValue([
      { id: 'category-fall-uuid', name: 'Fall', is_active: true },
      { id: 'category-disabled-uuid', name: 'Disabled category', is_active: false },
    ])
    mockSubmitIncidentReport.mockResolvedValue({ queued: false, id: 'submission-1' })
  })

  it('loads active categories and submits the selected category UUID through the queue service', async () => {
    const screen = render(
      <ReportIncidentScreen
        session={session}
        personId="person-1"
        personName="Ada Lovelace"
        visitId="visit-1"
        onBack={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByText('Fall')).toBeTruthy())
    expect(screen.queryByText('Disabled category')).toBeNull()
    fireEvent.press(screen.getByText('Fall'))
    enterTitle(screen)
    fireEvent.changeText(screen.getByPlaceholderText('Names of any witnesses'), 'Jordan Smith')
    fireEvent.press(screen.getByText('Submit incident report'))

    await waitFor(() => expect(mockSubmitIncidentReport).toHaveBeenCalledWith('token', 'carer-1', null, expect.objectContaining({
      title: 'Fall in hallway',
      witnesses: 'Jordan Smith',
      category_id: 'category-fall-uuid',
      person_ids: ['person-1'],
      visit_id: 'visit-1',
    })))
  })

  it('shows a category lookup error and still submits without an optional category', async () => {
    mockGetCategories.mockRejectedValue(new Error('Network unavailable'))
    const screen = render(<ReportIncidentScreen session={session} onBack={jest.fn()} />)

    await waitFor(() => expect(screen.getByText('Categories could not be loaded. You can still submit without one.')).toBeTruthy())
    enterTitle(screen)
    fireEvent.press(screen.getByText('Submit incident report'))

    await waitFor(() => expect(mockSubmitIncidentReport).toHaveBeenCalledWith('token', 'carer-1', null, expect.objectContaining({
      title: 'Fall in hallway',
      category_id: undefined,
    })))
  })

  it('confirms an offline report was saved locally rather than submitted', async () => {
    mockSubmitIncidentReport.mockResolvedValueOnce({ queued: true, id: 'submission-offline' })
    const screen = render(<ReportIncidentScreen session={session} onBack={jest.fn()} />)
    enterTitle(screen)
    fireEvent.press(screen.getByText('Submit incident report'))

    await waitFor(() => expect(screen.getByText('Report saved on this device')).toBeTruthy())
    expect(screen.getByText('It will be sent securely when your connection returns. Keep this device signed in.')).toBeTruthy()
  })
})
