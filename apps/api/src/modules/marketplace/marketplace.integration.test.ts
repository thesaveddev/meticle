import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createLocation, createShift, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Marketplace', () => {
  it('should publish a shift, list it, and apply as a staff member', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const shift = await createShift({ locationId: location.id })
    const mgr = await createUser({ email: `mp-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `mpw-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: worker.id })
    const mgrToken = generateToken(mgr)
    const workerToken = generateToken(worker)

    const published = await request(app)
      .post(`/marketplace/publish/${shift.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
    expect(published.status).toBe(200)
    expect(published.body.status).toBe('open')
    expect(published.body.published_at).toBeTruthy()

    const available = await request(app)
      .get('/marketplace/shifts')
      .set('Authorization', `Bearer ${workerToken}`)
    expect(available.status).toBe(200)
    expect(available.body.some((s: any) => s.id === shift.id)).toBe(true)

    const applied = await request(app)
      .post(`/marketplace/apply/${shift.id}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ staffId: staff.id, notes: 'Available for this shift' })
    expect(applied.status).toBe(201)
    expect(applied.body.shift_id).toBe(shift.id)
  })

  it('should reject applying for a shift outside the caller org (404, RLS-hidden)', async () => {
    const org = await createOrg()
    const otherOrg = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const shift = await createShift({ locationId: location.id })
    const worker = await createUser({ email: `mpw2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: otherOrg.id })
    const staff = await createStaffProfile({ userId: worker.id })

    const res = await request(app)
      .post(`/marketplace/apply/${shift.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ staffId: staff.id })
    expect(res.status).toBe(404)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/marketplace/shifts')
    expect(res.status).toBe(401)
  })
})
