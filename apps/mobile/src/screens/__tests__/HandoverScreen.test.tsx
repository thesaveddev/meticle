import React from 'react'
import { Alert } from 'react-native'
import { act, render, fireEvent, waitFor } from '@testing-library/react-native'
import { HandoverScreen } from '../HandoverScreen'
import {
  ApiError,
  acknowledgeShiftHandover,
  getShift,
  getShiftHandover,
  recordShiftHandover,
} from '../../services/api'
import { clearHandoverDraft, readHandoverDraft, writeHandoverDraft } from '../../services/storage'
import type { AuthSession, ShiftHandoverView } from '../../types'

jest.mock('../../services/api', () => ({
  // The screen distinguishes "the server said no" from "nobody answered" by class,
  // so the real error type has to survive the mock.
  ApiError: jest.requireActual('../../services/api').ApiError,
  acknowledgeShiftHandover: jest.fn(),
  getShift: jest.fn(),
  getShiftHandover: jest.fn(),
  recordShiftHandover: jest.fn(),
}))

jest.mock('../../services/storage', () => ({
  readHandoverDraft: jest.fn(),
  writeHandoverDraft: jest.fn(),
  clearHandoverDraft: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticWarning: jest.fn(),
}))

const mockedGetHandover = getShiftHandover as jest.MockedFunction<typeof getShiftHandover>
const mockedGetShift = getShift as jest.MockedFunction<typeof getShift>
const mockedRecord = recordShiftHandover as jest.MockedFunction<typeof recordShiftHandover>
const mockedAcknowledge = acknowledgeShiftHandover as jest.MockedFunction<typeof acknowledgeShiftHandover>
const mockedReadDraft = readHandoverDraft as jest.MockedFunction<typeof readHandoverDraft>
const mockedWriteDraft = writeHandoverDraft as jest.MockedFunction<typeof writeHandoverDraft>
const mockedClearDraft = clearHandoverDraft as jest.MockedFunction<typeof clearHandoverDraft>

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
  start_time: '2026-10-16T08:00:00.000Z',
  end_time: '2026-10-16T20:00:00.000Z',
  actual_start_at: null,
  actual_end_at: null,
  handover_due: true,
  handover: null,
}

const EMPTY_VIEW: ShiftHandoverView = {
  handover: null,
  revisions: [],
  viewer_acknowledged: false,
  viewer_is_author: false,
}

function viewWith(overrides: Partial<NonNullable<ShiftHandoverView['handover']>> = {}, extra: Partial<ShiftHandoverView> = {}): ShiftHandoverView {
  return {
    handover: {
      id: 'handover-1',
      shift_id: 'shift-1',
      author_id: 'user-2',
      author_name: 'Priya Sharma',
      what_happened: 'Calm shift. Two residents at day service.',
      outstanding: 'Fluid chart for room 4 is incomplete.',
      who_is_aware: 'Night staff and the on-call manager.',
      version: 1,
      recorded_at: '2026-10-16T20:05:00.000Z',
      created_at: '2026-10-16T20:05:00.000Z',
      updated_at: '2026-10-16T20:05:00.000Z',
      acknowledgements: [],
      ...overrides,
    },
    revisions: [],
    viewer_acknowledged: false,
    viewer_is_author: false,
    ...extra,
  }
}

function renderScreen(onChanged = jest.fn()) {
  return render(<HandoverScreen session={session} shiftId="shift-1" shift={SHIFT as any} onBack={jest.fn()} onChanged={onChanged} />)
}

