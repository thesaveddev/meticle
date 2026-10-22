import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { ShiftClockScreen, workedLabel } from '../ShiftClockScreen'
import { ApiError, clockShift, getShift, getShiftAttendance } from '../../services/api'
import {
  flushShiftClockActions,
  pendingShiftClockActions,
  queueShiftClockAction,
} from '../../services/shiftClockQueue'
import type { AuthSession, ShiftAttendance } from '../../types'

jest.mock('../../services/api', () => ({
  // The screen distinguishes "the server said no" from "nobody answered" by class,
  // so the real error type has to survive the mock.
  ApiError: jest.requireActual('../../services/api').ApiError,
  clockShift: jest.fn(),
  getShift: jest.fn(),
  getShiftAttendance: jest.fn(),
}))

jest.mock('../../services/shiftClockQueue', () => ({
  newShiftActionKey: jest.fn(() => 'key-from-the-press'),
  pendingShiftClockActions: jest.fn(async () => []),
  queueShiftClockAction: jest.fn(async () => []),
  flushShiftClockActions: jest.fn(async () => ({ synced: 0, remaining: 0, refused: 0 })),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticWarning: jest.fn(),
}))

const mockedGetAttendance = getShiftAttendance as jest.MockedFunction<typeof getShiftAttendance>
const mockedGetShift = getShift as jest.MockedFunction<typeof getShift>
const mockedClock = clockShift as jest.MockedFunction<typeof clockShift>
const mockedQueue = queueShiftClockAction as jest.MockedFunction<typeof queueShiftClockAction>
const mockedPending = pendingShiftClockActions as jest.MockedFunction<typeof pendingShiftClockActions>
const mockedFlush = flushShiftClockActions as jest.MockedFunction<typeof flushShiftClockActions>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER' },
} as AuthSession

const SHIFT = {
  id: 'shift-1',
  location_id: 'loc-1',
  location_name: 'Ash Grove',
  shift_type: 'day',
  status: 'filled',
  start_time: '2026-10-18T08:00:00.000Z',
  end_time: '2026-10-18T20:00:00.000Z',
  actual_start_at: null,
  actual_end_at: null,
  clocked_on_at: null,
  clocked_off_at: null,
  on_duty: false,
  handover_due: false,
  handover: null,
}

/** The attendance record as `GET /shifts/:id/attendance` returns it. */
function attendance(overrides: Partial<ShiftAttendance> = {}): ShiftAttendance {
  const me = {
    staff_id: 'staff-1',
    user_id: 'user-1',
    first_name: 'Priya',
    last_name: 'Sharma',
    assignment_status: 'assigned',
    is_overtime: false,
    is_me: true,
    clocked_on_at: null as string | null,
    clocked_off_at: null as string | null,
    worked_minutes: 0,
    on_duty: false,
  }
  return {
    shift_id: 'shift-1',
    location_id: 'loc-1',
    location_name: 'Ash Grove',
    status: 'filled',
    shift_type: 'day',
    start_time: SHIFT.start_time,
    end_time: SHIFT.end_time,
    actual_start_at: null,
    actual_end_at: null,
    unattended: true,
    rostered: [me],
    events: [],
    ...overrides,
  }
}

function notClockedOn() {
  return attendance()
}

function onDuty() {
  return attendance({
    unattended: false,
    actual_start_at: '2026-10-18T07:58:00.000Z',
    rostered: [{
      ...attendance().rostered[0],
      clocked_on_at: '2026-10-18T07:58:00.000Z',
      on_duty: true,
      worked_minutes: 0,
    }],
  } as any)
}

function clockedOff() {
  return attendance({
    unattended: false,
    rostered: [{
      ...attendance().rostered[0],
      clocked_on_at: '2026-10-18T07:58:00.000Z',
      clocked_off_at: '2026-10-18T20:04:00.000Z',
      worked_minutes: 705,
      on_duty: false,
    }],
  })
}

function renderScreen(props: Partial<React.ComponentProps<typeof ShiftClockScreen>> = {}) {
  const onChanged = jest.fn()
  const onHandover = jest.fn()
  const view = render(
    <ShiftClockScreen
      session={session}
      shiftId="shift-1"
      shift={SHIFT as any}
      onBack={jest.fn()}
      onChanged={onChanged}
      onHandover={onHandover}
      {...props}
    />,
  )
  return { ...view, onChanged, onHandover }
}

