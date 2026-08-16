import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Goals — CRUD, milestones, progress', () => {
  it('should create, list, get, update and delete a goal as MANAGER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const mgr = await createUser({ email: `goal-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, title: 'Improve mobility', target_date: '2026-12-01', cqc_domain: 'effective' })
    expect(created.status).toBe(201)
    expect(created.body.title).toBe('Improve mobility')

    const list = await request(app)
      .get('/goals')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((g: any) => g.id === created.body.id)).toBe(true)

    const got = await request(app)
      .get(`/goals/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(Array.isArray(got.body.milestones)).toBe(true)

    const updated = await request(app)
      .patch(`/goals/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ progress: 50 })
    expect(updated.status).toBe(200)
    expect(updated.body.progress).toBe(50)

    const stats = await request(app)
      .get(`/goals/stats/${person.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)

    const deleted = await request(app)
      .delete(`/goals/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should create a milestone and record progress on a goal', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const mgr = await createUser({ email: `goal2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, title: 'Walk 10 steps' })
    expect(created.status).toBe(201)

    const milestone = await request(app)
      .post(`/goals/${created.body.id}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'First stand', sort_order: 1 })
    expect(milestone.status).toBe(201)

    const progress = await request(app)
      .post(`/goals/${created.body.id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ progress: 25, notes: 'Getting stronger' })
    expect(progress.status).toBe(200)
    expect(progress.body.progress).toBe(25)

    const history = await request(app)
      .get(`/goals/${created.body.id}/progress-history`)
      .set('Authorization', `Bearer ${token}`)
    expect(history.status).toBe(200)
    expect(history.body.some((h: any) => h.progress === 25)).toBe(true)
  })

  it('should reject a CARE_WORKER creating a goal (403)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `goal3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/goals')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ person_id: person.id, title: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/goals')
    expect(res.status).toBe(401)
  })
})
