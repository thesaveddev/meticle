import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createIncidentCategory, createIncident, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Incidents Integration — POST /incidents', () => {
  it('should create an incident as MANAGER', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const cat = await createIncidentCategory({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Slip and Fall', description: 'Resident slipped in hallway', severity: 'medium', category_id: cat.id, location: 'Wing B' })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Slip and Fall')
    expect(res.body.severity).toBe('medium')
  })

  it('should reject incident creation without auth', async () => {
    const res = await request(app).post('/incidents').send({ title: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('Incidents Integration — GET /incidents', () => {
  it('should list incidents', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncident({ organizationId: org.id, title: 'Test Incident Report' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.some((i: any) => i.title === 'Test Incident Report')).toBe(true)
  })
})

describe('Incidents Integration — GET /incidents/stats', () => {
  it('should return incident stats', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncident({ organizationId: org.id, severity: 'high' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents/stats')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBeDefined()
    expect(res.body.reported).toBeDefined()
  })
})

describe('Incidents Integration — GET /incidents/:id', () => {
  it('should return a single incident with involved residents and actions', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .get(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(incident.id)
    expect(res.body.involved).toBeDefined()
    expect(res.body.actions).toBeDefined()
  })
})

describe('Incidents Integration — PATCH /incidents/:id', () => {
  it('should update an incident', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .patch(`/incidents/${incident.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'investigating', severity: 'high' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('investigating')
  })
})

describe('Incidents Integration — POST /incidents/:id/actions', () => {
  it('should create an action item for an incident', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post(`/incidents/${incident.id}/actions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'Review CCTV footage', assigned_to: user.id, status: 'pending' })

    expect(res.status).toBe(201)
    expect(res.body.action).toBe('Review CCTV footage')
  })
})

describe('Incidents Integration — POST /incidents/:id/involved', () => {
  it('should add involved resident to an incident', async () => {
    const org = await createOrg()
    // Create a service user reference
    const suId = '00000000-0000-0000-0000-000000000001'
    try {
      await migrateQuery(
        'INSERT INTO service_users (id, organization_id, first_name, last_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [suId, org.id, 'Test', 'Resident']
      )
    } catch { /* table may not exist */ }
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    const incident = await createIncident({ organizationId: org.id })
    const token = generateToken(user)

    const res = await request(app)
      .post(`/incidents/${incident.id}/involved`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_user_id: suId, involvement_type: 'affected' })

    expect(res.status).toBe(201)
    expect(res.body.service_user_id).toBe(suId)
  })
})

describe('Incidents Integration — GET /incidents/categories', () => {
  it('should return incident categories', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `mgr-${Date.now()}@inc-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: user.id })
    await createIncidentCategory({ organizationId: org.id, name: 'Fall' })
    const token = generateToken(user)

    const res = await request(app)
      .get('/incidents/categories')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})
