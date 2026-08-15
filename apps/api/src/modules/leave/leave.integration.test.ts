import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createLeaveType, createLeaveRequest, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

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

describe('Leave Integration — Leave type flags', () => {
  it('should persist is_paid and requires_approval on create', async () => {
    const org = await createOrg({ base_leave_hours: 75, default_hours_per_leave_day: 7.5 })
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/types')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unpaid Training', color: '#7C3AED', days_allowed: 10, duration_type: 'days', is_paid: false, requires_approval: false })

    expect(res.status).toBe(201)
    expect(res.body.is_paid).toBe(false)
    expect(res.body.requires_approval).toBe(false)
  })

  it('should persist requires_approval on update without wiping is_paid', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)
    const leaveType = await createLeaveType({ organizationId: org.id, name: 'Annual Leave', days_allowed: 32 })

    const res = await request(app)
      .put(`/leave/types/${leaveType.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days_allowed: 32, requires_approval: false })

    expect(res.status).toBe(200)
    expect(res.body.requires_approval).toBe(false)
    expect(res.body.is_paid).toBe(true)
  })
})

describe('Leave Integration — Auto-approval', () => {
  it('should auto-approve a request when the type requires no approval', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id, requires_approval: false })
    const token = generateToken(user)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-11-01', end_date: '2026-11-03', reason: 'Auto' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('approved')

    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${token}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(bal.days_taken)).toBeGreaterThan(0)
  })
})

describe('Leave Integration — Top-level reviewer routing', () => {
  it('should route an admin request to a different ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const otherAdmin = await createUser({ email: `adm2-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    await createStaffProfile({ userId: otherAdmin.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-11-10', end_date: '2026-11-12', reason: 'Holiday' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.reviewed_by).toBe(otherAdmin.id)
  })

  it('should route a manager request to their active delegate (deputy)', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `mgr-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const delegate = await createUser({ email: `del-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: manager.id })
    await createStaffProfile({ userId: delegate.id })
    await migrateQuery(
      `INSERT INTO manager_delegations (organization_id, primary_manager_id, delegate_manager_id, is_active)
       VALUES ($1, $2, $3, TRUE)`,
      [org.id, manager.id, delegate.id]
    )
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(manager)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-11-13', end_date: '2026-11-14', reason: 'Holiday' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.reviewed_by).toBe(delegate.id)
  })

  it('should route a sole admin request to another manager instead of deadlocking', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const peer = await createUser({ email: `peer-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    await createStaffProfile({ userId: peer.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-11-17', end_date: '2026-11-18', reason: 'Holiday' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.reviewed_by).toBe(peer.id)
  })

  it('should auto-approve a top-level request when no approver exists', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `mgr-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: manager.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(manager)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-11-20', end_date: '2026-11-21', reason: 'Holiday' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('approved')

    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${token}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(bal.days_taken)).toBeGreaterThan(0)
  })
})

