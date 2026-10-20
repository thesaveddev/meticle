/**
 * A clock-on is the evidence that a worker was on duty, so a press that never left
 * the phone must survive until it lands — as the *same* action, not a second one.
 * These tests pin that, and pin the opposite rule for an action the server refuses,
 * which retrying forever would only hide.
 */
jest.mock('../storage', () => {
  let store: any[] = []
  return {
    readShiftClockQueue: jest.fn(async () => store.map(item => ({ ...item }))),
    writeShiftClockQueue: jest.fn(async (queue: any[]) => { store = queue.map(item => ({ ...item })) }),
    __store: () => store,
    __setStore: (next: any[]) => { store = next },
  }
})

jest.mock('../api', () => ({
  // The queue classifies failures by class, so the real error type has to survive.
  ApiError: jest.requireActual('../api').ApiError,
  replayShiftClockAction: jest.fn(),
}))

import { flushShiftClockActions, queueShiftClockAction } from '../shiftClockQueue'
import { ApiError, replayShiftClockAction } from '../api'
const storage = require('../storage')

const mockedReplay = replayShiftClockAction as jest.MockedFunction<typeof replayShiftClockAction>

const press = {
  shiftId: 'shift-1',
  action: 'clock-on' as const,
  payload: {
    action_key: 'key-from-the-press',
    recorded_at: '2026-10-18T07:58:00.000Z',
    note: 'Arrived to a quiet house',
  },
}

beforeEach(() => {
  storage.__setStore([])
  mockedReplay.mockReset()
  ;(storage.writeShiftClockQueue as jest.Mock).mockClear()
})

describe('shift clock queue', () => {
  it('keeps the key the press was created with, rather than inventing one', async () => {
    await queueShiftClockAction(press)

    const queued = storage.__store()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ key: 'key-from-the-press', shiftId: 'shift-1', action: 'clock-on' })
    // The device's own time is the evidence, not the moment the retry happens.
    expect(queued[0].payload.recorded_at).toBe('2026-10-18T07:58:00.000Z')
  })

  it('replaces a queued press of the same action instead of stacking duplicates', async () => {
    await queueShiftClockAction(press)
    await queueShiftClockAction({ ...press, payload: { ...press.payload, action_key: 'a-second-press' } })

    expect(storage.__store()).toHaveLength(1)
    expect(storage.__store()[0].key).toBe('a-second-press')
  })

  it('sends a queued action under the same key and clears it once accepted', async () => {
    await queueShiftClockAction(press)
    mockedReplay.mockResolvedValue({})

    const result = await flushShiftClockActions('token-1', { shiftId: 'shift-1' })

    expect(mockedReplay).toHaveBeenCalledWith('token-1', 'shift-1', 'clock-on', expect.objectContaining({
      action_key: 'key-from-the-press',
    }))
    expect(result).toMatchObject({ synced: 1, remaining: 0 })
    expect(storage.__store()).toHaveLength(0)
  })

  it('keeps an action that failed on a dropped connection', async () => {
    await queueShiftClockAction(press)
    mockedReplay.mockRejectedValue(new TypeError('Network request failed'))

    const result = await flushShiftClockActions('token-1')

    expect(result).toMatchObject({ synced: 0, remaining: 1 })
    expect(storage.__store()[0].key).toBe('key-from-the-press')
  })

  it('drops an action the server refused, because the reload is the truth', async () => {
    await queueShiftClockAction(press)
    mockedReplay.mockRejectedValue(new ApiError(409, 'You are already clocked on to this shift'))

    const result = await flushShiftClockActions('token-1')

    expect(result).toMatchObject({ synced: 0, refused: 1, remaining: 0 })
    expect(storage.__store()).toHaveLength(0)
  })

  it('leaves another shift’s saved actions alone', async () => {
    await queueShiftClockAction(press)
    await queueShiftClockAction({
      shiftId: 'shift-2',
      action: 'clock-off',
      payload: { action_key: 'other-shift-key', recorded_at: '2026-10-18T20:02:00.000Z' },
    })
    mockedReplay.mockResolvedValue({})

    const result = await flushShiftClockActions('token-1', { shiftId: 'shift-1' })

    expect(result).toMatchObject({ synced: 1, remaining: 0 })
    expect(storage.__store()).toHaveLength(1)
    expect(storage.__store()[0].shiftId).toBe('shift-2')
  })
})
