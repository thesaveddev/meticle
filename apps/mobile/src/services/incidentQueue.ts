import { reportIncident } from './api'
import { readIncidentQueue, writeIncidentQueue } from './storage'
import type { IncidentReportPayload, QueuedIncidentReport } from '../types'

const MAX_RETRY_DELAY_MS = 15 * 60 * 1000
function isRetryableStatus(status: unknown): status is number {
  return typeof status === 'number' && ([401, 408, 429].includes(status) || status >= 500)
}
let flushQueue = Promise.resolve()
let queueMutation = Promise.resolve()

function makeSubmissionId(): string {
  const cryptoApi = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID()
  const bytes = cryptoApi?.getRandomValues
    ? cryptoApi.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  // This is an idempotency key, not a credential. Use the platform CSPRNG
  // where available; a UUID-shaped fallback keeps reporting available on RN
  // runtimes that have not installed Web Crypto polyfills.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function withQueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueMutation.then(operation, operation)
  queueMutation = result.then(() => undefined, () => undefined)
  return result
}

function isRetryable(error: any): boolean {
  const status = error?.status
  return typeof status !== 'number' || isRetryableStatus(status) // Network failures have no HTTP status.
}

function isPermanent(error: any): boolean {
  const status = error?.status
  return typeof status === 'number' && status >= 400 && status < 500 && !isRetryableStatus(status)
}

function belongsTo(item: QueuedIncidentReport, userId: string, organizationId: string | null): boolean {
  return item.ownerId === userId && item.organizationId === organizationId
}

function requestPayload(item: QueuedIncidentReport): IncidentReportPayload & { client_submission_id: string } {
  return {
    title: item.title,
    description: item.description,
    witnesses: item.witnesses,
    category_id: item.category_id,
    severity: item.severity,
    location: item.location,
    is_near_miss: item.is_near_miss,
    person_ids: item.person_ids,
    visit_id: item.visit_id,
    incident_date: item.incident_date,
    incident_time: item.incident_time,
    client_submission_id: item.id,
  }
}

export async function getIncidentQueue(userId: string, organizationId: string | null): Promise<QueuedIncidentReport[]> {
  return (await readIncidentQueue()).filter(item => belongsTo(item, userId, organizationId))
}

/** Send now; if the failure is transient, persist the same idempotency key for retry. */
export async function submitIncidentReport(
  token: string,
  userId: string,
  organizationId: string | null,
  report: IncidentReportPayload
): Promise<{ queued: boolean; id: string }> {
  const id = makeSubmissionId()
  const item: QueuedIncidentReport = {
    ...report,
    id,
    ownerId: userId,
    organizationId,
    createdAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
  }
  // Persist the idempotency key before sending. If the server commits but the
  // response is lost, the retry can only ever resolve to this same incident.
  await withQueueMutation(async () => {
    const queue = await readIncidentQueue()
    await writeIncidentQueue([...queue, item])
  })

  try {
    await reportIncident(token, requestPayload(item))
    try {
      await withQueueMutation(async () => {
        const queue = await readIncidentQueue()
        await writeIncidentQueue(queue.filter(candidate => candidate.id !== id))
      })
      return { queued: false, id }
    } catch {
      // The server accepted the report but local cleanup failed. Keep the
      // durable item; a later idempotent retry will safely clear it.
      return { queued: true, id }
    }
  } catch (error) {
    if (!isRetryable(error)) {
      if (isPermanent(error)) {
        await withQueueMutation(async () => {
          const queue = await readIncidentQueue()
          await writeIncidentQueue(queue.map(candidate => candidate.id === id ? {
            ...candidate,
            state: 'failed',
            permanent: true,
            error: (error as any)?.message || 'Could not submit incident report',
          } : candidate))
        })
      } else {
        await withQueueMutation(async () => {
          const queue = await readIncidentQueue()
          await writeIncidentQueue(queue.filter(candidate => candidate.id !== id))
        })
      }
      throw error
    }
    const delay = 2_000
    try {
      await withQueueMutation(async () => {
        const queue = await readIncidentQueue()
        await writeIncidentQueue(queue.map(candidate => candidate.id === id ? {
          ...candidate,
          state: 'failed',
          attempts: 1,
          error: (error as any)?.message || 'Could not sync incident report',
          nextAttemptAt: new Date(Date.now() + delay).toISOString(),
        } : candidate))
      })
    } catch {
      // Initial queue persistence succeeded before the request. If updating its
      // retry metadata fails, the original pending row is still safe to retry.
    }
    return { queued: true, id }
  }
}

async function flushForAccount(
  token: string,
  userId: string,
  organizationId: string | null
): Promise<{ synced: number; failed: number; remaining: number }> {
  const candidates = await withQueueMutation(async () => (await readIncidentQueue())
    .filter(item => belongsTo(item, userId, organizationId) && !item.permanent
      && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= Date.now())))
  let synced = 0
  let failed = 0

  for (const item of candidates) {
    const attempts = await withQueueMutation(async () => {
      const queue = await readIncidentQueue()
      const current = queue.find(candidate => candidate.id === item.id && belongsTo(candidate, userId, organizationId))
      if (!current || current.permanent
        || (current.nextAttemptAt && Date.parse(current.nextAttemptAt) > Date.now())) return null
      const nextAttempts = current.attempts + 1
      await writeIncidentQueue(queue.map(candidate => candidate.id === item.id
        ? { ...candidate, attempts: nextAttempts, state: 'pending' }
        : candidate))
      return nextAttempts
    })
    if (attempts === null) continue

    try {
      const result = await withQueueMutation(async () => {
        const queue = await readIncidentQueue()
        const current = queue.find(candidate => candidate.id === item.id && belongsTo(candidate, userId, organizationId))
        if (!current) return { sent: false as const }
        try {
          await reportIncident(token, requestPayload(current))
          return { sent: true as const }
        } catch (error) {
          throw { error, sent: true }
        }
      })
      if (!result.sent) continue
      await withQueueMutation(async () => {
        const queue = await readIncidentQueue()
        await writeIncidentQueue(queue.filter(candidate => candidate.id !== item.id))
      })
      synced += 1
    } catch (caught: any) {
      failed += 1
      const error = caught?.sent ? caught.error : caught
      const permanent = isPermanent(error)
      const delay = Math.min(1000 * 2 ** Math.min(attempts, 10), MAX_RETRY_DELAY_MS)
      if (!caught?.sent) continue
      await withQueueMutation(async () => {
        const queue = await readIncidentQueue()
        await writeIncidentQueue(queue.map(candidate => candidate.id === item.id
          ? {
              ...candidate,
              state: 'failed',
              error: error?.message || 'Could not sync incident report',
              permanent,
              ...(permanent ? {} : { nextAttemptAt: new Date(Date.now() + delay).toISOString() }),
            }
          : candidate))
      }).catch(() => {
        // The durable pre-send row remains intact and will be retried safely.
      })
    }
  }

  const remaining = (await readIncidentQueue()).filter(item => belongsTo(item, userId, organizationId))
  return { synced, failed, remaining: remaining.length }
}

/** Retry due reports for this account; concurrent foreground/manual syncs are serialized. */
export function flushIncidentQueue(
  token: string,
  userId: string,
  organizationId: string | null
): Promise<{ synced: number; failed: number; remaining: number }> {
  const result = flushQueue.then(() => flushForAccount(token, userId, organizationId))
  flushQueue = result.then(() => undefined, () => undefined)
  return result
}