describe('Leave Integration — Hourly leave', () => {
  it('should approve an hourly request and track hours', async () => {
    const org = await createOrg()
    const loc = await createLocation({ organizationId: org.id })
    const adminUser = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id, locationId: loc.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: workerUser.id, locationId: loc.id })
    const leaveType = await createLeaveType({ organizationId: org.id, name: 'Half Day', duration_type: 'hours', hours_allowed: 30 })
    const token = generateToken(workerUser)
    const adminToken = generateToken(adminUser)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-10-01', end_date: '2026-10-01', duration_type: 'hours', hours_requested: 4 })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')

    await request(app)
      .patch(`/leave/requests/${res.body.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200)

    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${token}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === 'Half Day')
    expect(Number(bal.hours_taken)).toBe(4)
  })
})

describe('Leave Integration — PATCH /leave/requests/:id/cancel', () => {
  it('should cancel a pending request', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: staff.id, leaveTypeId: leaveType.id })
    const token = generateToken(user)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
  })

  it('should reject cancelling an approved request that has started', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `staff-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: staff.id, leaveTypeId: leaveType.id, status: 'approved', start_date: '2026-01-05', end_date: '2026-01-07' })
    const token = generateToken(user)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })

  it('should cancel a future approved request and reverse the balance', async () => {
    const org = await createOrg()
    const loc = await createLocation({ organizationId: org.id })
    const adminUser = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id, locationId: loc.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, locationId: loc.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: workerStaff.id, leaveTypeId: leaveType.id, start_date: '2026-12-01', end_date: '2026-12-05' })
    const adminToken = generateToken(adminUser)
    const workerToken = generateToken(workerUser)

    await request(app)
      .patch(`/leave/requests/${reqRec.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200)

    const before = await request(app).get('/leave/balances').set('Authorization', `Bearer ${workerToken}`)
    const beforeBal = before.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(beforeBal.days_taken)).toBe(5)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/cancel`)
      .set('Authorization', `Bearer ${workerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')

    const after = await request(app).get('/leave/balances').set('Authorization', `Bearer ${workerToken}`)
    const afterBal = after.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(afterBal.days_taken)).toBe(0)
  })
})

describe('Leave Integration — Rejection keeps balance untouched', () => {
  it('should reject a request without incrementing balance', async () => {
    const org = await createOrg()
    const loc = await createLocation({ organizationId: org.id })
    const adminUser = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id, locationId: loc.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, locationId: loc.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: workerStaff.id, leaveTypeId: leaveType.id })
    const adminToken = generateToken(adminUser)
    const workerToken = generateToken(workerUser)

    const res = await request(app)
      .patch(`/leave/requests/${reqRec.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', notes: 'Not approved' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')

    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${workerToken}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(bal.days_taken)).toBe(0)
  })
})

