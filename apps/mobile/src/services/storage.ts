import * as SecureStore from 'expo-secure-store'
import type { AuthSession, OfflineVisitAction, QueuedIncidentReport } from '../types'

const SESSION_KEY = 'meticlecare.session'
const QUEUE_KEY = 'meticlecare.visit-queue'
const INCIDENT_QUEUE_KEY = 'meticlecare.incident-queue'
const INCIDENT_QUEUE_ITEM_PREFIX = `${INCIDENT_QUEUE_KEY}.item.`
const MAX_INCIDENT_QUEUE_ITEMS = 40
const INCIDENT_CHUNK_SIZE = 100
const MAX_INCIDENT_ITEM_CHARACTERS = 20_000

export async function readSession(): Promise<AuthSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY)
  if (!value) return null
  try { return JSON.parse(value) as AuthSession } catch { return null }
}

export async function writeSession(session: AuthSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

export async function readQueue(): Promise<OfflineVisitAction[]> {
  const value = await SecureStore.getItemAsync(QUEUE_KEY)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export async function writeQueue(queue: OfflineVisitAction[]) {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue))
}

interface IncidentQueueReference {
  id?: string
  storageId: string
}

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

function isQueuedIncidentReport(value: unknown, expectedId: string): value is QueuedIncidentReport {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<QueuedIncidentReport>
  return item.id === expectedId
    && isUuid(item.id)
    && isUuid(item.ownerId)
    && (item.organizationId === null || isUuid(item.organizationId))
    && typeof item.title === 'string' && item.title.length <= 500
    && ['low', 'medium', 'high', 'critical'].includes(item.severity || '')
    && /^\d{4}-\d{2}-\d{2}$/.test(item.incident_date || '')
    && typeof item.createdAt === 'string'
    && Number.isFinite(Date.parse(item.createdAt))
    && Number.isInteger(item.attempts) && (item.attempts || 0) >= 0
    && (item.state === 'pending' || item.state === 'failed')
    && (item.description === undefined || typeof item.description === 'string' && item.description.length <= 10_000)
    && (item.witnesses === undefined || typeof item.witnesses === 'string' && item.witnesses.length <= 2_000)
    && (item.category_id === undefined || isUuid(item.category_id))
    && (item.location === undefined || typeof item.location === 'string' && item.location.length <= 500)
    && (item.is_near_miss === undefined || typeof item.is_near_miss === 'boolean')
    && (item.incident_time === undefined || /^\d{2}:\d{2}$/.test(item.incident_time))
    && (item.permanent === undefined || typeof item.permanent === 'boolean')
    && (item.error === undefined || typeof item.error === 'string')
    && (item.nextAttemptAt === undefined || Number.isFinite(Date.parse(item.nextAttemptAt)))
    && (item.visit_id === undefined || isUuid(item.visit_id))
    && (item.person_ids === undefined || Array.isArray(item.person_ids) && item.person_ids.every(isUuid))
}

function parseIncidentQueueReferences(value: string | null): IncidentQueueReference[] {
  if (!value || value.length > 1800) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry): IncidentQueueReference[] => {
      // Read the original id-only format during the queue's on-device migration.
      if (isUuid(entry)) return [{ id: entry, storageId: entry }]
      // Current snapshots use the report UUID plus a one-character slot. This
      // keeps the index bounded while allowing an atomic A/B snapshot swap.
      if (typeof entry === 'string' && /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})[ab]$/i.test(entry)) {
        return [{ id: entry.slice(0, 36), storageId: entry }]
      }
      if (entry && typeof entry === 'object' && isUuid((entry as IncidentQueueReference).id)
        && typeof (entry as IncidentQueueReference).storageId === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[ab]$/i.test((entry as IncidentQueueReference).storageId)) {
        return [{ id: (entry as IncidentQueueReference).id, storageId: (entry as IncidentQueueReference).storageId }]
      }
      return []
    }).slice(0, MAX_INCIDENT_QUEUE_ITEMS)
  } catch { return [] }
}

export async function readIncidentQueue(): Promise<QueuedIncidentReport[]> {
  const references = parseIncidentQueueReferences(await SecureStore.getItemAsync(INCIDENT_QUEUE_KEY))
  const queue: QueuedIncidentReport[] = []
  for (const { id, storageId } of references) {
    const itemPrefix = `${INCIDENT_QUEUE_ITEM_PREFIX}${storageId}`
    const count = Number(await SecureStore.getItemAsync(`${itemPrefix}.count`))
    if (!Number.isInteger(count) || count < 1 || count > Math.ceil(MAX_INCIDENT_ITEM_CHARACTERS / INCIDENT_CHUNK_SIZE)) continue
    const chunks: string[] = []
    for (let index = 0; index < count; index++) {
      const chunk = await SecureStore.getItemAsync(`${itemPrefix}.${index}`)
      if (chunk === null) break
      chunks.push(chunk)
    }
    if (chunks.length !== count) continue
    try {
      const item: unknown = JSON.parse(chunks.join(''))
      if (isQueuedIncidentReport(item, id || (item as QueuedIncidentReport)?.id)) queue.push(item)
    } catch { /* Ignore a truncated item, not the rest of the queue. */ }
  }
  return queue
}

