import { ApiError, replayShiftClockAction } from './api'
import { readShiftClockQueue, writeShiftClockQueue } from './storage'
import type { QueuedShiftClockAction } from '../types'
import type { ShiftClockInput } from './api'

/**
 * The phone's side of the shift clock-on/off offline contract (blueprint §9.1).
 *
 * A clock-on is the evidence that the worker was on duty, and they press it standing
 * on a doorstep as often as at a desk. Losing it because the request never left the
 * phone is worse than no button at all: the worker believes the shift is open and the
 * rota says nobody turned up. So a failed press is kept here with the key it was
 * created with, and resent on the next attempt.
 *
 * That key is the whole contract. It is generated once, when the worker presses the
 * button, and reused by every retry; the API treats `(organisation, action key)` as
 * unique, so the retry is recognised as the same clock-on rather than recorded as a
 * second one. Generating a fresh key on retry would be the one bug this module exists
 * to prevent.
 */

/** A key for one press, reused by every retry of it. */
export function newShiftActionKey(): string {
  const random = globalThis.crypto as Crypto | undefined
  if (random && typeof random.randomUUID === 'function') return random.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Distinguishes "the network let us down" from "the server will never accept this".
 *
 * No status at all means the request never reached the server, and 401, 408 and 429
 * are conditions that clear on their own. Every other 4xx is the payload being
 * refused — a clock-off already recorded, a shift the worker was removed from — and
 * retrying it forever would only hide the truth the reload would show.
 */
export function isPermanentClockFailure(error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : (error as { status?: number })?.status
  if (typeof status !== 'number') return false
  if (status === 401 || status === 408 || status === 429) return false
  return status >= 400 && status < 500
}

/**
 * Keep a press that could not be sent.
 *
 * The payload's own `action_key` is the key of the action; a second press of the same
 * button while one is already queued is the same intent, so it replaces the entry
 * rather than stacking a duplicate behind it.
 */
export async function queueShiftClockAction(item: {
  shiftId: string
  action: 'clock-on' | 'clock-off'
  payload: Required<Pick<ShiftClockInput, 'action_key' | 'recorded_at'>> & ShiftClockInput
}): Promise<QueuedShiftClockAction[]> {
  const queued: QueuedShiftClockAction = {
    key: item.payload.action_key,
    shiftId: item.shiftId,
    action: item.action,
    payload: item.payload,
    createdAt: new Date().toISOString(),
  }
  const existing = await readShiftClockQueue()
  const next = [
    ...existing.filter(entry => !(entry.shiftId === item.shiftId && entry.action === item.action)),
    queued,
  ]
  await writeShiftClockQueue(next)
  return next.filter(entry => entry.shiftId === item.shiftId)
}

/** The saved actions for one shift, oldest first. */
export async function pendingShiftClockActions(shiftId?: string): Promise<QueuedShiftClockAction[]> {
  const queue = await readShiftClockQueue()
  return shiftId ? queue.filter(item => item.shiftId === shiftId) : queue
}

/**
 * Send everything the queue holds, or everything it holds for one shift.
 *
 * An action the server accepted — whether it performed it or recognised the key as
 * one it had already performed — leaves the queue. A refusal leaves it too, because
 * the reload that follows shows what the server actually recorded; only a transport
 * failure keeps the action waiting.
 */
export async function flushShiftClockActions(
  token: string,
  options: { shiftId?: string } = {},
): Promise<{ synced: number; remaining: number; refused: number }> {
  const queue = await readShiftClockQueue()
  const inScope = (item: QueuedShiftClockAction) => !options.shiftId || item.shiftId === options.shiftId
  const next: QueuedShiftClockAction[] = []
  let synced = 0
  let refused = 0

  for (const item of queue) {
    if (!inScope(item)) { next.push(item); continue }
    try {
      await replayShiftClockAction(token, item.shiftId, item.action, item.payload)
      synced += 1
    } catch (error) {
      if (isPermanentClockFailure(error)) { refused += 1; continue }
      next.push(item)
    }
  }

  await writeShiftClockQueue(next)
  return {
    synced,
    refused,
    remaining: next.filter(inScope).length,
  }
}
