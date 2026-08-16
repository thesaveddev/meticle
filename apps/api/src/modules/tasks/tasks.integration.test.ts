import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Tasks — kanban CRUD', () => {
  it('should create, list, update and delete a task as MANAGER', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `task-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Order medication stock', priority: 'high', status: 'pending' })
    expect(created.status).toBe(201)
    expect(created.body.title).toBe('Order medication stock')

    const list = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((t: any) => t.id === created.body.id)).toBe(true)

    const updated = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('in_progress')

    const deleted = await request(app)
      .delete(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should allow CARE_WORKER to view tasks but not create them', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `taskw-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const list = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)

    const create = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nope' })
    expect(create.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/tasks')
    expect(res.status).toBe(401)
  })
})