export async function writeIncidentQueue(queue: QueuedIncidentReport[]) {
  if (queue.length > MAX_INCIDENT_QUEUE_ITEMS) {
    throw new Error(`Offline incident queue is full. Sync existing reports before saving more (maximum ${MAX_INCIDENT_QUEUE_ITEMS}).`)
  }
  if (new Set(queue.map(item => item.id)).size !== queue.length || queue.some(item => !isQueuedIncidentReport(item, item.id))) {
    throw new Error('Offline incident queue contains an invalid report and was not changed.')
  }

  const oldIndexValue = await SecureStore.getItemAsync(INCIDENT_QUEUE_KEY)
  const oldReferences = parseIncidentQueueReferences(oldIndexValue)
  if (oldIndexValue && oldReferences.length === 0 && queue.length > 0) {
    throw new Error('Stored incident queue index is invalid; reports were not overwritten.')
  }
  const nextReferences: IncidentQueueReference[] = []
  const usedStorageIds = new Set<string>()
  const existingReferences = oldReferences
  const existingItems = await readIncidentQueue()
  const existingById = new Map(existingItems.map(item => [item.id, item]))
  const referenceById = new Map(existingReferences.map(reference => [reference.id, reference.storageId]))
  if (queue.some(item => referenceById.has(item.id) && !existingById.has(item.id))) {
    throw new Error('A queued incident snapshot is incomplete and was not overwritten.')
  }
  if (existingReferences.some(reference => !reference.id || !existingById.has(reference.id))) {
    throw new Error('Stored incident queue contains an invalid snapshot; reports were not overwritten.')
  }

  // Reuse unchanged encrypted snapshots. Each changed item alternates between
  // two UUID-named slots, so interrupted writes cannot overwrite the currently
  // indexed full item. Then the compact index swaps atomically.
  for (const item of queue) {
    const existing = existingById.get(item.id)
    const oldStorageId = referenceById.get(item.id)
    if (oldStorageId && existing && JSON.stringify(existing) === JSON.stringify(item)) {
      nextReferences.push({ id: item.id, storageId: oldStorageId })
      continue
    }

    const currentSlot = referenceById.get(item.id)?.slice(-1)
    const storageId = `${item.id}${currentSlot === 'a' ? 'b' : 'a'}`
    if (usedStorageIds.has(storageId)) throw new Error('Incident report storage index is invalid.')
    usedStorageIds.add(storageId)

    const serialized = JSON.stringify(item)
    const codePoints = Array.from(serialized)
    if (codePoints.length > MAX_INCIDENT_ITEM_CHARACTERS) {
      throw new Error('Incident report exceeds the secure offline size limit.')
    }
    const count = Math.ceil(codePoints.length / INCIDENT_CHUNK_SIZE)
    if (count < 1 || count > Math.ceil(MAX_INCIDENT_ITEM_CHARACTERS / INCIDENT_CHUNK_SIZE)) throw new Error('Incident report is too large to store securely on this device.')
    const itemPrefix = `${INCIDENT_QUEUE_ITEM_PREFIX}${storageId}`
    for (let index = 0; index < count; index++) {
      const chunk = codePoints.slice(index * INCIDENT_CHUNK_SIZE, (index + 1) * INCIDENT_CHUNK_SIZE).join('')
      await SecureStore.setItemAsync(`${itemPrefix}.${index}`, chunk)
    }
    await SecureStore.setItemAsync(`${itemPrefix}.count`, String(count))
    nextReferences.push({ id: item.id, storageId })
  }

  const nextIndexValue = JSON.stringify(nextReferences.map(reference => reference.storageId))
  if (nextIndexValue.length > 1800) throw new Error('Offline queue index is full. Sync pending reports before continuing.')
  await SecureStore.setItemAsync(INCIDENT_QUEUE_KEY, nextIndexValue)

  const retainedStorageIds = new Set(nextReferences.map(reference => reference.storageId))
  for (const { storageId } of oldReferences) {
    if (retainedStorageIds.has(storageId)) continue
    const itemPrefix = `${INCIDENT_QUEUE_ITEM_PREFIX}${storageId}`
    const count = Number(await SecureStore.getItemAsync(`${itemPrefix}.count`).catch(() => null))
    await SecureStore.deleteItemAsync(`${itemPrefix}.count`).catch(() => {})
    if (Number.isInteger(count) && count > 0 && count <= Math.ceil(MAX_INCIDENT_ITEM_CHARACTERS / INCIDENT_CHUNK_SIZE)) {
      for (let index = 0; index < count; index++) {
        await SecureStore.deleteItemAsync(`${itemPrefix}.${index}`).catch(() => {})
      }
    }
  }
}
