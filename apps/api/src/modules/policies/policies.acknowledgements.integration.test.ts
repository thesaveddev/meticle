import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function setup() {
  const org = await createOrg()
  const stamp = Date.now() + Math.floor(Math.random() * 100000)
  const admin = await createUser({ email: `pack-admin-${stamp}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  const carer = await createUser({ email: `pack-carer-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const other = await createUser({ email: `pack-other-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const policy = await request(app)
    .post('/policies')
    .set('Authorization', `Bearer ${generateToken(admin)}`)
    .send({ title: 'Safeguarding Adults Policy', category: 'Safeguarding', content: 'Read this.' })
  expect(policy.status).toBe(201)
  return { admin, carer, other, policyId: policy.body.id as string }
}

describe('Policies — acknowledgements (blueprint §9.7)', () => {
  it('lets a care worker acknowledge a policy in their own name', async () => {
    const { carer, policyId } = await setup()
    const res = await request(app)
      .post(`/policies/${policyId}/acknowledge`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
    expect(res.status).toBe(201)
    expect(res.body.policy_id).toBe(policyId)
    expect(res.body.user_id).toBe(carer.id)
  })

  it('refreshes rather than duplicates a re-acknowledgement', async () => {
    const { carer, policyId } = await setup()
    const token = generateToken(carer)
    const first = await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${token}`)
    const second = await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${token}`)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.id).toBe(first.body.id)
  })

  it('refuses an acknowledgement for a policy outside the caller’s organisation', async () => {
    const { policyId } = await setup()
    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `pack-out-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: otherOrg.id })
    const res = await request(app)
      .post(`/policies/${policyId}/acknowledge`)
      .set('Authorization', `Bearer ${generateToken(outsider)}`)
    expect(res.status).toBe(404)
  })

  it('shows a manager the whole reading list but a worker only their own row', async () => {
    const { admin, carer, other, policyId } = await setup()
    await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${generateToken(carer)}`)
    await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${generateToken(other)}`)

    const asManager = await request(app)
      .get(`/policies/${policyId}/acknowledgements`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(asManager.status).toBe(200)
    expect(asManager.body).toHaveLength(2)

    const asCarer = await request(app)
      .get(`/policies/${policyId}/acknowledgements`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
    expect(asCarer.status).toBe(200)
    expect(asCarer.body).toHaveLength(1)
    expect(asCarer.body[0].user_id).toBe(carer.id)
  })
})
