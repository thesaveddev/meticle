import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Organization — invitations', () => {
  it('should invite, list, resend and cancel an invitation', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `og-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const invitedEmail = `newstaff-${Date.now()}@test.com`
    const invited = await request(app)
      .post('/organizations/invitation/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: invitedEmail, role: 'CARE_WORKER' })
    expect(invited.status).toBe(201)

    const list = await request(app)
      .get('/organizations/invitation/invitations')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    const invite = list.body.find((i: any) => i.email === invitedEmail) ?? list.body[0]
    expect(invite).toBeDefined()

    const resent = await request(app)
      .post(`/organizations/invitation/resend/${invite.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(resent.status).toBe(200)

    const cancelled = await request(app)
      .delete(`/organizations/invitation/${invite.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(cancelled.status).toBe(200)
  })

  it('should reject a MANAGER sending an invitation (403)', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `og2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const res = await request(app)
      .post('/organizations/invitation/invite')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ email: `x-${Date.now()}@test.com`, role: 'CARE_WORKER' })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/organizations/invitation/invitations')
    expect(res.status).toBe(401)
  })
})

describe('Organization — service types', () => {
  it('should update org service_types via PATCH /organizations/:id', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `st-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch(`/organizations/${org.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_types: ['domiciliary', 'supported_living'], primary_service_type: 'domiciliary' })

    expect(res.status).toBe(200)
    expect(res.body.service_types).toEqual(['domiciliary', 'supported_living'])
    expect(res.body.primary_service_type).toBe('domiciliary')
  })

  it('should return service_types from GET /settings/org', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `st2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    // First set the types
    await request(app)
      .patch(`/organizations/${org.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_types: ['residential', 'domiciliary'], primary_service_type: 'residential' })

    // Then read them back via settings
    const res = await request(app)
      .get('/settings/org')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.service_types).toEqual(['residential', 'domiciliary'])
    expect(res.body.primary_service_type).toBe('residential')
  })

  it('should reject non-admin users from updating org', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `st3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(worker)

    const res = await request(app)
      .patch(`/organizations/${org.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ service_types: ['domiciliary'] })

    expect(res.status).toBe(403)
  })

  it('should accept service_types via PATCH /settings/org', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `st4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const res = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ service_types: ['live_in'], primary_service_type: 'live_in' })

    expect(res.status).toBe(200)
    expect(res.body.service_types).toEqual(['live_in'])
    expect(res.body.primary_service_type).toBe('live_in')
  })
})
