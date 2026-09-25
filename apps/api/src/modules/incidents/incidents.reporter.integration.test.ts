import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'

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
