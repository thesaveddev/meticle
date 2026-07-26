import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createTrainingModule, createTrainingRecord, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Training Integration — POST /training/modules', () => {
  it('should create a training module as ORG_ADMIN', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/training/modules')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fire Safety', category: 'mandatory', frequency_days: 365, is_mandatory: true })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Fire Safety')
    expect(res.body.is_mandatory).toBe(true)
  })

  it('should reject training module creation without auth', async () => {
    const res = await request(app).post('/training/modules').send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('Training Integration — GET /training/modules', () => {
  it('should list training modules', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `user-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createTrainingModule({ organizationId: org.id, name: 'First Aid' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/training/modules')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((m: any) => m.name === 'First Aid')).toBe(true)
  })
})

describe('Training Integration — PUT /training/modules/:id', () => {
  it('should update a training module', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const module = await createTrainingModule({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .put(`/training/modules/${module.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Module Name', frequency_days: 180 })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Module Name')
  })
})

describe('Training Integration — DELETE /training/modules/:id', () => {
  it('should delete a training module', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const module = await createTrainingModule({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .delete(`/training/modules/${module.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('deleted')
  })
})

describe('Training Integration — POST /training/records', () => {
  it('should create a training record', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `admin-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const module = await createTrainingModule({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/training/records')
      .set('Authorization', `Bearer ${token}`)
      .send({ module_id: module.id, staff_id: staff.id, status: 'completed', completed_at: '2026-06-01', expires_at: '2027-06-01' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('completed')
  })
})

describe('Training Integration — GET /training/records', () => {
  it('should list training records', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `user-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const module = await createTrainingModule({ organizationId: org.id })
    await createTrainingRecord({ moduleId: module.id, staffId: staff.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/training/records')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('Training Integration — GET /training/matrix', () => {
  it('should return the training matrix', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `user-${Date.now()}@train-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const staff = await createStaffProfile({ userId: user.id })
    const module = await createTrainingModule({ organizationId: org.id })
    await createTrainingRecord({ moduleId: module.id, staffId: staff.id })
    const token = generateToken(user)

    const res = await request(app)
      .get('/training/matrix')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.modules).toBeDefined()
    expect(res.body.staff).toBeDefined()
    expect(res.body.records).toBeDefined()
  })
})
