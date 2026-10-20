import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { RoomChecksScreen } from '../RoomChecksScreen'
import { createRoomCheck, getRoomCheckBoard } from '../../services/api'
import type { AuthSession } from '../../types'
import { localToday } from '../../utils/localDay'

jest.mock('../../services/api', () => ({
  getRoomCheckBoard: jest.fn(),
  createRoomCheck: jest.fn(),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticMedium: jest.fn(),
}))

const mockedBoard = getRoomCheckBoard as jest.MockedFunction<typeof getRoomCheckBoard>
const mockedCreate = createRoomCheck as jest.MockedFunction<typeof createRoomCheck>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER' },
} as AuthSession

const today = localToday()

const board = (checked = false) => ({
  applicable: true,
  today,
  due_hour: 18,
  due: true,
  outstanding: checked ? 0 : 2,
  rooms: [
    {
      room_number: '12',
      room_key: '12',
      location_id: 'loc-1',
      location_name: 'Ash Grove',
      checked_at: checked ? new Date().toISOString() : null,
      checked_by_name: checked ? 'Priya Sharma' : null,
      status: checked ? 'pass' : null,
    },
    {
      room_number: '14',
      room_key: '14',
      location_id: 'loc-1',
      location_name: 'Ash Grove',
      checked_at: null,
      checked_by_name: null,
      status: null,
    },
  ],
})

function renderScreen(onChanged = jest.fn()) {
  return { onChanged, ...render(<RoomChecksScreen session={session} onBack={jest.fn()} onChanged={onChanged} />) }
}

describe('RoomChecksScreen', () => {
  beforeEach(() => {
    mockedBoard.mockResolvedValue(board() as any)
    mockedCreate.mockResolvedValue({ id: 'rc-1' } as any)
  })

  it('shows the rooms the sweep says have no check today', async () => {
    const { findByText, getByTestId } = renderScreen()

    expect(await findByText('Room 12')).toBeTruthy()
    expect(await findByText('Room 14')).toBeTruthy()
    // What the nudge asked for, and what is still owed, in one line.
    expect(await findByText('0 of 2 checked today')).toBeTruthy()
    expect(await findByText(/Due by 18:00 — overdue since then/)).toBeTruthy()
    expect(getByTestId('room-check-outstanding').props.children).toBe(2)
  })

  it('records a check from the phone and clears the room', async () => {
    const { findByTestId, findByText } = renderScreen()

    fireEvent.press(await findByTestId('room-check-12'))
    fireEvent.press(await findByTestId('room-check-status-needs_attention'))
    fireEvent.press(await findByTestId('cleanliness-4'))
    fireEvent.press(await findByTestId('safety-5'))
    fireEvent.changeText(await findByTestId('room-check-notes'), 'Window catch loose')

    // The board reloads with the room checked, which is what "cleared" means.
    mockedBoard.mockResolvedValue(board(true) as any)
    fireEvent.press(await findByTestId('room-check-save'))

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith('token-1', {
      room_number: '12',
      location_id: 'loc-1',
      status: 'needs_attention',
      cleanliness_rating: 4,
      safety_rating: 5,
      notes: 'Window catch loose',
    }))
    expect(await findByText('Room 12 checked.')).toBeTruthy()
    await waitFor(() => expect(mockedBoard).toHaveBeenCalledTimes(2))
  })

  it('leaves the answers in the sheet when the save fails, with the reason', async () => {
    mockedCreate.mockRejectedValue(new Error('Room check could not be recorded'))
    const { findByTestId, queryByText } = renderScreen()

    fireEvent.press(await findByTestId('room-check-14'))
    fireEvent.press(await findByTestId('room-check-save'))

    // The error belongs where the worker is looking, not behind the sheet that hides
    // the answer they just gave.
    expect(await findByTestId('room-check-save-error')).toBeTruthy()
    expect(await findByTestId('room-check-save')).toBeTruthy()
    expect(queryByText('Room 14 checked.')).toBeNull()
  })

  it('says why the board is empty instead of looking like there is nothing to do', async () => {
    mockedBoard.mockRejectedValue(new Error('Could not load room checks'))
    const { findByTestId } = renderScreen()

    expect(await findByTestId('room-check-retry')).toBeTruthy()
  })

  it('tells a provider with no rooms that room checks do not apply', async () => {
    mockedBoard.mockResolvedValue({ applicable: false, today, due_hour: 18, due: false, outstanding: 0, rooms: [] } as any)
    const { findByText } = renderScreen()

    expect(await findByText('Room checks are for residential care')).toBeTruthy()
  })

  it('shows a checked room with who checked it, rather than dropping it', async () => {
    mockedBoard.mockResolvedValue(board(true) as any)
    const { findByText, queryByTestId } = renderScreen()

    expect(await findByText(/Checked .* · Priya Sharma/)).toBeTruthy()
    // Nothing is outstanding, so the header count is gone rather than showing a zero.
    expect(queryByTestId('room-check-outstanding')).toBeNull()
  })
})
