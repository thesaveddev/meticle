import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { VisitScreen } from '../VisitScreen'
import type { AuthSession, HomecareVisit } from '../../types'
import * as api from '../../services/api'

jest.mock('../../services/api', () => ({
  getVisitTasks: jest.fn(async () => []),
  getLocationThreshold: jest.fn(async () => 500),
  getRequirePhoto: jest.fn(async () => false),
  toggleVisitTask: jest.fn(async () => ({})),
  addVisitTask: jest.fn(async () => ({ id: 'created', label: 'created', done: false, sort_order: 99 })),
}))

jest.mock('../../services/location', () => ({
  getVisitLocation: jest.fn(async () => ({ latitude: 51.5, longitude: -0.1 })),
  haversineDistance: jest.fn(() => 12),
  watchDistance: jest.fn(() => ({ stop: jest.fn() })),
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
