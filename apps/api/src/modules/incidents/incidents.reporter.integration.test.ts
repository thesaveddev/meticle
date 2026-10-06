import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/**
 * A support worker who witnesses a fall, a medication error or a safeguarding
 * concern must be able to raise it from the field. This path was previously
 * closed to them entirely, which is a safeguarding control failure, not a
 * missing feature.
 */
async function team() {
  const org = await createOrg()
  const manager = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const worker = await createUser({ email: `worker-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const other = await createUser({ email: `other-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const resident = await createPerson({ organization_id: org.id })
  return { org, manager, worker, other, resident }
}

describe('Incidents — support worker reporting', () => {
  it('returns the original report for a repeated client submission id without duplicating side effects', async () => {
    const { org, manager, worker } = await team()
    const token = generateToken(worker)
    const submissionId = '7bc474bc-5f35-4d7b-8af0-8c1308494144'
    const report = {
      title: 'Fall in hallway',
      description: 'Found on the floor',
      witnesses: 'Jordan Smith',
      severity: 'high',
      incident_date: '2026-10-06',
      client_submission_id: submissionId,
    }

    const first = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send(report)
    const second = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send(report)

    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
    expect(second.body).not.toHaveProperty('was_created')

    const detail = await request(app).get(`/incidents/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.witnesses).toBe('Jordan Smith')

    const rows = await migrateQuery(
      'SELECT id FROM incidents WHERE organization_id = $1 AND reported_by = $2 AND client_submission_id = $3',
      [org.id, worker.id, submissionId]
    )
    expect(rows.rows).toHaveLength(1)

    const events = await migrateQuery(
      "SELECT id FROM domain_events WHERE organization_id = $1 AND event_name = 'incident.created' AND aggregate_id = $2",
      [org.id, first.body.id]
    )
    expect(events.rows).toHaveLength(1)

    const audits = await migrateQuery(
      "SELECT id FROM audit_logs WHERE entity_type = 'incident' AND action = 'create' AND entity_id = $1",
      [first.body.id]
    )
    expect(audits.rows).toHaveLength(1)

    const notifications = await migrateQuery(
      "SELECT id FROM notifications WHERE user_id = $1 AND title = 'Incident reported (high)' AND message LIKE 'Fall in hallway%'",
      [manager.id]
    )
    expect(notifications.rows).toHaveLength(1)
  })

  it('rejects witness notes longer than the supported report limit', async () => {
    const { worker } = await team()
    const response = await request(app).post('/incidents')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ title: 'Witness length validation', witnesses: 'x'.repeat(2001) })

    expect(response.status).toBe(400)
  })

  it('persists linked people and a homecare visit once across an idempotent retry', async () => {
    const { org, worker, resident } = await team()
    const packageResult = await migrateQuery(
      `INSERT INTO homecare_packages (organization_id, person_id, name, start_date)
       VALUES ($1, $2, 'Incident test package', CURRENT_DATE) RETURNING id`,
      [org.id, resident.id]
    )
    const visitResult = await migrateQuery(
      `INSERT INTO homecare_visits (organization_id, package_id, person_id, visit_type, label, scheduled_start, scheduled_end)
       VALUES ($1, $2, $3, 'routine', 'Incident test visit', NOW(), NOW() + INTERVAL '30 minutes') RETURNING id`,
      [org.id, packageResult.rows[0].id, resident.id]
    )
    const token = generateToken(worker)
    const submissionId = '9a5143b6-a2ca-4fd2-9c16-94f803b79c5a'
    const payload = {
      title: 'Incident during homecare visit',
      incident_date: '2026-10-06',
      person_ids: [resident.id],
      visit_id: visitResult.rows[0].id,
      client_submission_id: submissionId,
    }

    const first = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send(payload)
    const retry = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`).send(payload)

    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect(retry.body.id).toBe(first.body.id)

    // The create endpoint returns the inserted incident row; linked visit
    // display fields are assembled by the detail endpoint consumed by the UI.
    const detail = await request(app).get(`/incidents/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.linked_visit_id).toBe(visitResult.rows[0].id)
    expect(detail.body.linked_visit_label).toBe('Incident test visit')
    expect(detail.body.linked_visit_person_name).toBe('Ada Lovelace')
    expect(detail.body.linked_visit_status).toBe('scheduled')
    expect(detail.body.involved).toEqual(expect.arrayContaining([
      expect.objectContaining({ person_id: resident.id, first_name: 'Ada', last_name: 'Lovelace' }),
    ]))

    const linked = await migrateQuery(
      `SELECT i.visit_id, COUNT(r.person_id)::int AS linked_people
       FROM incidents i
       LEFT JOIN incident_involved_residents r ON r.incident_id = i.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [first.body.id]
    )
    expect(linked.rows[0].visit_id).toBe(visitResult.rows[0].id)
    expect(linked.rows[0].linked_people).toBe(1)
  })

  it('lets a support worker report an incident', async () => {
    const { worker, resident } = await team()
    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ title: 'Resident found on the bathroom floor', description: 'Alerted by call bell', severity: 'high', location: 'Flat 4' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Resident found on the bathroom floor')
    expect(res.body.reported_by).toBe(worker.id)
    expect(res.status).toBe(201)
  })

  it('records the reporter rather than trusting a supplied id', async () => {
    const { worker, manager } = await team()
    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ title: 'Near miss in the kitchen', is_near_miss: true })

    expect(res.status).toBe(201)
    expect(res.body.reported_by).toBe(worker.id)
    expect(res.body.reported_by).not.toBe(manager.id)
  })

  it('strips investigation and regulatory fields from a support worker report', async () => {
    const { worker } = await team()
    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({
        title: 'Slip in the corridor',
        witnesses: 'Casey Witness',
        // A support worker must not be able to set these themselves.
        status: 'closed',
        is_cqc_reportable: false,
        root_cause: 'Wet floor',
        outcomes: 'No action',
        lessons_learned: 'None',
        cqc_reference: 'ABC/123',
      })

    expect(res.status).toBe(201)
    // Triage is a manager's job, so these must not be accepted from the reporter.
    expect(res.body.status).not.toBe('closed')
    expect(res.body.root_cause ?? null).toBeNull()
    expect(res.body.outcomes ?? null).toBeNull()
    expect(res.body.cqc_reference ?? null).toBeNull()
    expect(res.body.witnesses).toBe('Casey Witness')
  })

  it('shows a support worker only the incidents they reported', async () => {
    const { manager, worker, other } = await team()
    const managerToken = generateToken(manager)

    const mine = await request(app).post('/incidents').set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Logged by a manager' })
    await request(app).post('/incidents').set('Authorization', `Bearer ${generateToken(other)}`)
      .send({ title: 'Raised by another worker' })
    await request(app).post('/incidents').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ title: 'Raised by me' })

    const asWorker = await request(app).get('/incidents').set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(asWorker.status).toBe(200)
    expect(asWorker.body).toHaveLength(1)
    expect(asWorker.body[0].title).toBe('Raised by me')

    const asManager = await request(app).get('/incidents').set('Authorization', `Bearer ${managerToken}`)
    expect(asManager.body.length).toBe(3)
    expect(mine.status).toBe(201)
  })

  it('refuses a support worker reading an incident they did not report', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/incidents').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Manager investigation' })

    const res = await request(app)
      .get(`/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)

    expect(res.status).toBe(403)
  })

  it('refuses a support worker reading another worker incident sub-resources', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/incidents').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Manager investigation' })
    const token = generateToken(worker)

    for (const suffix of ['actions', 'attachments', 'timeline']) {
      const res = await request(app).get(`/incidents/${created.body.id}/${suffix}`).set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(403)
    }
  })

  it('lets a support worker read back an incident they raised', async () => {
    const { worker } = await team()
    const token = generateToken(worker)
    const created = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Medication discrepancy found' })

    const res = await request(app).get(`/incidents/${created.body.id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Medication discrepancy found')
  })

  it('refuses a support worker triaging an incident', async () => {
    const { worker } = await team()
    const token = generateToken(worker)
    const created = await request(app).post('/incidents').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Awaiting triage' })

    const res = await request(app)
      .patch(`/incidents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' })

    expect(res.status).toBe(403)
  })

  it('lets any authenticated user read incident categories so they can file one', async () => {
    const { worker } = await team()
    const res = await request(app)
      .get('/incidents/categories')
      .set('Authorization', `Bearer ${generateToken(worker)}`)

    expect(res.status).toBe(200)
  })

  it('keeps the organisation incident statistics with managers', async () => {
    const { worker } = await team()
    const res = await request(app)
      .get('/incidents/stats')
      .set('Authorization', `Bearer ${generateToken(worker)}`)

    expect(res.status).toBe(403)
  })

  it('requires authentication to report', async () => {
    expect((await request(app).post('/incidents').send({ title: 'Anonymous' })).status).toBe(401)
  })
})
