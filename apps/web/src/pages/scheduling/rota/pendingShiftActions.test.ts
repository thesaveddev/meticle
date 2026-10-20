import { describe, it, expect, vi } from 'vitest'
import {
  flushPendingShiftActions, isPermanentFailure, newActionKey, pendingActionsForShift,
  queueShiftAction, readPendingShiftActions, removePendingShiftAction,
} from './pendingShiftActions'

/**
 * The queue's job is that a retry is the same action, not a second one. Every
 * assertion here is about the key surviving: it is generated once, reused on
 * every resend, and dropped only when the server has refused the action for a
 * reason retrying cannot fix.
 */

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
  }
}

describe('pending shift actions', () => {
  it('keeps the same key when an action is sent again', async () => {
    const storage = memoryStorage()
    const queued = queueShiftAction({ shiftId: 'shift-1', action: 'clock-on', payload: { recorded_at: 'then' } }, storage)
    const key = queued[0].key

    const send = vi.fn().mockRejectedValue(new Error('Network Error'))
    const result = await flushPendingShiftActions(send, storage)

    expect(result).toEqual({ synced: 0, remaining: 1 })
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ key }))
    // The retry carries the key the worker's press generated, which is what the
    // API recognises as the same clock-on.
    expect(readPendingShiftActions(storage)[0].key).toBe(key)
  })

  it('reuses the key an attempt was already sent with, rather than making a second action of it', () => {
    const storage = memoryStorage()
    // This is the shape the panel queues after a request that never arrived: the
    // payload already holds the key the worker's press generated.
    const queued = queueShiftAction(
      { shiftId: 'shift-1', action: 'clock-on', payload: { action_key: 'key-from-the-press' } },
      storage,
    )
    expect(queued[0].key).toBe('key-from-the-press')
  })

  it('drops an action the server refused, and keeps one it never received', async () => {
    const storage = memoryStorage()
    queueShiftAction({ shiftId: 'shift-1', action: 'clock-off', payload: {} }, storage)
    queueShiftAction({ shiftId: 'shift-2', action: 'clock-on', payload: {} }, storage)

    const refused = { response: { status: 409, data: { message: 'You are not clocked on to this shift' } } }
    const send = vi.fn().mockImplementation(async (action) => {
      if (action.action === 'clock-off') throw refused
      throw new Error('Network Error')
    })

    const result = await flushPendingShiftActions(send, storage)

    expect(result.synced).toBe(0)
    expect(result.remaining).toBe(1)
    expect(readPendingShiftActions(storage).map((a) => a.shiftId)).toEqual(['shift-2'])
  })

  it('clears an action the server accepted, whether it performed it or recognised the key', async () => {
    const storage = memoryStorage()
    queueShiftAction({ shiftId: 'shift-1', action: 'clock-on', payload: {} }, storage)

    // A replayed action answers 200 with `replayed: true`; it is still done.
    const send = vi.fn().mockResolvedValue({ data: { replayed: true } })
    const result = await flushPendingShiftActions(send, storage)

    expect(result).toEqual({ synced: 1, remaining: 0 })
    expect(readPendingShiftActions(storage)).toEqual([])
  })

  it('keeps one shift\u2019s queue out of another\u2019s', () => {
    const storage = memoryStorage()
    queueShiftAction({ shiftId: 'shift-1', action: 'clock-on', payload: {} }, storage)
    queueShiftAction({ shiftId: 'shift-2', action: 'clock-on', payload: {} }, storage)

    expect(pendingActionsForShift('shift-1', storage)).toHaveLength(1)
    expect(pendingActionsForShift('shift-2', storage)).toHaveLength(1)

    removePendingShiftAction(pendingActionsForShift('shift-1', storage)[0].key, storage)
    expect(pendingActionsForShift('shift-1', storage)).toHaveLength(0)
    expect(pendingActionsForShift('shift-2', storage)).toHaveLength(1)
  })

  it('ignores a queue it cannot read rather than throwing at the worker', () => {
    const storage = memoryStorage()
    storage.setItem('meticle.pendingShiftActions', 'not json')
    expect(readPendingShiftActions(storage)).toEqual([])

    storage.setItem('meticle.pendingShiftActions', JSON.stringify([{ nope: true }, { key: 'k', shiftId: 's', action: 'nonsense', payload: {} }]))
    expect(readPendingShiftActions(storage)).toEqual([])
  })

  it('generates a distinct key for each action', () => {
    const keys = new Set(Array.from({ length: 20 }, () => newActionKey()))
    expect(keys.size).toBe(20)
  })
})

describe('isPermanentFailure', () => {
  it('treats a refusal as permanent and a transport problem as not', () => {
    expect(isPermanentFailure({ response: { status: 409 } })).toBe(true)
    expect(isPermanentFailure({ response: { status: 403 } })).toBe(true)
    // These clear on their own: a refreshed session, a timeout, a rate limit.
    expect(isPermanentFailure({ response: { status: 401 } })).toBe(false)
    expect(isPermanentFailure({ response: { status: 408 } })).toBe(false)
    expect(isPermanentFailure({ response: { status: 429 } })).toBe(false)
    // No status at all means the request never reached the server.
    expect(isPermanentFailure(new Error('Network Error'))).toBe(false)
    expect(isPermanentFailure(undefined)).toBe(false)
  })
})
