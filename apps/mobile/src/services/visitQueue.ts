import { executeVisitAction } from './api'
import { readQueue, writeQueue } from './storage'
import type { OfflineVisitAction, VisitAction } from '../types'

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueueVisitAction(visitId: string, action: VisitAction, payload: OfflineVisitAction['payload']) {
  const item: OfflineVisitAction = { id: makeId(), visitId, action, payload, createdAt: new Date().toISOString(), state: 'pending' }
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
    if (item.state === 'failed') { next.push(item); continue }
    const syncing = { ...item, state: 'syncing' as const }
    await writeQueue(queue.map(candidate => candidate.id === item.id ? syncing : candidate))
    try {
      await executeVisitAction(token, item.visitId, item.action, item.payload, item.id)
      synced += 1
    } catch (error: any) {
      failed += 1
      next.push({ ...item, state: 'failed', error: error?.message || 'Sync failed' })
    }
  }
  await writeQueue(next)
  return { synced, failed, remaining: next.length }
}
