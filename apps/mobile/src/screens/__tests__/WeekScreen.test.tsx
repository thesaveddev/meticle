import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { WeekScreen } from '../WeekScreen'
import { getMyShifts, getMyVisits } from '../../services/api'
import type { AuthSession, MyShift } from '../../types'

jest.mock('../../services/api', () => ({
  getMyVisits: jest.fn(async () => []),
  getMyShifts: jest.fn(async () => []),
}))

jest.mock('../../services/haptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
}))

// The map picker reaches for native map apps and the session; it is not what this
// suite is about, and it is not visible in any of these cases.
jest.mock('../../components/MapPickerModal', () => ({ MapPickerModal: () => null }))

const mockedGetShifts = getMyShifts as jest.MockedFunction<typeof getMyShifts>
const mockedGetVisits = getMyVisits as jest.MockedFunction<typeof getMyVisits>

const session = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  user: { id: 'user-1', email: 'carer@example.com', role: 'CARE_WORKER' },
  organization: { primary_service_type: 'supported_living', service_types: ['supported_living'] },
} as AuthSession

/** Today, so the row lands on the calendar's selected day. */
function todayAt(hour: number) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function shift(overrides: Partial<MyShift> = {}): MyShift {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    location_id: 'loc-1',
    location_name: 'Ash Grove',
    shift_type: 'day',
    status: 'filled',
    start_time: todayAt(8),
    end_time: todayAt(20),
    actual_start_at: null,
    actual_end_at: null,
    handover_due: false,
    handover: null,
    ...overrides,
  }
}

const handover = {
  id: 'handover-1',
  version: 2,
  author_name: 'Priya Sharma',
  recorded_at: todayAt(20),
  what_happened: 'Calm shift.',
  acknowledgement_count: 0,
  viewer_acknowledged: false,
  viewer_is_author: false,
}

describe('WeekScreen handovers', () => {
  beforeEach(() => {
    mockedGetVisits.mockResolvedValue([])
    mockedGetShifts.mockResolvedValue([])
  })

  it('shows which of today\'s shifts still owe a handover, and opens it', async () => {
    const onHandover = jest.fn()
    mockedGetShifts.mockResolvedValue([shift({ handover_due: true })])

    const { findByText } = render(
      <WeekScreen session={session} onVisit={jest.fn()} onSwap={jest.fn()} isSupportedLiving onHandover={onHandover} />,
    )

    // "Handover due" is the state the sweep also nudges about; the screen and the
    // notification say the same words so the carer recognises one in the other.
    expect(await findByText('Shift handovers')).toBeTruthy()
    fireEvent.press(await findByText('Handover due'))

    expect(onHandover).toHaveBeenCalledWith(expect.objectContaining({ id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }))
  })

  it('says a written handover has been read, rather than only that it exists', async () => {
    mockedGetShifts.mockResolvedValue([shift({
      handover: { ...handover, acknowledgement_count: 1, viewer_acknowledged: true },
    })])

    const { findByText } = render(
      <WeekScreen session={session} onVisit={jest.fn()} onSwap={jest.fn()} isSupportedLiving onHandover={jest.fn()} />,
    )

    // The transfer of responsibility is what the acknowledgement evidences, so it is
    // the thing the badge reports once there is one.
    expect(await findByText('Read by you · v2')).toBeTruthy()
  })

  it('distinguishes written-but-unread from not written at all', async () => {
    mockedGetShifts.mockResolvedValue([shift({ handover: handover })])

    const { findByText } = render(
      <WeekScreen session={session} onVisit={jest.fn()} onSwap={jest.fn()} isSupportedLiving onHandover={jest.fn()} />,
    )

    expect(await findByText('Awaiting read · v2')).toBeTruthy()
  })

  it('says which of the day\'s shifts is open, and opens its clock screen', async () => {
    const onShift = jest.fn()
    mockedGetShifts.mockResolvedValue([
      shift({ on_duty: true, clocked_on_at: todayAt(8) }),
      shift({ id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302', start_time: todayAt(20), end_time: todayAt(23) }),
    ])

    const { findByText } = render(
      <WeekScreen session={session} onVisit={jest.fn()} onSwap={jest.fn()} isSupportedLiving onHandover={jest.fn()} onShift={onShift} />,
    )

    // The schedule is where a shift is entered, so it says which one is still open —
    // and, per shift, whether anybody has clocked on at all.
    fireEvent.press(await findByText('On duty since 08:00 — clock off'))
    expect(onShift).toHaveBeenCalledWith(expect.objectContaining({ id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }))
    expect(await findByText('Not clocked on — clock on')).toBeTruthy()
  })

  it('does not offer clocking in from the list when the app has no screen for it', async () => {
    mockedGetShifts.mockResolvedValue([shift({ on_duty: true, clocked_on_at: todayAt(8) })])

    const { findByText, queryByText } = render(
      <WeekScreen session={session} onVisit={jest.fn()} onSwap={jest.fn()} isSupportedLiving onHandover={jest.fn()} />,
    )

    expect(await findByText('Shift handovers')).toBeTruthy()
    expect(queryByText('On duty since 08:00 — clock off')).toBeNull()
  })

  it('does not ask a domiciliary organisation about shifts it does not have', async () => {
    const { queryByText } = render(
      <WeekScreen
        session={{ ...session, organization: { primary_service_type: 'domiciliary' } } as AuthSession}
        onVisit={jest.fn()}
        onSwap={jest.fn()}
        onHandover={jest.fn()}
      />,
    )

    await waitFor(() => expect(mockedGetVisits).toHaveBeenCalled())
    expect(queryByText('Shift handovers')).toBeNull()
    expect(mockedGetShifts).not.toHaveBeenCalled()
  })
})
