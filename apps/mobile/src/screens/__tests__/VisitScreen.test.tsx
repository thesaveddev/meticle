import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { VisitScreen } from '../VisitScreen'
import type { AuthSession, HomecareVisit, VisitAction } from '../../types'
import * as api from '../../services/api'

jest.mock('../../services/api', () => ({
  getVisitTasks: jest.fn(async () => []),
  getLocationThreshold: jest.fn(async () => 500),
  // Defaults true so the existing tests exercise the location-on path. The
  // switch-off path has its own tests below.
  getLocationTrackingEnabled: jest.fn(async () => true),
  // Agreed, so the location-on path is what these tests exercise. A worker who
  // declined is covered below, because that path must not read a position.
  getLocationDecision: jest.fn(async () => ({
    decision: 'agreed', notice_version: '1.1',
    organisation_collects_location: true, collects_location: true,
  })),
  getRequirePhoto: jest.fn(async () => false),
  toggleVisitTask: jest.fn(async () => ({})),
  addVisitTask: jest.fn(async () => ({ id: 'created', label: 'created', done: false, sort_order: 99 })),
}))

jest.mock('../../services/location', () => ({
  getVisitLocation: jest.fn(async () => ({ latitude: 51.5, longitude: -0.1 })),
  haversineDistance: jest.fn(() => 12),
  // Deliberately a one-shot, mirroring the real module. A `watchPositionAsync`
  // subscription here would silently re-introduce the continuous tracking this
  // screen used to do, and every test would still pass.
  measureVisitDistance: jest.fn(async () => ({ distance: 12, accuracy: 8 })),
  formatDistance: jest.fn((meters: number) => `${meters}m`),
}))

// The camera and photo library are native; nothing in these tests opens them.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))

const mockGetVisitTasks = api.getVisitTasks as jest.MockedFunction<typeof api.getVisitTasks>
const mockMeasureVisitDistance = jest.requireMock('../../services/location').measureVisitDistance as jest.Mock
const mockGetRequirePhoto = api.getRequirePhoto as jest.MockedFunction<typeof api.getRequirePhoto>
const mockToggleVisitTask = api.toggleVisitTask as jest.MockedFunction<typeof api.toggleVisitTask>
const mockAddVisitTask = api.addVisitTask as jest.MockedFunction<typeof api.addVisitTask>

const session: AuthSession = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER', first_name: 'Test', last_name: 'Carer' },
}