describe('ShiftClockScreen', () => {
  beforeEach(() => {
    mockedGetAttendance.mockResolvedValue(notClockedOn())
    mockedGetShift.mockResolvedValue(SHIFT as any)
    mockedClock.mockResolvedValue({ event: {} as any, shift: { actual_start_at: null, actual_end_at: null } })
    mockedPending.mockResolvedValue([])
    mockedFlush.mockResolvedValue({ synced: 0, remaining: 0, refused: 0 })
    mockedQueue.mockResolvedValue([])
  })

  it('offers the clock-on to the worker on the shift, and records it under one key', async () => {
    mockedGetAttendance
      .mockResolvedValueOnce(notClockedOn())
      .mockResolvedValue(onDuty())

    const { findByLabelText, findByText, onChanged } = renderScreen()

    // Nothing has happened yet: the screen says so rather than showing a blank state.
    // The first render in this file also pays for the component and its native
    // dependencies being compiled, which is why this one wait is longer than the rest.
    expect(await findByText('Not clocked on yet', {}, { timeout: 5000 })).toBeTruthy()
    fireEvent.press(await findByLabelText('Clock on'))

    await waitFor(() => expect(mockedClock).toHaveBeenCalledWith('token-1', 'shift-1', 'clock-on', expect.objectContaining({
      action_key: 'key-from-the-press',
      recorded_at: expect.any(String),
    })))
    expect(await findByText('You are on duty.')).toBeTruthy()
    // The reload is the record, not an assumption that the press worked.
    expect(await findByText(/On duty since/)).toBeTruthy()
    expect(onChanged).toHaveBeenCalled()
  })

  it('sends the note the worker wrote with the clock action', async () => {
    const { findByLabelText } = renderScreen()

    fireEvent.changeText(await findByLabelText('Note for the clock record'), '  Keys handed over.  ')
    fireEvent.press(await findByLabelText('Clock on'))

    await waitFor(() => expect(mockedClock).toHaveBeenCalledWith('token-1', 'shift-1', 'clock-on', expect.objectContaining({
      note: 'Keys handed over.',
    })))
  })

  it('offers the clock-off to a worker who is on duty, and reports the hours recorded', async () => {
    mockedGetAttendance
      .mockResolvedValueOnce(onDuty())
      .mockResolvedValue(clockedOff())

    const { findByLabelText, findByText } = renderScreen()

    expect(await findByText(/On duty since/)).toBeTruthy()
    fireEvent.press(await findByLabelText('Clock off'))

    await waitFor(() => expect(mockedClock).toHaveBeenCalledWith('token-1', 'shift-1', 'clock-off', expect.objectContaining({
      action_key: 'key-from-the-press',
    })))
    // The clock is the reader's own, so the assertion is the shape, not a zone.
    expect(await findByText(/Clocked off at \d{2}:\d{2}/)).toBeTruthy()
    // The server's counted minutes, not a stopwatch the phone invented.
    expect(await findByText('Worked 11h 45m.')).toBeTruthy()
    // The way back on duty is still there, because a carer can return mid-shift.
    expect(await findByLabelText('Clock on again')).toBeTruthy()
  })

  it('keeps a press that never reached the server, and says it is on the phone', async () => {
    mockedClock.mockRejectedValue(new TypeError('Network request failed'))
    mockedQueue.mockResolvedValue([{
      key: 'key-from-the-press',
      shiftId: 'shift-1',
      action: 'clock-on',
      payload: { action_key: 'key-from-the-press', recorded_at: '2026-10-18T07:58:00.000Z', note: null },
      createdAt: '2026-10-18T07:58:00.000Z',
    }])

    const { findByLabelText, findByTestId, findByText } = renderScreen()

    fireEvent.press(await findByLabelText('Clock on'))

    await waitFor(() => expect(mockedQueue).toHaveBeenCalledWith(expect.objectContaining({
      shiftId: 'shift-1',
      action: 'clock-on',
      payload: expect.objectContaining({ action_key: 'key-from-the-press' }),
    })))
    expect(await findByText(/Saved on this phone/)).toBeTruthy()
    expect(await findByTestId('shift-clock-retry')).toBeTruthy()
  })

  it('shows a refusal instead of pretending the shift is open', async () => {
    mockedClock.mockRejectedValue(new ApiError(409, 'You are already clocked on to this shift'))
    const { findByLabelText, findByText } = renderScreen()

    fireEvent.press(await findByLabelText('Clock on'))

    expect(await findByText('You are already clocked on to this shift')).toBeTruthy()
    expect(mockedQueue).not.toHaveBeenCalled()
  })

  it('does not offer the clock to somebody who is not rostered on the shift', async () => {
    mockedGetAttendance.mockResolvedValue(attendance({
      rostered: [{
        ...attendance().rostered[0],
        is_me: false,
        first_name: 'Tom',
        last_name: 'Okafor',
      }],
    }))
    const { findByText, queryByLabelText } = renderScreen()

    expect(await findByText('You are not rostered on this shift')).toBeTruthy()
    // A button whose only outcome is a 403 is worse than no button.
    expect(queryByLabelText('Clock on')).toBeNull()
    expect(queryByLabelText('Clock off')).toBeNull()
  })

  it('sends what the phone is holding when the screen opens', async () => {
    const saved = {
      key: 'saved-key',
      shiftId: 'shift-1',
      action: 'clock-off' as const,
      payload: { action_key: 'saved-key', recorded_at: '2026-10-18T20:04:00.000Z', note: null },
      createdAt: '2026-10-18T20:04:00.000Z',
    }
    mockedPending.mockResolvedValueOnce([saved]).mockResolvedValue([])
    mockedFlush.mockResolvedValue({ synced: 1, remaining: 0, refused: 0 })

    const { findByText } = renderScreen()

    await waitFor(() => expect(mockedFlush).toHaveBeenCalledWith('token-1', { shiftId: 'shift-1' }))
    expect(await findByText('1 saved action was sent.')).toBeTruthy()
  })

  it('summarises the handover the shift owes and opens it', async () => {
    const { findByText, onHandover } = renderScreen({
      shift: {
        ...SHIFT,
        handover_due: true,
        handover: {
          id: 'handover-1',
          version: 2,
          author_name: 'Priya Sharma',
          recorded_at: '2026-10-17T20:05:00.000Z',
          what_happened: 'Calm shift. Two residents at day service.',
          acknowledgement_count: 0,
          viewer_acknowledged: false,
          viewer_is_author: false,
        },
      } as any,
    })

    expect(await findByText(/v2 · Priya Sharma · 17 Oct at \d{2}:\d{2}/)).toBeTruthy()
    expect(await findByText('Nobody has read this yet.')).toBeTruthy()
    fireEvent.press(await findByText('Open the handover'))

    expect(onHandover).toHaveBeenCalledWith('shift-1')
  })

  it('offers the incident report from the shift, where a support worker is when they see it', async () => {
    const onReportIncident = jest.fn()
    const { findByText } = renderScreen({ onReportIncident })

    fireEvent.press(await findByText('Report an incident'))

    expect(onReportIncident).toHaveBeenCalledTimes(1)
  })

  it('shows no incident entry when the app did not wire one', async () => {
    const { findByText, queryByText } = renderScreen()

    // The screen still loads — the safety card is simply absent.
    expect(await findByText('Shift handover')).toBeTruthy()
    expect(queryByText('Report an incident')).toBeNull()
  })

  it('loads the shift by id when it was opened from a notification', async () => {
    const { findByText } = renderScreen({ shift: undefined })

    expect(await findByText('Ash Grove')).toBeTruthy()
    expect(mockedGetShift).toHaveBeenCalledWith('token-1', 'shift-1')
  })

  it('says why the screen is empty instead of looking like a shift with no staff', async () => {
    mockedGetAttendance.mockRejectedValue(new Error('The server did not answer'))
    const { findByText } = renderScreen()

    expect(await findByText('Could not load this shift')).toBeTruthy()
    expect(await findByText('The server did not answer')).toBeTruthy()
    expect(await findByText('Try again')).toBeTruthy()
  })
})

describe('workedLabel', () => {
  it('says hours and minutes the way a person would', () => {
    expect(workedLabel(0)).toBe('')
    expect(workedLabel(45)).toBe('45m')
    expect(workedLabel(120)).toBe('2h')
    expect(workedLabel(705)).toBe('11h 45m')
  })
})
