import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Appointments — CRUD', () => {
  it('should create, list, get, update and delete an appointment as MANAGER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const mgr = await createUser({ email: `apt-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person_id: person.id,
        title: 'Dentist appointment',
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 90000000).toISOString(),
        location_id: location.id,
        recurrence: 'monthly',
        notes: 'Bring the current medication list.',
      })
    expect(created.status).toBe(201)
    expect(created.body.title).toBe('Dentist appointment')
    expect(created.body.recurrence).toBe('monthly')
    expect(created.body.notes).toBe('Bring the current medication list.')

    const list = await request(app)
      .get('/appointments')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((a: any) => a.id === created.body.id)).toBe(true)

    const got = await request(app)
      .get(`/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)
    expect(got.body.id).toBe(created.body.id)

    const stats = await request(app)
      .get('/appointments/today-stats')
      .set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)

    const updated = await request(app)
      .patch(`/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('completed')

    const deleted = await request(app)
      .delete(`/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject CARE_WORKER creating an appointment', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `aptw-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const res = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ person_id: person.id, title: 'Nope', start_time: new Date().toISOString() })
    expect(res.status).toBe(403)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/appointments')
    expect(res.status).toBe(401)
  })
})
