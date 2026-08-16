import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { publishDomainEvent, processOutbox } from '../events/events.outbox'
import { registerConsumer, resetConsumers } from '../events/events.consumers'
import { MedicationMissedReviewsConsumer } from '../events/consumers/medication-missed-reviews.consumer'
import type { MedicationAdministrationMissedPayload } from './medication.events'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express
const createdOrgIds: string[] = []

beforeAll(async () => {
  app = createTestApp()
  registerConsumer('medication.administration_missed', MedicationMissedReviewsConsumer)
}, 30_000)

afterAll(async () => {
  for (const orgId of createdOrgIds) {
    await migrateQuery(`DELETE FROM event_consumers WHERE event_id IN (SELECT id FROM domain_events WHERE organization_id = $1)`, [orgId])
    await migrateQuery(`DELETE FROM domain_events WHERE organization_id = $1`, [orgId])
    await migrateQuery(`DELETE FROM tasks WHERE organization_id = $1`, [orgId])
    await migrateQuery(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)`, [orgId])
    await migrateQuery(`DELETE FROM emedication_audit_log WHERE organization_id = $1`, [orgId])
  }
  resetConsumers()
})

async function makeSetup() {
  const org = await createOrg()
  createdOrgIds.push(org.id)
  const admin = await createUser({
    email: `medm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
    password: 'TestPass123!',
    role: 'ORG_ADMIN',
    organization_id: org.id,
  })
  const person = await createPerson({ organizationId: org.id })
  const token = generateToken(admin)
  const itemRes = await request(app)
    .post('/emedication/records')
    .set('Authorization', `Bearer ${token}`)
    .send({ person_id: person.id, title: 'Missed-flow MAR', start_date: '2026-08-01', end_date: '2026-08-31' })
  if (itemRes.status !== 201) {
    throw new Error(`Failed to create MAR: ${itemRes.status} ${JSON.stringify(itemRes.body)}`)
  }
  const item = await request(app)
    .post(`/emedication/records/${itemRes.body.id}/items`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Warfarin', dosage: '2mg', unit: 'mg', frequency: 'once daily', route: 'oral' })
  if (item.status !== 201) {
    throw new Error(`Failed to add item: ${item.status} ${JSON.stringify(item.body)}`)
  }
  return { org, admin, person, token, recordId: itemRes.body.id, itemId: item.body.id }
}

describe('eMedication — MAR records, stock, deliveries, audit', () => {
  it('should create a record, add items, log administrations and view the chart', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const mgr = await createUser({ email: `em-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `em2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id, medicationCompetent: true })
    const token = generateToken(mgr)
    const workerToken = generateToken(worker)

    const record = await request(app)
      .post('/emedication/records')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, title: 'August MAR', start_date: '2026-08-01', end_date: '2026-08-31' })
    expect(record.status).toBe(201)
    expect(record.body.person_id).toBe(person.id)

    const item = await request(app)
      .post(`/emedication/records/${record.body.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Paracetamol', dosage: '500mg', unit: 'mg', frequency: 'twice daily', route: 'oral' })
    expect(item.status).toBe(201)

    if (item.body.stock_item_id) {
      const stocked = await request(app)
        .patch(`/emedication/stock/${item.body.stock_item_id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 100 })
      expect(stocked.status).toBe(200)
    }

    const admin = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ emedication_item_id: item.body.id, scheduled_time: '2026-08-15T08:00:00', status: 'given' })
    expect(admin.status).toBe(201)

    const chart = await request(app)
      .get(`/emedication/records/${record.body.id}/chart`)
      .set('Authorization', `Bearer ${token}`)
    expect(chart.status).toBe(200)

    const list = await request(app)
      .get('/emedication/records')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((r: any) => r.id === record.body.id)).toBe(true)

    const overdue = await request(app)
      .get('/emedication/overdue')
      .set('Authorization', `Bearer ${token}`)
    expect(overdue.status).toBe(200)

    const auditLogs = await request(app)
      .get('/emedication/audit-logs')
      .set('Authorization', `Bearer ${token}`)
    expect(auditLogs.status).toBe(200)
    expect(auditLogs.body.some((l: any) => l.action === 'create_record')).toBe(true)
  })

  it('should create stock and a delivery as CARE_WORKER', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `em3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const stock = await request(app)
      .post('/emedication/stock')
      .set('Authorization', `Bearer ${token}`)
      .send({ medication_name: 'Ibuprofen', dosage: '200mg', unit: 'mg', quantity: 100, reorder_level: 20 })
    expect(stock.status).toBe(201)
    expect(stock.body.medication_name).toBe('Ibuprofen')

    const stockList = await request(app)
      .get('/emedication/stock')
      .set('Authorization', `Bearer ${token}`)
    expect(stockList.status).toBe(200)
    expect(stockList.body.some((s: any) => s.id === stock.body.id)).toBe(true)

    const delivery = await request(app)
      .post('/emedication/deliveries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person_id: person.id,
        supplier: 'Boots',
        delivery_date: '2026-08-12',
        items: [{ medication_name: 'Ibuprofen', dosage: '200mg', quantity: 50, quantity_unit: 'tablets' }],
      })
    expect(delivery.status).toBe(201)
  })

  it('should reject a CARE_WORKER creating a MAR record (403)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `em4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/emedication/records')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ person_id: person.id, title: 'Nope', start_date: '2026-08-01', end_date: '2026-08-31' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/emedication/records')
    expect(res.status).toBe(401)
  })
})