describe('HandoverScreen', () => {
  beforeEach(() => {
    mockedGetShift.mockResolvedValue(SHIFT as any)
    mockedGetHandover.mockResolvedValue(EMPTY_VIEW)
    mockedReadDraft.mockResolvedValue(null)
    mockedWriteDraft.mockResolvedValue(undefined)
    mockedClearDraft.mockResolvedValue(undefined)
    mockedRecord.mockResolvedValue({ handover: viewWith().handover!, created: true })
    mockedAcknowledge.mockResolvedValue({ acknowledgement: {} as any, replayed: false })
  })

  it('shows the handover the shift was handed over with', async () => {
    mockedGetHandover.mockResolvedValue(viewWith())
    const { findByText, getByText } = renderScreen()

    expect(await findByText('Calm shift. Two residents at day service.')).toBeTruthy()
    expect(getByText('Fluid chart for room 4 is incomplete.')).toBeTruthy()
    expect(getByText('Night staff and the on-call manager.')).toBeTruthy()
    // Who wrote it, and which version is current — the record, not just the text.
    expect(getByText(/Version 1 · Priya Sharma/)).toBeTruthy()
    expect(getByText('Nobody has read this yet')).toBeTruthy()
    // The header still says the handover was due, which is what the schedule showed.
    expect(getByText('Handover due')).toBeTruthy()
  })

  it('does not offer the author an acknowledgement it would refuse', async () => {
    mockedGetHandover.mockResolvedValue(viewWith({}, { viewer_is_author: true }))
    const { findByText, queryByLabelText } = renderScreen()

    expect(await findByText(/You wrote this handover/)).toBeTruthy()
    // A button whose only outcome is a 400 is worse than no button.
    expect(queryByLabelText('I have read this handover')).toBeNull()
  })

  it('records the acknowledgement of a reader, under their name', async () => {
    mockedGetHandover.mockResolvedValue(viewWith())
    const alert = jest.spyOn(Alert, 'alert')
    const onChanged = jest.fn()
    const { findByLabelText } = renderScreen(onChanged)

    fireEvent.press(await findByLabelText('I have read this handover'))
    // It is an evidence row, so it is confirmed rather than a stray tap away.
    expect(alert).toHaveBeenCalled()
    const confirm = alert.mock.calls[0][2]?.find(button => button.text === "I've read it")
    // The alert's own callback is outside the renderer, so its state updates have to
    // be wrapped: otherwise the test passes while React warns it could not track them.
    await act(async () => { await confirm?.onPress?.() })

    await waitFor(() => expect(mockedAcknowledge).toHaveBeenCalledWith('token-1', 'shift-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('records a new handover and clears the draft it supersedes', async () => {
    const onChanged = jest.fn()
    const { findByLabelText, getByLabelText } = renderScreen(onChanged)

    fireEvent.changeText(await findByLabelText('What happened during the shift'), '  Settled night.  ')
    fireEvent.changeText(getByLabelText('What is outstanding'), 'Order more continence pads.')
    fireEvent.press(await findByLabelText('Record handover'))

    await waitFor(() => expect(mockedRecord).toHaveBeenCalledWith('token-1', 'shift-1', {
      what_happened: 'Settled night.',
      outstanding: 'Order more continence pads.',
      who_is_aware: null,
    }))
    expect(mockedClearDraft).toHaveBeenCalledWith('shift-1')
    expect(onChanged).toHaveBeenCalled()
  })

  it('keeps the handover on the phone when it cannot reach the server', async () => {
    // fetch rejects with a TypeError, not an ApiError: the write never arrived.
    mockedRecord.mockRejectedValue(new TypeError('Network request failed'))
    const { findByLabelText, findByText } = renderScreen()

    fireEvent.changeText(await findByLabelText('What happened during the shift'), 'Quiet shift, all settled.')
    fireEvent.press(await findByLabelText('Record handover'))

    await waitFor(() => expect(mockedWriteDraft).toHaveBeenCalledWith(expect.objectContaining({
      shiftId: 'shift-1',
      whatHappened: 'Quiet shift, all settled.',
    })))
    expect(await findByText(/Saved on this phone/)).toBeTruthy()
    // Nothing was cleared: the draft is the only copy.
    expect(mockedClearDraft).not.toHaveBeenCalled()
  })

  it('shows a refusal from the server instead of pretending it was saved', async () => {
    mockedRecord.mockRejectedValue(new ApiError(403, 'Only staff on this shift can record its handover'))
    const { findByLabelText, findByText } = renderScreen()

    fireEvent.changeText(await findByLabelText('What happened during the shift'), 'Something.')
    fireEvent.press(await findByLabelText('Record handover'))

    expect(await findByText('Only staff on this shift can record its handover')).toBeTruthy()
    expect(mockedWriteDraft).not.toHaveBeenCalled()
  })

  it('offers back a handover that was typed with no connection', async () => {
    mockedReadDraft.mockResolvedValue({
      shiftId: 'shift-1',
      whatHappened: 'Draft from the night shift.',
      outstanding: '',
      whoIsAware: '',
      savedAt: '2026-10-16T20:10:00.000Z',
    })
    const { findByText, findByLabelText } = renderScreen()

    expect(await findByText(/This is the handover you started on this phone/)).toBeTruthy()
    expect((await findByLabelText('What happened during the shift')).props.value).toBe('Draft from the night shift.')
  })

  it('loads a shift by id when a notification opened the screen', async () => {
    const { findByText } = render(
      <HandoverScreen session={session} shiftId="shift-1" onBack={jest.fn()} />,
    )

    // No schedule row was passed, so the header has to come from the shift endpoint.
    expect(await findByText('Ash Grove')).toBeTruthy()
    expect(mockedGetShift).toHaveBeenCalledWith('token-1', 'shift-1')
  })
})
