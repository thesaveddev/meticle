import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StaffNoticeGate } from '../components/StaffNoticeGate'
import * as api from '../services/api'
import * as storage from '../services/storage'

jest.mock('../services/api', () => ({
  getLocationTrackingEnabled: jest.fn(async () => true),
  getStaffNotice: jest.fn(async () => ({ reachable: true, acknowledgement: null })),
  acknowledgeStaffNotice: jest.fn(async () => {}),
}))

jest.mock('../services/storage', () => ({
  readSession: jest.fn(async () => ({ accessToken: 'token-1' })),
}))

const mockTracking = api.getLocationTrackingEnabled as jest.MockedFunction<typeof api.getLocationTrackingEnabled>
const mockNotice = api.getStaffNotice as jest.MockedFunction<typeof api.getStaffNotice>

function renderGate() {
  return render(
    <StaffNoticeGate>
      <Text>the app</Text>
    </StaffNoticeGate>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTracking.mockResolvedValue(true)
  mockNotice.mockResolvedValue({ reachable: true, acknowledgement: null })
  ;(storage.readSession as jest.Mock).mockResolvedValue({ accessToken: 'token-1' })
})

/**
 * The gate decides whether a care worker sees a privacy notice before they can
 * start their shift. Getting it wrong is bad in one direction (a worker uses
 * location having never been told) and worse in the other (a worker standing in
 * someone's house cannot check in), so both directions are pinned here.
 */
describe('StaffNoticeGate', () => {
  it('shows the notice to a worker who has never read it', async () => {
    const { queryByText, getByTestId } = renderGate()
    await waitFor(() => expect(getByTestId('staff-notice-confirm')).toBeTruthy(), { timeout: 5000 })
    expect(queryByText('the app')).toBeNull()
  })

  it('does not show it to a worker who has read this version', async () => {
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: '1.0' },
    })
    const { getByText, queryByTestId } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
    expect(queryByTestId('staff-notice-confirm')).toBeNull()
  })

  it('shows it again when the notice has been revised', async () => {
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: '0.9' },
    })
    const { getByTestId } = renderGate()
    await waitFor(() => expect(getByTestId('staff-notice-confirm')).toBeTruthy(), { timeout: 5000 })
  })

  it('does not show it when the organisation has switched location off', async () => {
    // A notice about data that is not being collected is noise, and this
    // screen is unavoidable — showing it anyway trains people to tap through
    // privacy screens unread.
    mockTracking.mockResolvedValue(false)
    const { getByText, queryByTestId } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
    expect(queryByTestId('staff-notice-confirm')).toBeNull()
  })

  it('lets the worker in when the server cannot be reached', async () => {
    // The failure this exists for. A carer with no signal must still be able to
    // clock in; the next successful check will offer the notice.
    mockNotice.mockResolvedValue({ reachable: false, acknowledgement: null })
    const { getByText, queryByTestId } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
    expect(queryByTestId('staff-notice-confirm')).toBeNull()
  })

  it('lets the worker in when there is no session at all', async () => {
    ;(storage.readSession as jest.Mock).mockResolvedValue(null)
    const { getByText } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
  })

  it('asks the server only once, however many times the app re-renders', async () => {
    // A worker who has already read it, so the gate settles on "done" and the
    // children stay mounted. The point is that navigation re-renders the gate
    // at the same tree position, and that must not re-issue the check.
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: '1.0' },
    })
    const { rerender, getByText } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
    rerender(
      <StaffNoticeGate>
        <Text>the app</Text>
      </StaffNoticeGate>
    )
    rerender(
      <StaffNoticeGate>
        <Text>the app again</Text>
      </StaffNoticeGate>
    )
    await waitFor(() => expect(getByText('the app again')).toBeTruthy(), { timeout: 5000 })
    expect(mockNotice).toHaveBeenCalledTimes(1)
  })
})
