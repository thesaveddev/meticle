import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StaffNoticeGate } from '../components/StaffNoticeGate'
import { STAFF_LOCATION_NOTICE_VERSION } from '../content/staffLocationNotice'
import * as api from '../services/api'
import * as storage from '../services/storage'

jest.mock('../services/api', () => ({
  getLocationTrackingEnabled: jest.fn(async () => true),
  getStaffNotice: jest.fn(async () => ({ reachable: true, acknowledgement: null })),
  acknowledgeStaffNotice: jest.fn(async () => {}),
  // Agreed by default, so the tests below are about the notice gate rather than
  // about a worker who has not answered. The un-answered case has its own test.
  getLocationDecision: jest.fn(async () => ({
    decision: 'agreed', notice_version: '1.1',
    organisation_collects_location: true, collects_location: true,
  })),
  setLocationDecision: jest.fn(async () => {}),
}))

jest.mock('../services/storage', () => ({
  readSession: jest.fn(async () => ({ accessToken: 'token-1' })),
}))

const mockTracking = api.getLocationTrackingEnabled as jest.MockedFunction<typeof api.getLocationTrackingEnabled>
const mockNotice = api.getStaffNotice as jest.MockedFunction<typeof api.getStaffNotice>
const mockDecision = api.getLocationDecision as jest.MockedFunction<typeof api.getLocationDecision>

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
  // Reset here rather than relying on the factory default, because clearAllMocks
  // clears calls but not implementations: a test that overrides this would
  // otherwise leak its answer into the next one.
  mockDecision.mockResolvedValue({
    decision: 'agreed', notice_version: STAFF_LOCATION_NOTICE_VERSION,
    organisation_collects_location: true, collects_location: true,
  })
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

  it('does not show it to a worker who has read this version and answered', async () => {
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: STAFF_LOCATION_NOTICE_VERSION },
    })
    mockDecision.mockResolvedValue({
      decision: 'agreed', notice_version: STAFF_LOCATION_NOTICE_VERSION,
      organisation_collects_location: true, collects_location: true,
    })
    const { getByText, queryByTestId } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
    expect(queryByTestId('staff-notice-confirm')).toBeNull()
  })

  it('still asks a worker who has read the notice but never answered', async () => {
    // Reading it is not answering it. A provider who needs evidence that someone
    // agreed cannot be given the acknowledgement instead, and until the answer
    // exists nothing is collected for this worker — which is why the gate keeps
    // asking rather than letting them past on a read alone.
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: STAFF_LOCATION_NOTICE_VERSION },
    })
    mockDecision.mockResolvedValue({
      decision: null, notice_version: null,
      organisation_collects_location: true, collects_location: false,
    })
    const { getByTestId } = renderGate()
    await waitFor(() => expect(getByTestId('staff-notice-confirm')).toBeTruthy(), { timeout: 5000 })
  })

  it('lets the worker in when the decision check cannot be reached', async () => {
    // Same fail-open rule as an unreachable notice, for the same reason: we
    // cannot tell whether this worker has already answered, and standing in
    // someone's house with a spinner is the worse failure. Nothing is collected
    // meanwhile, because collection reads the decision server-side.
    mockNotice.mockResolvedValue({
      reachable: true,
      acknowledgement: { notice_key: 'staff_location', notice_version: STAFF_LOCATION_NOTICE_VERSION },
    })
    mockDecision.mockRejectedValue(new Error('offline'))
    const { getByText } = renderGate()
    await waitFor(() => expect(getByText('the app')).toBeTruthy(), { timeout: 5000 })
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
      acknowledgement: { notice_key: 'staff_location', notice_version: STAFF_LOCATION_NOTICE_VERSION },
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
