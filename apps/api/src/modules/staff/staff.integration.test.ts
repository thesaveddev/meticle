import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Staff Integration — POST /staff', () => {
  it('should create a staff profile as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const targetUser = await createUser({ email: `target-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .post('/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: targetUser.id, first_name: 'John', last_name: 'Doe' })

    expect(res.status).toBe(201)
    expect(res.body.first_name).toBe('John')
    expect(res.body.last_name).toBe('Doe')
  })

  it('should reject creating staff without auth', async () => {
    const res = await request(app).post('/staff').send({ user_id: '00000000-0000-0000-0000-000000000000', first_name: 'John', last_name: 'Doe' })
    expect(res.status).toBe(401)
  })
})

describe('Staff Integration — GET /staff/:userId', () => {
  it('should return a staff profile', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `user-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const token = generateToken(user)

    const res = await request(app)
      .get(`/staff/${user.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(staff.id)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/staff/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(401)
  })
})

describe('Staff Integration — PATCH /staff/:userId/role', () => {
  it('should change user role as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const target = await createUser({ email: `target-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: target.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch(`/staff/${target.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MANAGER' })

    expect(res.status).toBe(200)
    expect(res.body.role).toBe('MANAGER')
  })

  it('should reject changing own role', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch(`/staff/${admin.id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MANAGER' })

    expect(res.status).toBe(400)
  })
})

describe('Staff Integration — PATCH /staff/:userId/status', () => {
  it('should deactivate a user as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const target = await createUser({ email: `target-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch(`/staff/${target.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'deactivated' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('deactivated')
  })
})

describe('Staff Integration — PATCH /staff/:userId/profile', () => {
  it('should update staff profile', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: admin.id })
    const target = await createUser({ email: `target-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch(`/staff/${target.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '07700000001', city: 'London' })

    expect(res.status).toBe(200)
  })
})

describe('Staff Integration — DELETE /staff/:userId', () => {
  it('should soft-delete a user as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `admin-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const target = await createUser({ email: `target-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .delete(`/staff/${target.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('deactivated')
  })
})

describe('Staff Integration — GET /staff/org-members', () => {
  it('should return org members list', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `user-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/staff/org-members')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.staff).toBeDefined()
    expect(Array.isArray(res.body.staff)).toBe(true)
  })
})

describe('Staff Integration — self-service profile', () => {
  // A carer maintains their own contact details from "My profile". These two
  // routes previously did not support that: the read did not exist at all, and
  // the write was gated to ORG_ADMIN and MANAGER only.
  it('should let a care worker read their own profile', async () => {
    const org = await createOrg()
    const carer = await createUser({ email: `carer-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: carer.id, first_name: 'Sam', last_name: 'Adeyemi', phone: '07700 900123' })
    const token = generateToken(carer)

    const res = await request(app)
      .get(`/staff/${carer.id}/profile`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.phone).toBe('07700 900123')
    expect(res.body.first_name).toBe('Sam')
    expect(res.body.email).toBe(carer.email)
  })

  it('should let a care worker update their own profile and read it back', async () => {
    const org = await createOrg()
    const carer = await createUser({ email: `carer-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: carer.id })
    const token = generateToken(carer)

    const saved = await request(app)
      .patch(`/staff/${carer.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Sam', last_name: 'Adeyemi', phone: '07700 900999', city: 'Hull' })

    expect(saved.status).toBe(200)

    const readBack = await request(app)
      .get(`/staff/${carer.id}/profile`)
      .set('Authorization', `Bearer ${token}`)

    expect(readBack.status).toBe(200)
    expect(readBack.body.phone).toBe('07700 900999')
    expect(readBack.body.city).toBe('Hull')
  })

  it('should refuse a care worker reading someone else in the same org', async () => {
    const org = await createOrg()
    const carer = await createUser({ email: `carer-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const colleague = await createUser({ email: `colleague-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: colleague.id })
    const token = generateToken(carer)

    const res = await request(app)
      .get(`/staff/${colleague.id}/profile`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('should refuse a care worker updating someone else in the same org', async () => {
    const org = await createOrg()
    const carer = await createUser({ email: `carer-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const colleague = await createUser({ email: `colleague-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: colleague.id })
    const token = generateToken(carer)

    const res = await request(app)
      .patch(`/staff/${colleague.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Tampered' })

    expect(res.status).toBe(403)
  })

  it('should not expose a staff member from another organisation', async () => {
    const orgA = await createOrg()
    const orgB = await createOrg()
    const adminA = await createUser({ email: `admin-a-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: orgA.id })
    const outsider = await createUser({ email: `outsider-${Date.now()}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: orgB.id })
    await createStaffProfile({ userId: outsider.id })
    const token = generateToken(adminA)

    const res = await request(app)
      .get(`/staff/${outsider.id}/profile`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })
})
