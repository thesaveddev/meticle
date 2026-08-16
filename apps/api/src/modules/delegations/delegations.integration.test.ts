import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createDelegation, createDelegationAuditLog, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Delegations — GET /delegations/delegation-audit/:delegationId', () => {
  it('should return the delegation audit trail to an ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `dadmin-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const primary = await createUser({ email: `dprim-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const delegate = await createUser({ email: `ddeleg-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const delegation = await createDelegation({ organizationId: org.id, primaryManagerId: primary.id, delegateManagerId: delegate.id })
    await createDelegationAuditLog({ delegationId: delegation.id, delegateUserId: delegate.id, primaryManagerId: primary.id })

    const res = await request(app)
      .get(`/delegations/delegation-audit/${delegation.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(1)
    expect(res.body[0].delegate_email).toBe(delegate.email)
  })

  it('should return the audit trail to the delegate manager', async () => {
    const org = await createOrg()
    const primary = await createUser({ email: `dprim2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const delegate = await createUser({ email: `ddeleg2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })

    const delegation = await createDelegation({ organizationId: org.id, primaryManagerId: primary.id, delegateManagerId: delegate.id })
    await createDelegationAuditLog({ delegationId: delegation.id, delegateUserId: delegate.id, primaryManagerId: primary.id })

    const res = await request(app)
      .get(`/delegations/delegation-audit/${delegation.id}`)
      .set('Authorization', `Bearer ${generateToken(delegate)}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
  })

  it('should not leak the audit trail to an unrelated user', async () => {
    const org = await createOrg()
    const primary = await createUser({ email: `dprim3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const delegate = await createUser({ email: `ddeleg3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const outsider = await createUser({ email: `dout-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const delegation = await createDelegation({ organizationId: org.id, primaryManagerId: primary.id, delegateManagerId: delegate.id })
    await createDelegationAuditLog({ delegationId: delegation.id, delegateUserId: delegate.id, primaryManagerId: primary.id })

    const res = await request(app)
      .get(`/delegations/delegation-audit/${delegation.id}`)
      .set('Authorization', `Bearer ${generateToken(outsider)}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(0)
  })
})
