import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Surveys — satisfaction and engagement', () => {
  it('should submit and read satisfaction, and manage engagement templates', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const admin = await createUser({ email: `su-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const submitted = await request(app)
      .post('/surveys/satisfaction')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, respondent_name: 'Family', relationship: 'daughter', rating: 4, comments: 'Very happy' })
    expect(submitted.status).toBe(201)
    expect(submitted.body.rating).toBe(4)

    const list = await request(app)
      .get('/surveys/satisfaction')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((s: any) => s.id === submitted.body.id)).toBe(true)

    const aggregate = await request(app)
      .get('/surveys/satisfaction/aggregate')
      .set('Authorization', `Bearer ${token}`)
    expect(aggregate.status).toBe(200)

    const template = await request(app)
      .post('/surveys/engagement/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Quarterly Staff Pulse', questions: [{ text: 'How engaged do you feel?', type: 'rating' }] })
    expect(template.status).toBe(201)
    expect(template.body.name).toBe('Quarterly Staff Pulse')

    const templates = await request(app)
      .get('/surveys/engagement/templates')
      .set('Authorization', `Bearer ${token}`)
    expect(templates.status).toBe(200)
    expect(templates.body.some((t: any) => t.id === template.body.id)).toBe(true)
  })

  it('should reject a CARE_WORKER reading satisfaction surveys (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `su2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .get('/surveys/satisfaction')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/surveys/satisfaction')
    expect(res.status).toBe(401)
  })
})
