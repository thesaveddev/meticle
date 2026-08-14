import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createLeaveType, createLeaveRequest, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Leave Integration — POST /leave/types', () => {
  it('should create a leave type as ORG_ADMIN', async () => {
    // 10 days x 7.5h/day = 75h — set the org total to match so the type balances
    const org = await createOrg({ base_leave_hours: 75, default_hours_per_leave_day: 7.5 })
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sick Leave', color: '#FF0000', days_allowed: 10, duration_type: 'days' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Sick Leave')
    expect(res.body.days_allowed).toBe(10)
  })

  it('should reject a leave type whose allowance does not match the org total', async () => {
    // Default org total is 240h; a single 10-day type only accounts for 75h
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sick Leave', color: '#FF0000', days_allowed: 10, duration_type: 'days' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/total/i)
  })

  it('should reject an update that breaks the org total', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)
    const leaveType = await createLeaveType({ organizationId: org.id, name: 'Annual Leave', days_allowed: 32 })

    // 32 days x 7.5h = 240h == org total, so keeping the balance is valid
    const ok = await request(app)
      .put(`/leave/types/${leaveType.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days_allowed: 32 })
    expect(ok.status).toBe(200)

    // Reducing to 10 days leaves the org short of its 240h allowance
    const res = await request(app)
      .put(`/leave/types/${leaveType.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days_allowed: 10 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/total/i)
  })

  it('should reject leave type creation without ORG_ADMIN', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sick Leave' })

    expect(res.status).toBe(403)
  })
})

describe('Leave Integration — GET /leave/types', () => {
  it('should return leave types for the org', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const token = generateToken(user)

    await createLeaveType({ organizationId: org.id, name: 'Custom Leave' })

    const res = await request(app)
      .get('/leave/types')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((t: any) => t.name === 'Custom Leave')).toBe(true)
  })
})

describe('Leave Integration — POST /leave/my-requests', () => {
  it('should create a leave request', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-09-01', end_date: '2026-09-03', reason: 'Vacation' })

    expect(res.status).toBe(201)
    expect(res.body.staff_id).toBe(staff.id)
    expect(res.body.status).toBe('pending')
  })

  it('should reject overlapping leave requests', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(user)

    await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-10-01', end_date: '2026-10-05', reason: 'First' })

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-10-03', end_date: '2026-10-07', reason: 'Overlapping' })

    expect(res.status).toBe(409)
  })
})

describe('Leave Integration — GET /leave/my-requests', () => {
  it('should return the user leave requests', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    await createLeaveRequest({ staffId: staff.id, leaveTypeId: leaveType.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })
})

describe('Leave Integration — GET /leave/balances', () => {
  it('should return leave balances for the user', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/leave/balances')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((b: any) => b.leave_type_name === leaveType.name)).toBe(true)
  })
})

describe('Leave Integration — PATCH /leave/requests/:id/review', () => {
  it('should approve a leave request as MANAGER', async () => {
    const org = await createOrg()
    const loc = await createLocation({ organizationId: org.id })
    const adminUser = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id, locationId: loc.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, locationId: loc.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: workerStaff.id, leaveTypeId: leaveType.id })
    const token = generateToken(adminUser)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved', notes: 'Approved' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
  })

  it('should reject self-approval', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: staff.id, leaveTypeId: leaveType.id })
    const token = generateToken(user)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'approved' })

    expect(res.status).toBe(403)
  })
})

describe('Leave Integration — GET /leave/requests', () => {
  it('should list all requests for MANAGER/ORG_ADMIN', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/leave/requests')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
