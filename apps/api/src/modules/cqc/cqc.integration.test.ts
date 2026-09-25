import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('CQC — readiness, frameworks, action items', () => {
  it('should return readiness, frameworks and gap analysis', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `cqc-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const readiness = await request(app)
      .get('/cqc/readiness')
      .set('Authorization', `Bearer ${token}`)
    expect(readiness.status).toBe(200)
    expect(readiness.body).toBeDefined()

    const frameworks = await request(app)
      .get('/cqc/frameworks')
      .set('Authorization', `Bearer ${token}`)
    expect(frameworks.status).toBe(200)

    const gap = await request(app)
      .get('/cqc/gap-analysis')
      .set('Authorization', `Bearer ${token}`)
    expect(gap.status).toBe(200)
  })

  it('should return the domiciliary compliance dashboard without a schema error', async () => {
    const org = await createOrg({ service_types: ['domiciliary'] })
    const admin = await createUser({ email: `homecare-cqc-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const response = await request(app)
      .get('/cqc/homecare-compliance')
      .set('Authorization', `Bearer ${generateToken(admin)}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('visitCompletion')
    expect(response.body).toHaveProperty('riskAssessments')
  })

  it('should count recorded supervisions in the domiciliary compliance score', async () => {
    // The supervision figure used to be derived from audit_logs rows that
    // nothing ever wrote, so it could never move off zero. It now reads the
    // supervision log, and this proves the two agree.
    const org = await createOrg({ service_types: ['domiciliary'] })
    const manager = await createUser({ email: `sup-mgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `sup-carer-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: manager.id })
    await createStaffProfile({ userId: carer.id })
    const token = generateToken(manager)

    const before = await request(app)
      .get('/cqc/homecare-compliance')
      .set('Authorization', `Bearer ${token}`)
    expect(before.body.supervision.done).toBe(0)

    await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${token}`)
      .send({ staff_user_id: carer.id, supervisor_user_id: manager.id, supervised_at: '2026-09-01' })
      .expect(201)

    const after = await request(app)
      .get('/cqc/homecare-compliance')
      .set('Authorization', `Bearer ${token}`)

    expect(after.status).toBe(200)
    expect(after.body.supervision.done).toBe(1)
    expect(after.body.supervision.total).toBe(2)
    expect(after.body.supervision.rate).toBe(50)
  })

  it('should create, list, update and delete an action item as MANAGER', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `cqc2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/cqc/action-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ cqc_statement: 'S1', description: 'Quarterly medication audit', priority: 'high', due_date: '2026-09-01' })
    expect(created.status).toBe(201)
    expect(created.body.cqc_statement).toBe('S1')
    expect(created.body.status).toBe('open')

    const list = await request(app)
      .get('/cqc/action-items')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((i: any) => i.id === created.body.id)).toBe(true)

    const updated = await request(app)
      .patch(`/cqc/action-items/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('completed')

    const deleted = await request(app)
      .delete(`/cqc/action-items/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating an action item (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `cqc3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/cqc/action-items')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ cqc_statement: 'S1', description: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/cqc/readiness')
    expect(res.status).toBe(401)
  })
})
