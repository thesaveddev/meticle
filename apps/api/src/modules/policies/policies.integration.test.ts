import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Policies — CRUD', () => {
  it('should create, list, update and delete a policy as MANAGER', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `pol-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Safeguarding Policy', category: 'Safeguarding', content: 'Policy content here.' })
    expect(created.status).toBe(201)
    expect(created.body.title).toBe('Safeguarding Policy')

    const list = await request(app)
      .get('/policies')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((p: any) => p.id === created.body.id)).toBe(true)

    const updated = await request(app)
      .patch(`/policies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('archived')

    const deleted = await request(app)
      .delete(`/policies/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should list policy categories', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `polc-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const res = await request(app)
      .get('/policies/categories')
      .set('Authorization', `Bearer ${generateToken(user)}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('should seed standard policies as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `pols-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)
    const res = await request(app)
      .post('/policies/seed')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.seeded).toBe(12)

    const list = await request(app)
      .get('/policies')
      .set('Authorization', `Bearer ${token}`)
    expect(list.body).toHaveLength(12)
  })

  it('should auto-load defaults on first list and not recreate them after deletion', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `polauto-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const first = await request(app)
      .get('/policies')
      .set('Authorization', `Bearer ${token}`)
    expect(first.status).toBe(200)
    expect(first.body).toHaveLength(12)

    const deleted = await request(app)
      .delete(`/policies/${first.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)

    const second = await request(app)
      .get('/policies')
      .set('Authorization', `Bearer ${token}`)
    expect(second.body).toHaveLength(11)
  })

  it('should reject CARE_WORKER creating a policy', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `polw-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const res = await request(app)
      .post('/policies')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ title: 'Nope', category: 'X', content: 'Y' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/policies')
    expect(res.status).toBe(401)
  })
})
