import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Room checks — CRUD', () => {
  it('should create, list, update and delete a room check', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const mgr = await createUser({ email: `rc-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const admin = await createUser({ email: `rc2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/room-checks')
      .set('Authorization', `Bearer ${token}`)
      .send({ location_id: location.id, room_number: '12', status: 'pass', cleanliness_rating: 4, safety_rating: 5 })
    expect(created.status).toBe(201)
    expect(created.body.room_number).toBe('12')

    const list = await request(app)
      .get('/room-checks')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((r: any) => r.id === created.body.id)).toBe(true)

    const updated = await request(app)
      .patch(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'needs_attention', notes: 'Fix radiator' })
    expect(updated.status).toBe(200)

    const deleted = await request(app)
      .delete(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating a room check (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `rc3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/room-checks')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ room_number: '9', status: 'pass' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/room-checks')
    expect(res.status).toBe(401)
  })
})
