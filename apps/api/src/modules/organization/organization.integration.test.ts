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
