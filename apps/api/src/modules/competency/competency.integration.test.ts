import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Competency — templates and assessments', () => {
  it('should create a template, record an assessment and read pending', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `co-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `co2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id })
    const token = generateToken(mgr)

    const template = await request(app)
      .post('/competency/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Manual Handling', category: 'moving-and-handling', requires_reassessment_days: 365 })
    expect(template.status).toBe(201)
    expect(template.body.name).toBe('Manual Handling')

    const templates = await request(app)
      .get('/competency/templates')
      .set('Authorization', `Bearer ${token}`)
    expect(templates.status).toBe(200)
    expect(templates.body.some((t: any) => t.id === template.body.id)).toBe(true)

    const assessment = await request(app)
      .post('/competency/assessments')
      .set('Authorization', `Bearer ${token}`)
      .send({ template_id: template.body.id, staff_id: staff.id, passed: true, assessor_id: mgr.id })
    expect(assessment.status).toBe(201)
    expect(assessment.body.passed).toBe(true)

    const pending = await request(app)
      .get('/competency/pending')
      .set('Authorization', `Bearer ${token}`)
    expect(pending.status).toBe(200)

    const deleted = await request(app)
      .delete(`/competency/assessments/${assessment.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating a template (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `co3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/competency/templates')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/competency/templates')
    expect(res.status).toBe(401)
  })
})
