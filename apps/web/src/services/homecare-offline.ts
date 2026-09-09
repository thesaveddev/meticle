import api from './api'

export type HomecareOfflineAction = {
  actionKey: string
  visitId: string
  action: 'check-in' | 'check-out'
  payload: Record<string, unknown>
  createdAt: string
  status: 'pending' | 'failed'
  error?: string
}

const STORAGE_KEY = 'meticle.homecare.offline-actions'

function readQueue(): HomecareOfflineAction[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeQueue(queue: HomecareOfflineAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

function makeActionKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function enqueueHomecareAction(visitId: string, action: HomecareOfflineAction['action'], payload: Record<string, unknown>) {
  const item: HomecareOfflineAction = { actionKey: makeActionKey(), visitId, action, payload, createdAt: new Date().toISOString(), status: 'pending' }
  writeQueue([...readQueue(), item])
  return item
}

export function getHomecareOfflineQueue() {
  return readQueue()
}

export async function flushHomecareOfflineQueue(): Promise<{ processed: number; failed: number }> {
  const queue = readQueue()
  let processed = 0
  let failed = 0
  for (const item of queue) {
    if (item.status === 'failed') continue
    try {
      await api.post(`/homecare/visits/${item.visitId}/offline/${item.action}`, { ...item.payload, action_key: item.actionKey })
      writeQueue(readQueue().filter(candidate => candidate.actionKey !== item.actionKey))
      processed += 1
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Sync failed'
      writeQueue(readQueue().map(candidate => candidate.actionKey === item.actionKey ? { ...candidate, status: 'failed', error: message } : candidate))
      failed += 1
    }
  }
  return { processed, failed }
}
