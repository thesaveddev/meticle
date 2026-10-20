/**
 * The browser's side of the offline action contract.
 *
 * A support worker clocks on at the start of a shift standing in a building with
 * no signal as often as with one, and a clock-on that vanishes because the
 * request never left the phone is worse than no button at all — the worker
 * believes they are on duty and the record says nobody was. So a clock action
 * that fails to reach the server is kept here, with the action key that was
 * generated for it, and sent again on the next attempt.
 *
 * The key is the whole point: it is generated once, when the worker presses the
 * button, and reused for every retry. The API treats (organisation, action key)
 * as unique, so the retry is recognised as the same clock-on rather than
 * recorded as a second one — the same contract the mobile app's visit queue
 * uses for domiciliary check-ins.
 */

export type PendingShiftActionKind = 'clock-on' | 'clock-off' | 'handover'

export interface PendingShiftAction {
  /** The `action_key` the API sees. Generated once, never regenerated. */
  key: string
  shiftId: string
  action: PendingShiftActionKind
  payload: Record<string, unknown>
  createdAt: string
}

const STORAGE_KEY = 'meticle.pendingShiftActions'

/** The part of `localStorage` this module needs, so a test can pass its own. */
export type ActionStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): ActionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return null
  }
}

function isPendingAction(value: unknown): value is PendingShiftAction {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PendingShiftAction>
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.shiftId === 'string' &&
    (candidate.action === 'clock-on' || candidate.action === 'clock-off' || candidate.action === 'handover') &&
    !!candidate.payload && typeof candidate.payload === 'object'
  )
}

export function readPendingShiftActions(storage: ActionStorage | null = browserStorage()): PendingShiftAction[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    // A queue written by an older build, or corrupted, is dropped rather than
    // crashing the panel — the action it held is already unrecoverable.
    return Array.isArray(parsed) ? parsed.filter(isPendingAction) : []
  } catch {
    return []
  }
}

function writePendingShiftActions(actions: PendingShiftAction[], storage: ActionStorage | null): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(actions))
  } catch {
    // A full or unavailable quota is not worth failing the clock-on the worker
    // just made; the action itself already succeeded or is being retried.
  }
}

/** A key for one attempt at one action, reused by every retry of it. */
export function newActionKey(): string {
  const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (webCrypto && typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function queueShiftAction(
  action: Pick<PendingShiftAction, 'shiftId' | 'action' | 'payload'> & { key?: string },
  storage: ActionStorage | null = browserStorage(),
): PendingShiftAction[] {
  // The key an attempt was already sent with is the key the retry must use. If
  // the payload carries one, it came from a press that did reach the point of
  // being sent — generating a fresh key here would turn the retry into a second
  // action, which is the one thing this queue exists to prevent.
  const payloadKey = typeof action.payload?.action_key === 'string' ? action.payload.action_key : null
  const item: PendingShiftAction = {
    key: action.key || payloadKey || newActionKey(),
    shiftId: action.shiftId,
    action: action.action,
    payload: action.payload,
    createdAt: new Date().toISOString(),
  }
  const next = [...readPendingShiftActions(storage), item]
  writePendingShiftActions(next, storage)
  return next
}

export function removePendingShiftAction(
  key: string,
  storage: ActionStorage | null = browserStorage(),
): PendingShiftAction[] {
  const next = readPendingShiftActions(storage).filter((item) => item.key !== key)
  writePendingShiftActions(next, storage)
  return next
}

export function pendingActionsForShift(
  shiftId: string,
  storage: ActionStorage | null = browserStorage(),
): PendingShiftAction[] {
  return readPendingShiftActions(storage).filter((item) => item.shiftId === shiftId)
}

/**
 * Distinguishes "the network let us down" from "the server will never accept
 * this". No status at all means the request never reached the server, and 401,
 * 408 and 429 are conditions that clear on their own; every other 4xx is the
 * payload being refused, and retrying it forever would be pointless.
 */
export function isPermanentFailure(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (typeof status !== 'number') return false
  if (status === 401 || status === 408 || status === 429) return false
  return status >= 400 && status < 500
}

/**
 * Send everything the queue holds. An action the server accepted — whether it
 * performed it or recognised the key as one it had already performed — is done
 * and leaves the queue; only a transport failure keeps it.
 */
export async function flushPendingShiftActions(
  send: (action: PendingShiftAction) => Promise<unknown>,
  storage: ActionStorage | null = browserStorage(),
): Promise<{ synced: number; remaining: number }> {
  const queue = readPendingShiftActions(storage)
  const next: PendingShiftAction[] = []
  let synced = 0

  for (const item of queue) {
    try {
      await send(item)
      synced += 1
    } catch (error) {
      if (isPermanentFailure(error)) continue
      next.push(item)
    }
  }

  writePendingShiftActions(next, storage)
  return { synced, remaining: next.length }
}
