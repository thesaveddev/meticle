import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Outcomes â€” scales and assessments', () => {
  it('should create a scale, record an assessment and read summaries', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const mgr = await createUser({ email: `ou-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const scale = await request(app)
      .post('/outcomes/scales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wellbeing Scale', shortcode: 'WB',
        min_score: 1, max_score: 10,
        questions: [{ text: 'How do you feel today?', order: 0 }],
        score_bands: [{ min: 1, max: 5, label: 'Low', color: '#DC2626' }, { min: 6, max: 10, label: 'High', color: '#16A34A' }],
      })
    expect(scale.status).toBe(201)
    expect(scale.body.name).toBe('Wellbeing Scale')

    const scales = await request(app)
      .get('/outcomes/scales')
      .set('Authorization', `Bearer ${token}`)
    expect(scales.status).toBe(200)
    expect(scales.body.some((s: any) => s.id === scale.body.id)).toBe(true)

    const result = await request(app)
      .post(`/outcomes/scales/${scale.body.id}/assess`)
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, scores: { Q1: 8 }, total_score: 8, band_label: 'High' })
    expect(result.status).toBe(201)

    const results = await request(app)
      .get(`/outcomes/scales/${scale.body.id}/results`)
      .set('Authorization', `Bearer ${token}`)
    expect(results.status).toBe(200)

    const personSummary = await request(app)
      .get(`/outcomes/person/${person.id}/summary`)
      .set('Authorization', `Bearer ${token}`)
    expect(personSummary.status).toBe(200)

    const orgSummary = await request(app)
      .get('/outcomes/org/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(orgSummary.status).toBe(200)

    const deleted = await request(app)
      .delete(`/outcomes/scales/${scale.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating a scale (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `ou2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/outcomes/scales')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ name: 'Nope', shortcode: 'N', min_score: 1, max_score: 2, questions: [{ text: 'q', order: 0 }], score_bands: [{ min: 1, max: 2, label: 'L', color: '#000' }] })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/outcomes/scales')
    expect(res.status).toBe(401)
  })
})
