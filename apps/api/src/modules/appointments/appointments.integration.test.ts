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

  it('should list a date range and locations', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const mgr = await createUser({ email: `apt-r-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)
    const day1 = new Date(Date.now() + 86400000)
    const day3 = new Date(Date.now() + 3 * 86400000)
    for (const d of [day1, day3]) {
      const res = await request(app).post('/appointments').set('Authorization', `Bearer ${token}`).send({
        title: 'Ranged visit', start_time: d.toISOString(), end_time: new Date(d.getTime() + 3600000).toISOString(), location_id: location.id,
      })
      expect(res.status).toBe(201)
    }
    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    const range = await request(app)
      .get('/appointments')
      .query({ from: ymd(day1), to: ymd(day3) })
      .set('Authorization', `Bearer ${token}`)
    expect(range.status).toBe(200)
    expect(range.body.length).toBe(2)
    const narrow = await request(app)
      .get('/appointments')
      .query({ from: ymd(day1), to: ymd(day1) })
      .set('Authorization', `Bearer ${token}`)
    expect(narrow.status).toBe(200)
    expect(narrow.body.length).toBe(1)
    const locations = await request(app)
      .get('/appointments/locations')
      .set('Authorization', `Bearer ${token}`)
    expect(locations.status).toBe(200)
    expect(locations.body.some((l: any) => l.id === location.id)).toBe(true)
  })

  it('should round-trip venue and cancellation record fields', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `apt-w-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Optician', start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 90000000).toISOString(), where_text: 'Specsavers, Five Ways',
      })
    expect(created.status).toBe(201)
    expect(created.body.where_text).toBe('Specsavers, Five Ways')

    const cancelled = await request(app)
      .patch(`/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled', cancellation_reason: 'Clinic cancelled', cancellation_note: 'Offered a new date next week.' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.cancellation_reason).toBe('Clinic cancelled')
    expect(cancelled.body.cancellation_note).toBe('Offered a new date next week.')

    const got = await request(app)
      .get(`/appointments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(got.body.where_text).toBe('Specsavers, Five Ways')
    expect(got.body.cancellation_reason).toBe('Clinic cancelled')
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