describe('eMedication — medication.administration_missed outbox workflow (§13.1)', () => {
  it('logs a missed administration → publishes event → consumer drafts a high-priority task and notifies the org admin', async () => {
    const { org, admin, person, token, itemId } = await makeSetup()
    const fullName = `${person.first_name} ${person.last_name}`

    const res = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        emedication_item_id: itemId,
        scheduled_time: '2026-08-15T08:00:00',
        status: 'missed',
        notes: 'Person refused',
      })
    expect(res.status).toBe(201)

    // Outbox row exists with the expected payload shape.
    const events = await migrateQuery(
      `SELECT event_name, payload, status, published
       FROM domain_events
       WHERE organization_id = $1
         AND event_name = 'medication.administration_missed'`,
      [org.id]
    )
    expect(events.rows).toHaveLength(1)
    expect(events.rows[0].published).toBe(false)
    const payload = events.rows[0].payload as MedicationAdministrationMissedPayload
    expect(payload.medication_name).toBe('Warfarin')
    expect(payload.medication_dosage).toBe('2mg')
    expect(payload.person_name).toBe(fullName)
    expect(payload.person_id).toBe(person.id)
    expect(payload.notes).toBe('Person refused')
    expect(payload.is_prn).toBe(false)
    expect(payload.logged_by_user_id).toBe(admin.id)
    expect(payload.is_transition).toBe(true)

    // Drain the outbox.
    const stats = await processOutbox(org.id)
    expect(stats.processed).toBe(1)
    expect(stats.published).toBe(1)
    expect(stats.failed).toBe(0)

    // Consumer rows record success.
    const consumerRows = await migrateQuery(
      `SELECT consumer_name, status FROM event_consumers
       WHERE event_id IN (SELECT id FROM domain_events WHERE organization_id = $1)`,
      [org.id]
    )
    expect(consumerRows.rows).toHaveLength(1)
    expect(consumerRows.rows[0].consumer_name).toBe('medication-missed-reviews')
    expect(consumerRows.rows[0].status).toBe('processed')

    // The drafted task is present and well-formed.
    const tasks = await migrateQuery(
      `SELECT title, description, priority, status, person_id, created_by
       FROM tasks WHERE organization_id = $1`,
      [org.id]
    )
    expect(tasks.rows).toHaveLength(1)
    expect(tasks.rows[0].title).toBe(`Review missed Warfarin for ${fullName}`)
    expect(tasks.rows[0].priority).toBe('high')
    expect(tasks.rows[0].status).toBe('pending')
    expect(tasks.rows[0].person_id).toBe(person.id)
    expect(tasks.rows[0].description).toContain('Warfarin')
    expect(tasks.rows[0].description).toContain('2026-08-15T08:00:00')

    // The notification reached the ORG_ADMIN.
    const notes = await migrateQuery(
      `SELECT title, message, type, read FROM notifications WHERE user_id = $1`,
      [admin.id]
    )
    const reviewNote = notes.rows.find((n: any) => n.title === 'Missed medication needs review')
    expect(reviewNote).toBeTruthy()
    expect(reviewNote.message).toContain(fullName)
    expect(reviewNote.message).toContain('Warfarin')
    expect(reviewNote.read).toBe(false)
  })

  it('does NOT publish a missed event for a "given" administration', async () => {
    const { org, token, itemId } = await makeSetup()

    const res = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${token}`)
      .send({ emedication_item_id: itemId, scheduled_time: '2026-08-15T08:00:00', status: 'given' })
    expect(res.status).toBe(201)

    const events = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM domain_events
       WHERE organization_id = $1
         AND event_name = 'medication.administration_missed'`,
      [org.id]
    )
    expect(events.rows[0].n).toBe(0)
  })

  it('publishes a missed event when an existing "given" administration is patched to "missed"', async () => {
    const { org, token, itemId } = await makeSetup()

    const created = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${token}`)
      .send({ emedication_item_id: itemId, scheduled_time: '2026-08-15T08:00:00', status: 'given' })
    expect(created.status).toBe(201)

    const patched = await request(app)
      .patch(`/emedication/administrations/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'missed', notes: 'Late update' })
    expect(patched.status).toBe(200)

    const events = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM domain_events
       WHERE organization_id = $1
         AND event_name = 'medication.administration_missed'`,
      [org.id]
    )
    expect(events.rows[0].n).toBe(1)
  })

  it('does NOT re-emit when an already-missed administration is patched (no-op transition)', async () => {
    const { org, token, itemId } = await makeSetup()

    const created = await request(app)
      .post('/emedication/administrations')
      .set('Authorization', `Bearer ${token}`)
      .send({ emedication_item_id: itemId, scheduled_time: '2026-08-15T08:00:00', status: 'missed' })
    expect(created.status).toBe(201)

    const beforeCount = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM domain_events
       WHERE organization_id = $1
         AND event_name = 'medication.administration_missed'`,
      [org.id]
    )
    expect(beforeCount.rows[0].n).toBe(1)

    const patched = await request(app)
      .patch(`/emedication/administrations/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'missed', notes: 'Reaffirmed missed' })
    expect(patched.status).toBe(200)

    const afterCount = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM domain_events
       WHERE organization_id = $1
         AND event_name = 'medication.administration_missed'`,
      [org.id]
    )
    expect(afterCount.rows[0].n).toBe(1)

    // And only one task was drafted (consumer dedupe is exercised).
    const tasks = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM tasks WHERE organization_id = $1`,
      [org.id]
    )
    expect(tasks.rows[0].n).toBe(1)
  })

  it('drains a directly-published missed event through the consumer (no HTTP)', async () => {
    // Unit-style: confirm the consumer works against the outbox even when
    // the API path is bypassed (e.g. backfills or webhook-derived emissions).
    const { org, person } = await makeSetup()

    const { id } = await publishDomainEvent({
      organizationId: org.id,
      eventName: 'medication.administration_missed',
      aggregateType: 'emedication_administration',
      aggregateId: '00000000-0000-0000-0000-000000000099',
      correlationId: '00000000-0000-0000-0000-000000000099',
      payload: {
        id: '00000000-0000-0000-0000-000000000099',
        record_id: '00000000-0000-0000-0000-000000000098',
        item_id: '00000000-0000-0000-0000-000000000097',
        person_id: person.id,
        person_name: `${person.first_name} ${person.last_name}`,
        medication_name: 'Synthesised Med',
        medication_dosage: '5mg',
        scheduled_time: '2026-08-15T20:00:00',
        administered_time: null,
        reason: null,
        notes: 'Direct publish',
        location_id: null,
        is_prn: false,
        logged_by_user_id: '00000000-0000-0000-0000-000000000001',
        recorded_at: new Date().toISOString(),
        is_transition: true,
      } as unknown as Record<string, unknown>,
    })
    expect(id).toBeTruthy()

    const stats = await processOutbox(org.id)
    expect(stats.published).toBe(1)

    const tasks = await migrateQuery(
      `SELECT title FROM tasks WHERE organization_id = $1
         AND title = $2`,
      [org.id, `Review missed Synthesised Med for ${person.first_name} ${person.last_name}`]
    )
    expect(tasks.rows).toHaveLength(1)
  })
})
