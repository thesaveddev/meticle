import { executeVisitAction } from './api'
import { readQueue, writeQueue } from './storage'
import type { OfflineVisitAction, VisitAction } from '../types'

/**
 * Visit evidence (a check-in with a timestamp and GPS fix) must not be lost to
 * a momentary network drop, so a failed action is retried on the next sync
 * rather than being abandoned. This bounds how many times that happens before
 * the action stops being retried on its own.
 */
const MAX_ATTEMPTS = 5

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Distinguishes "the network let us down" from "the server will never accept
 * this". No status at all means the request never reached the server, and 401,
 * 408 and 429 are all conditions that can clear on their own. Every other 4xx
 * is the payload being refused, and retrying it forever would be pointless.
 */
function isPermanentFailure(error: any): boolean {
  const status = error?.status
  if (typeof status !== 'number') return false
  if (status === 401 || status === 408 || status === 429) return false
  return status >= 400 && status < 500
}

export async function enqueueVisitAction(visitId: string, action: VisitAction, payload: OfflineVisitAction['payload']) {
  const item: OfflineVisitAction = { id: makeId(), visitId, action, payload, createdAt: new Date().toISOString(), state: 'pending', attempts: 0 }
  const queue = await readQueue()
  await writeQueue([...queue, item])
  return item
}

export async function getQueue() {
  return readQueue()
}

export async function flushQueue(token: string) {
  const queue = await readQueue()
  let synced = 0
  let failed = 0
  const next: OfflineVisitAction[] = []
  for (const item of queue) {
    if (item.permanent) { next.push(item); continue }
    const attempts = (item.attempts || 0) + 1
    if (attempts > MAX_ATTEMPTS) {
      next.push({ ...item, attempts, state: 'failed', error: item.error || 'Could not sync after several attempts' })
      continue
    }
    const syncing = { ...item, state: 'syncing' as const, attempts }
    await writeQueue(queue.map(candidate => candidate.id === item.id ? syncing : candidate))
    try {
      await executeVisitAction(token, item.visitId, item.action, item.payload, item.id)
      synced += 1
    } catch (error: any) {
      failed += 1
      next.push({
        ...item,
        attempts,
        state: 'failed',
        error: error?.message || 'Sync failed',
        permanent: isPermanentFailure(error),
      })
    }
  }
  await writeQueue(next)
  return { synced, failed, remaining: next.length }
}

/** Actions the server has refused outright, which retrying cannot fix. */
export async function getFailedQueue() {
  return (await readQueue()).filter(item => item.state === 'failed')
}