function makeVisit(overrides: Partial<HomecareVisit> = {}): HomecareVisit {
  return {
    id: 'visit-1',
    label: 'Morning Call — Margaret',
    visit_type: 'homecare',
    status: 'scheduled',
    // Future-dated so an open call is never rendered as overdue.
    scheduled_start: '2030-01-01T09:00:00.000Z',
    scheduled_end: '2030-01-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderVisit(props: Partial<React.ComponentProps<typeof VisitScreen>> = {}) {
  const handlers = {
    onBack: jest.fn(),
    onAction: jest.fn(async () => ({ synced: true })),
    onDisruption: jest.fn(async () => {}),
    onReportIncident: jest.fn(),
    onSwap: jest.fn(),
    onTransfer: jest.fn(),
    onRideShare: jest.fn(),
  }
  const screen = render(
    <VisitScreen visit={makeVisit()} session={session} queue={[]} {...handlers} {...props} />
  )
  return { ...screen, ...handlers }
}

beforeEach(() => {
  mockGetVisitTasks.mockResolvedValue([])
  mockGetRequirePhoto.mockResolvedValue(false)
})

// The screen loads its task list and org settings on mount; letting those promises settle
// keeps their state updates inside the test.
async function settle(): Promise<void> {
  await act(async () => {})
}

describe('VisitScreen action pills', () => {
  it('offers Transfer beside Swap and routes each to its own flow', async () => {
    const { getByText, onSwap, onTransfer } = renderVisit()

    fireEvent.press(getByText('Transfer'))

    expect(onTransfer).toHaveBeenCalledTimes(1)
    expect(onSwap).not.toHaveBeenCalled()

    fireEvent.press(getByText('Swap'))
    expect(onSwap).toHaveBeenCalledTimes(1)

    await settle()
  })

  it('keeps Swap and Transfer off a call that is already closed', async () => {
    const { getByText, queryByText } = renderVisit({ visit: makeVisit({ status: 'completed' }) })

    expect(getByText('completed')).toBeTruthy()
    expect(queryByText('Swap')).toBeNull()
    expect(queryByText('Transfer')).toBeNull()

    await settle()
  })
})

describe('VisitScreen check-out requirements', () => {
  it('names the outstanding item when care notes are missing', async () => {
    const { getByText } = renderVisit({ visit: makeVisit({ status: 'checked_in' }) })

    await waitFor(() => expect(getByText('Before you check out')).toBeTruthy())
    expect(getByText('Care notes submitted')).toBeTruthy()
    expect(getByText('Required')).toBeTruthy()
    expect(getByText('Add care notes to check out')).toBeTruthy()
  })

  it('spells out how many tasks still block check out', async () => {
    mockGetVisitTasks.mockResolvedValue([{ id: 't1', label: 'Medication', done: false, sort_order: 1 }])

    const { getByText } = renderVisit({ visit: makeVisit({ status: 'checked_in' }) })

    await waitFor(() => expect(getByText('Medication')).toBeTruthy())
    expect(getByText('All tasks completed (0/1)')).toBeTruthy()
    expect(getByText('1 left')).toBeTruthy()
    expect(getByText('Complete all tasks to check out')).toBeTruthy()
  })

  it('moves on to the next requirement once the earlier ones are met', async () => {
    mockGetRequirePhoto.mockResolvedValue(true)

    const { getByText, getByPlaceholderText } = renderVisit({ visit: makeVisit({ status: 'checked_in' }) })

    await waitFor(() => expect(getByText('Photo evidence (0)')).toBeTruthy())

    fireEvent.changeText(getByPlaceholderText(/Care provided/), 'All good, client in fine spirits')

    expect(getByText('Add a photo to check out')).toBeTruthy()
  })
})

describe('VisitScreen task list', () => {
  it('marks a task complete through the API', async () => {
    mockGetVisitTasks.mockResolvedValue([{ id: 't1', label: 'Medication', done: false, sort_order: 1 }])

    const { getByText } = renderVisit({ visit: makeVisit({ status: 'checked_in' }) })

    await waitFor(() => expect(getByText('Medication')).toBeTruthy())
    fireEvent.press(getByText('Medication'))

    await waitFor(() => expect(mockToggleVisitTask).toHaveBeenCalledWith('token-1', 'visit-1', 't1', true))
  })

  it('let only a manager add a task, and points carers at the notes field', async () => {
    mockGetVisitTasks.mockResolvedValue([{ id: 't1', label: 'Medication', done: false, sort_order: 1 }])

    const carer = renderVisit({ visit: makeVisit({ status: 'checked_in' }) })
    await waitFor(() => expect(carer.getByText('Medication')).toBeTruthy())
    expect(carer.queryByPlaceholderText('Add a task...')).toBeNull()
    expect(carer.getByText('Extra tasks? Add them in the care notes below.')).toBeTruthy()
    carer.unmount()

    const manager = renderVisit({
      visit: makeVisit({ status: 'checked_in' }),
      session: { ...session, user: { ...session.user, role: 'MANAGER' } },
    })
    const input = await waitFor(() => manager.getByPlaceholderText('Add a task...'))

    fireEvent.changeText(input, 'Blood pressure')
    fireEvent.press(manager.getByText('Add'))

    await waitFor(() => expect(mockAddVisitTask).toHaveBeenCalledWith('token-1', 'visit-1', 'Blood pressure'))
  })
})

/**
 * The screen used to subscribe to the device position and re-read it every
 * 5 seconds / 10 metres for as long as it was open, before check-in. That is
 * continuous tracking of a care worker between two button presses, and the
 * product does not need it: the same threshold is enforced authoritatively when
 * they press Check in, which takes its own fix.
 *
 * These tests pin the replacement, because the failure mode is silent. Put a
 * watcher back and the app still works, still shows a sensible distance, and
 * every other test in this file keeps passing.
 */
describe('VisitScreen location capture', () => {
  beforeEach(() => {
    mockMeasureVisitDistance.mockClear()
  })

  it('reads no position until the carer asks for it', async () => {
    const { getByText } = renderVisit({
      visit: makeVisit({ person_latitude: 51.5, person_longitude: -0.1 }),
    })

    await settle()
    expect(getByText('Check my distance')).toBeTruthy()
    expect(mockMeasureVisitDistance).not.toHaveBeenCalled()
  })

  it('takes exactly one fix per tap, and no more', async () => {
    const { getByText } = renderVisit({
      visit: makeVisit({ person_latitude: 51.5, person_longitude: -0.1 }),
    })
    await settle()

    fireEvent.press(getByText('Check my distance'))

    await waitFor(() => expect(getByText('At location')).toBeTruthy())
    expect(mockMeasureVisitDistance).toHaveBeenCalledTimes(1)
    expect(mockMeasureVisitDistance).toHaveBeenCalledWith(51.5, -0.1)

    // The reading must not keep updating itself once the carer has looked.
    // A subscription would show up here as a second call with no tap.
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(mockMeasureVisitDistance).toHaveBeenCalledTimes(1)
  })

  it('offers no distance check on a call that is already closed', async () => {
    const { queryByText } = renderVisit({
      visit: makeVisit({ status: 'completed', person_latitude: 51.5, person_longitude: -0.1 }),
    })

    await settle()
    expect(queryByText('Check my distance')).toBeNull()
  })
})

/**
 * An organisation can switch carer location off. When it has, the app must take
 * no position at all — no permission prompt, no distance check, no coordinates
 * sent — and the visit must still be recorded normally.
 *
 * The failure this guards against is a carer being shown a location permission
 * dialog for a feature their employer has said it does not use. The app cannot
 * simply fail open: asking and discarding leaves the carer to answer a
 * permission question with no consequence either way, which is worse than
 * either outcome.
 */
describe('VisitScreen when the organisation has switched location off', () => {
  const mockTracking = api.getLocationTrackingEnabled as jest.MockedFunction<typeof api.getLocationTrackingEnabled>
  const mockDecision = api.getLocationDecision as jest.MockedFunction<typeof api.getLocationDecision>
  const mockGetVisitLocation = jest.requireMock('../../services/location').getVisitLocation as jest.Mock

  // The carer here has agreed to the notice — the organisation is the thing that
  // has switched collection off. So the worker's own decision stays `agreed`
  // and only the organisation-wide half of `collects_location` turns false. This
  // is the case the app has to get right: the two are independent, and a worker
  // agreeing must not override their employer's switch.
  beforeEach(() => {
    mockTracking.mockResolvedValue(false)
    mockDecision.mockResolvedValue({
      decision: 'agreed',
      notice_version: '1.1',
      organisation_collects_location: false,
      collects_location: false,
    })
    mockGetVisitLocation.mockClear()
  })

  afterEach(() => {
    mockTracking.mockResolvedValue(true)
    mockDecision.mockResolvedValue({
      decision: 'agreed',
      notice_version: '1.1',
      organisation_collects_location: true,
      collects_location: true,
    })
  })

  it('never asks for a position', async () => {
    const { getByText } = renderVisit({ visit: makeVisit({ person_latitude: 51.5, person_longitude: -0.1 }) })
    await settle()

    expect(getByText('Check in')).toBeTruthy()
    expect(mockGetVisitLocation).not.toHaveBeenCalled()
  })

  it('offers no distance check at all', async () => {
    const { queryByText } = renderVisit({ visit: makeVisit({ person_latitude: 51.5, person_longitude: -0.1 }) })
    await settle()

    expect(queryByText('Check my distance')).toBeNull()
    expect(mockMeasureVisitDistance).not.toHaveBeenCalled()
  })

  it('still records the visit on check-in', async () => {
    // Typed with the real two-argument signature so the payload assertion below
    // is checked rather than reaching into an arity-zero mock.
    const onAction = jest.fn(async (_action: VisitAction, _payload: Record<string, unknown>) => ({ synced: true }))
    // The screen refuses a check-in outside the call's own time window, so this
    // visit has to be live now. It matters that it is a real window and not a
    // relaxed guard: with tracking off, the window is still enforced, so this
    // also shows the two are independent.
    const now = Date.now()
    const { getByText } = renderVisit({
      visit: makeVisit({
        person_latitude: 51.5,
        person_longitude: -0.1,
        scheduled_start: new Date(now - 5 * 60_000).toISOString(),
        scheduled_end: new Date(now + 55 * 60_000).toISOString(),
      }),
      onAction,
    })
    await settle()

    fireEvent.press(getByText('Check in'))

    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1))
    // No coordinates in the payload — and crucially, no failure either.
    expect(onAction.mock.calls[0][1]).not.toHaveProperty('latitude')
    expect(mockGetVisitLocation).not.toHaveBeenCalled()
  })
})
