import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, createStaffProfile, createShift, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Mobile — check-in, roster, voice notes', () => {
  it('should check in, list check-ins and post a note as CARE_WORKER', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const worker = await createUser({ email: `mob-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: worker.id })
    const token = generateToken(worker)

    const checkIn = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy: 12 })
    expect(checkIn.status).toBe(201)
    expect(checkIn.body.user_id).toBe(worker.id)

    const missingLocation = await request(app)
      .post('/mobile/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(missingLocation.status).toBe(400)

    const checkIns = await request(app)
      .get('/mobile/check-ins')
      .set('Authorization', `Bearer ${token}`)
    expect(checkIns.status).toBe(200)
    expect(checkIns.body.some((c: any) => c.id === checkIn.body.id)).toBe(true)

    const note = await request(app)
      .post('/mobile/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, content: 'Has been cheerful today' })
    expect(note.status).toBe(201)
    expect(note.body.content).toBe('Has been cheerful today')

    const noteBadPerson = await request(app)
      .post('/mobile/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: crypto.randomUUID(), content: 'Nope' })
    expect(noteBadPerson.status).toBe(404)
  })

  it('should return the 7-day roster for a staff member', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const worker = await createUser({ email: `mob2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id })
    const shift = await createShift({ locationId: location.id })
    const token = generateToken(worker)

    const res = await request(app)
      .get('/mobile/my-roster')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/mobile/my-roster')
    expect(res.status).toBe(401)
  })
})
