import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createShift, generateToken } from '../../test/factories'
import { query } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)



async function createOrgWithAdmin() {
  const org = await createOrg()
  const user = await createUser({ email: `admin-${Date.now()}@sched-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  await createStaffProfile({ userId: user.id, locationId: null })
  return { org, user }
}

describe('Scheduling Integration — POST /shifts', () => {
  it('should create a shift as ORG_ADMIN', async () => {
    const { org, user } = await createOrgWithAdmin()
    const loc = await createLocation({ organizationId: org.id })
    const token = generateToken(user)
    const startTime = new Date(Date.now() + 86400000).toISOString()
    const endTime = new Date(Date.now() + 90000000).toISOString()

    const res = await request(app)
      .post('/shifts')
      .set('Authorization', `Bearer ${token}`)
      .send({ location_id: loc.id, title: 'Test Shift', start_time: startTime, end_time: endTime, shift_type: 'day' })

    expect(res.status).toBe(201)
    expect(res.body.location_id).toBe(loc.id)
    expect(res.body.shift_type).toBe('day')
  }, 30_000)

  it('should reject shift creation without auth', async () => {
    const res = await request(app).post('/shifts').send({ title: 'No Auth Shift' })
    expect(res.status).toBe(401)
  })
})

describe('Scheduling Integration — GET /shifts', () => {
  it('should list shifts for the org', async () => {
    const { org, user } = await createOrgWithAdmin()
    const loc = await createLocation({ organizationId: org.id })
    await createShift({ organizationId: org.id, locationId: loc.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/shifts')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  }, 30_000)

  it('should reject shift listing without auth', async () => {
    const res = await request(app).get('/shifts')
    expect(res.status).toBe(401)
  })
})

describe('Scheduling Integration — GET /shifts/staff', () => {
  it('should return staff list for the org', async () => {
    const { org, user } = await createOrgWithAdmin()
    const loc = await createLocation({ organizationId: org.id })
    const staffUser = await createUser({ email: `staff-${Date.now()}@sched.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: staffUser.id, locationId: loc.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/shifts/staff')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  }, 30_000)
})

describe('Scheduling Integration — GET /shifts/open', () => {
  it('should return open shifts', async () => {
    const { org, user } = await createOrgWithAdmin()
    const loc = await createLocation({ organizationId: org.id })
    await createShift({ organizationId: org.id, locationId: loc.id, status: 'open' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/shifts/open')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  }, 30_000)
})

describe('Scheduling Integration — POST /shifts/:id/assign', () => {
  it('should assign staff to a shift', async () => {
    const { org, user } = await createOrgWithAdmin()
    const loc = await createLocation({ organizationId: org.id })
    const shift = await createShift({ organizationId: org.id, locationId: loc.id, status: 'open' })
    const staffUser = await createUser({ email: `assign-${Date.now()}@sched.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: staffUser.id, locationId: loc.id })
    const token = generateToken(user)

    const res = await request(app)
      .post(`/shifts/${shift.id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ staffId: staff.id })

    expect(res.status).toBe(201)
    expect(res.body.staff_id).toBe(staff.id)
  }, 30_000)

  it('should reject assigning unauthenticated', async () => {
    const res = await request(app).post('/shifts/some-id/assign').send({ staffId: 'some-id' })
    expect(res.status).toBe(401)
  })
})
