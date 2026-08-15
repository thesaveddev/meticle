import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { publishDomainEvent, processOutbox, listPendingEvents, retryEvent, cleanupOutbox, MAX_PUBLISH_ATTEMPTS } from './events.outbox'
import { registerConsumer, resetConsumers, DomainEvent } from './events.consumers'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express
const createdOrgIds: string[] = []

beforeAll(async () => {
  app = createTestApp()
  resetConsumers()
}, 30_000)

afterAll(async () => {
  for (const orgId of createdOrgIds) {
    await migrateQuery(`DELETE FROM event_consumers WHERE event_id IN (SELECT id FROM domain_events WHERE organization_id = $1)`, [orgId])
    await migrateQuery(`DELETE FROM domain_events WHERE organization_id = $1`, [orgId])
  }
  resetConsumers()
})

async function makeOrgAdmin() {
  const org = await createOrg()
  createdOrgIds.push(org.id)
  const user = await createUser({ email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@events-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  return { org, user, token: generateToken(user) }
}

describe('Event outbox — publish and deliver', () => {
  it('records an event in the outbox as pending', async () => {
    const { org } = await makeOrgAdmin()
    await publishDomainEvent({
      organizationId: org.id,
      eventName: 'test.recorded',
      aggregateType: 'test',
      aggregateId: org.id,
      payload: { hello: 'world' },
    })

    const pending = await listPendingEvents(org.id)
    expect(pending).toHaveLength(1)
    expect(pending[0].eventName).toBe('test.recorded')
    expect(pending[0].published).toBe(false)
    expect(pending[0].payload).toEqual({ hello: 'world' })
  })

  it('delivers a published event to a registered consumer', async () => {
    const { org } = await makeOrgAdmin()
    const delivered: DomainEvent[] = []
    registerConsumer('test.delivery', {
      name: 'delivery-consumer',
      handle: async (event) => { delivered.push(event) },
    })

    await publishDomainEvent({ organizationId: org.id, eventName: 'test.delivery', payload: { n: 1 } })
    const stats = await processOutbox(org.id)

    expect(stats.processed).toBe(1)
    expect(stats.published).toBe(1)
    expect(delivered).toHaveLength(1)
    expect(delivered[0].eventName).toBe('test.delivery')

    const rows = await migrateQuery(`SELECT status FROM event_consumers WHERE event_id = $1`, [delivered[0].id])
    expect(rows.rows[0].status).toBe('processed')
  })

  it('marks an event published immediately when no consumer is registered', async () => {
    const { org } = await makeOrgAdmin()
    await publishDomainEvent({ organizationId: org.id, eventName: 'test.no-consumer' })

    const stats = await processOutbox(org.id)
    expect(stats.noConsumers).toBe(1)
    expect(stats.published).toBe(1)
    expect(await listPendingEvents(org.id)).toHaveLength(0)
  })

  it('keeps an event pending when a consumer fails, then terminal-fails it after max attempts', async () => {
    const { org } = await makeOrgAdmin()
    registerConsumer('test.failing', {
      name: 'failing-consumer',
      handle: async () => { throw new Error('boom') },
    })

    await publishDomainEvent({ organizationId: org.id, eventName: 'test.failing' })

    // First two attempts leave it pending with attempts 1 and 2.
    await processOutbox(org.id)
    let pending = await listPendingEvents(org.id)
    expect(pending).toHaveLength(1)
    expect(pending[0].publishAttempts).toBe(1)

    await processOutbox(org.id)
    pending = await listPendingEvents(org.id)
    expect(pending).toHaveLength(1)
    expect(pending[0].publishAttempts).toBe(2)

    // Third attempt exhausts MAX_PUBLISH_ATTEMPTS -> terminal failed, leaves the queue.
    await processOutbox(org.id)
    pending = await listPendingEvents(org.id)
    expect(pending).toHaveLength(0)

    const rows = await migrateQuery(`SELECT status, publish_attempts, last_error FROM domain_events WHERE event_name = 'test.failing' AND organization_id = $1`, [org.id])
    expect(rows.rows[0].status).toBe('failed')
    expect(rows.rows[0].publish_attempts).toBe(MAX_PUBLISH_ATTEMPTS)
    expect(rows.rows[0].last_error).toMatch(/Final after/)
  })

  it('retry resets a failed event so it is delivered on the next pass', async () => {
    const { org } = await makeOrgAdmin()
    let fail = true
    const delivered: DomainEvent[] = []
    registerConsumer('test.retry', {
      name: 'retry-consumer',
      handle: async (event) => {
        if (fail) throw new Error('first-time-fail')
        delivered.push(event)
      },
    })

    const { id } = await publishDomainEvent({ organizationId: org.id, eventName: 'test.retry' })

    await processOutbox(org.id)
    let row = (await migrateQuery(`SELECT status, publish_attempts FROM domain_events WHERE id = $1`, [id])).rows[0]
    expect(row.status).toBe('pending')
    expect(row.publish_attempts).toBe(1)

    fail = false
    await retryEvent(org.id, id)
    const stats = await processOutbox(org.id)
    expect(stats.published).toBe(1)
    expect(delivered).toHaveLength(1)

    row = (await migrateQuery(`SELECT status FROM domain_events WHERE id = $1`, [id])).rows[0]
    expect(row.status).toBe('published')
  })
})

describe('Event outbox — HTTP endpoints', () => {
  it('lists pending events scoped to the caller org', async () => {
    const { org, token } = await makeOrgAdmin()
    await publishDomainEvent({ organizationId: org.id, eventName: 'http.pending', payload: { via: 'api' } })

    const res = await request(app)
      .get('/events/pending')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((e: any) => e.eventName === 'http.pending')).toBe(true)
  })

  it('drains pending events via POST /events/publish', async () => {
    const { org, token } = await makeOrgAdmin()
    const delivered: DomainEvent[] = []
    registerConsumer('http.drain', {
      name: 'http-drain-consumer',
      handle: async (event) => { delivered.push(event) },
    })
    await publishDomainEvent({ organizationId: org.id, eventName: 'http.drain' })

    const res = await request(app)
      .post('/events/publish')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.processed).toBe(1)
    expect(delivered).toHaveLength(1)
  })

  it('retries a failed event via POST /events/retry/:id', async () => {
    const { org, token } = await makeOrgAdmin()
    registerConsumer('http.retry', {
      name: 'http-retry-consumer',
      handle: async () => { throw new Error('nope') },
    })
    const { id } = await publishDomainEvent({ organizationId: org.id, eventName: 'http.retry' })
    await processOutbox(org.id)

    const res = await request(app)
      .post(`/events/retry/${id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')
    expect(res.body.publishAttempts).toBe(0)
  })

  it('returns the correlation chain for a flow', async () => {
    const { org, token } = await makeOrgAdmin()
    const correlationId = '123e4567-e89b-12d3-a456-426614174000'
    await publishDomainEvent({ organizationId: org.id, eventName: 'http.corr.1', correlationId })
    await publishDomainEvent({ organizationId: org.id, eventName: 'http.corr.2', correlationId })

    const res = await request(app)
      .get(`/events/correlation/${correlationId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.map((e: any) => e.eventName)).toEqual(['http.corr.1', 'http.corr.2'])
  })

  it('rejects non-admin access', async () => {
    const org = await createOrg()
    createdOrgIds.push(org.id)
    const worker = await createUser({ email: `worker-${Date.now()}@events-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const res = await request(app)
      .get('/events/pending')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('returns 404 for a retry of an event outside the org', async () => {
    const { org, token } = await makeOrgAdmin()
    const other = await createOrg()
    createdOrgIds.push(other.id)
    const { id } = await publishDomainEvent({ organizationId: other.id, eventName: 'http.foreign' })

    const res = await request(app)
      .post(`/events/retry/${id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})

describe('Event outbox — cleanup', () => {
  it('deletes only old published events', async () => {
    const { org } = await makeOrgAdmin()
    const { id } = await publishDomainEvent({ organizationId: org.id, eventName: 'cleanup.old' })
    await processOutbox(org.id)

    // Age it beyond the retention window.
    await migrateQuery(`UPDATE domain_events SET created_at = created_at - interval '200 days' WHERE id = $1`, [id])

    const deleted = await cleanupOutbox(1, 1)
    expect(deleted).toBeGreaterThan(0)

    const rows = await migrateQuery(`SELECT COUNT(*)::int AS cnt FROM domain_events WHERE id = $1`, [id])
    expect(rows.rows[0].cnt).toBe(0)
  })
})