describe('Leave Integration — PUT /leave/entitlement/:staffId', () => {
  it('should update only the provided allocation fields', async () => {
    const org = await createOrg()
    const adminUser = await createUser({ email: `admin-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: workerUser.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(adminUser)

    const first = await request(app)
      .put(`/leave/entitlement/${staff.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, year: 2026, days_allocated: 20, hours_allocated: 10 })

    expect(first.status).toBe(200)
    expect(Number(first.body.days_allocated)).toBe(20)
    expect(Number(first.body.hours_allocated)).toBe(10)

    const second = await request(app)
      .put(`/leave/entitlement/${staff.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, year: 2026, days_allocated: 25 })

    expect(second.status).toBe(200)
    expect(Number(second.body.days_allocated)).toBe(25)
    expect(Number(second.body.hours_allocated)).toBe(10)
  })
})

describe('Leave Integration — GET /leave/calendar-day', () => {
  it('should list every staff member on leave for an admin on a given day', async () => {
    const org = await createOrg()
    const adminUser = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, first_name: 'Alice', last_name: 'Worker' })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: workerStaff.id, leaveTypeId: leaveType.id, start_date: '2026-09-10', end_date: '2026-09-12', status: 'approved' })
    const token = generateToken(adminUser)

    const res = await request(app)
      .get('/leave/calendar-day?date=2026-09-11')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].id).toBe(reqRec.id)
    expect(res.body[0].first_name).toBe('Alice')
    expect(res.body[0].last_name).toBe('Worker')
    expect(res.body[0].leave_type_name).toBe('Annual Leave')
  })

  it('should only show a staff member their own requests', async () => {
    const org = await createOrg()
    const adminUser = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const reqRec = await createLeaveRequest({ staffId: workerStaff.id, leaveTypeId: leaveType.id, start_date: '2026-09-10', end_date: '2026-09-12' })
    const token = generateToken(workerUser)

    const res = await request(app)
      .get('/leave/calendar-day?date=2026-09-11')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].id).toBe(reqRec.id)
  })

  it('should reject an invalid date', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/leave/calendar-day?date=2026/09/11')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

describe('Leave Integration — Manager books leave for a staff member', () => {
  it('should create a leave request for another staff member as a MANAGER', async () => {
    const org = await createOrg()
    const mgrUser = await createUser({ email: `mgr-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgrUser.id })
    const loc = await createLocation({ organizationId: org.id, manager_id: mgrUser.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, locationId: loc.id, first_name: 'Bob', last_name: 'Booked' })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(mgrUser)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-09-20', end_date: '2026-09-20', duration_type: 'hours', hours_requested: 7.5, staff_id: workerStaff.id, reason: 'Booked by manager' })

    expect(res.status).toBe(201)
    expect(res.body.staff_id).toBe(workerStaff.id)
    // Booking on behalf of another staff member is approved immediately
    expect(res.body.status).toBe('approved')
    expect(res.body.reviewed_by).toBe(mgrUser.id)

    // The approved booking applies to the staff member's balance
    const workerToken = generateToken(workerUser)
    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${workerToken}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(bal.hours_taken)).toBe(7.5)
  })

  it('should accept a user id as staff_id (the shape sent by the settings staff list)', async () => {
    const org = await createOrg()
    const mgrUser = await createUser({ email: `mgr-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgrUser.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const workerStaff = await createStaffProfile({ userId: workerUser.id, first_name: 'Carla', last_name: 'User' })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(mgrUser)

    // /settings/staff returns u.id, so the frontend sends the user id here
    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-09-23', end_date: '2026-09-23', duration_type: 'hours', hours_requested: 7.5, staff_id: workerUser.id })

    expect(res.status).toBe(201)
    expect(res.body.staff_id).toBe(workerStaff.id)
    expect(res.body.status).toBe('approved')
  })

  it('should reject a staff member booking leave for someone else', async () => {
    const org = await createOrg()
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: workerUser.id })
    const otherUser = await createUser({ email: `other-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const otherStaff = await createStaffProfile({ userId: otherUser.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(workerUser)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-09-21', end_date: '2026-09-21', duration_type: 'hours', hours_requested: 7.5, staff_id: otherStaff.id })

    expect(res.status).toBe(403)
  })

  it('should reject a staff_id from another organisation', async () => {
    const orgA = await createOrg()
    const orgB = await createOrg()
    const adminA = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: orgA.id })
    await createStaffProfile({ userId: adminA.id })
    const workerB = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: orgB.id })
    const workerStaffB = await createStaffProfile({ userId: workerB.id })
    const leaveType = await createLeaveType({ organizationId: orgA.id })
    const token = generateToken(adminA)

    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-09-22', end_date: '2026-09-22', duration_type: 'hours', hours_requested: 7.5, staff_id: workerStaffB.id })

    expect(res.status).toBe(404)
  })
})

describe('Leave Integration — Hourly leave with a date range', () => {
  it('should approve an hours request spanning multiple days and track the total hours', async () => {
    const org = await createOrg()
    const loc = await createLocation({ organizationId: org.id })
    const adminUser = await createUser({ email: `adm-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: adminUser.id, locationId: loc.id })
    const workerUser = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: workerUser.id, locationId: loc.id })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const workerToken = generateToken(workerUser)
    const adminToken = generateToken(adminUser)

    // 2 days at 7.5h/day = 15h total
    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-10-06', end_date: '2026-10-07', duration_type: 'hours', hours_requested: 15 })

    expect(res.status).toBe(201)

    await request(app)
      .patch(`/leave/requests/${res.body.id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200)

    const balances = await request(app).get('/leave/balances').set('Authorization', `Bearer ${workerToken}`)
    const bal = balances.body.find((b: any) => b.leave_type_name === leaveType.name)
    expect(Number(bal.hours_taken)).toBe(15)
  })

  it('should reject an hours request that exceeds the daily contracted hours', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `worker-${Date.now()}@leave-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id, contracted_hours_weekly: 37.5 })
    const leaveType = await createLeaveType({ organizationId: org.id })
    const token = generateToken(user)

    // 20h over a single day > 7.5h daily cap
    const res = await request(app)
      .post('/leave/my-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ leave_type_id: leaveType.id, start_date: '2026-10-08', end_date: '2026-10-08', duration_type: 'hours', hours_requested: 20 })

    expect(res.status).toBe(400)
  })
})
