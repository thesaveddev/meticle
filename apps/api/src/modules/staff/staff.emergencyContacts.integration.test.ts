import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function setup() {
  const org = await createOrg()
  const stamp = Date.now() + Math.floor(Math.random() * 100000)
  const admin = await createUser({ email: `ec-admin-${stamp}@staff-test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  await createStaffProfile({ userId: admin.id })
  const carer = await createUser({ email: `ec-carer-${stamp}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const carerStaff = await createStaffProfile({ userId: carer.id })
  const other = await createUser({ email: `ec-other-${stamp}@staff-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const otherStaff = await createStaffProfile({ userId: other.id })
  return { admin, carer, carerStaff, otherStaff }
}

const contact = { name: 'Jane Doe', relationship: 'Sister', phone: '07123456789' }

describe('Emergency contacts — a support worker maintains their own (blueprint §9.6)', () => {
  it('lets a care worker add their own emergency contact', async () => {
    const { carer, carerStaff } = await setup()
    const res = await request(app)
      .post(`/staff/${carerStaff.id}/emergency-contacts`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
      .send(contact)
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Jane Doe')
  })

  it('refuses a care worker adding to somebody else’s profile', async () => {
    const { carer, otherStaff } = await setup()
    const res = await request(app)
      .post(`/staff/${otherStaff.id}/emergency-contacts`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
      .send(contact)
    expect(res.status).toBe(403)
  })

  it('lets a care worker delete their own emergency contact', async () => {
    const { carer, carerStaff } = await setup()
    const token = generateToken(carer)
    const created = await request(app)
      .post(`/staff/${carerStaff.id}/emergency-contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send(contact)
    expect(created.status).toBe(201)

    const res = await request(app)
      .delete(`/staff/${carerStaff.id}/emergency-contacts/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('refuses a care worker deleting somebody else’s contact', async () => {
    const { admin, carer, otherStaff } = await setup()
    const created = await request(app)
      .post(`/staff/${otherStaff.id}/emergency-contacts`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send(contact)
    expect(created.status).toBe(201)

    const res = await request(app)
      .delete(`/staff/${otherStaff.id}/emergency-contacts/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
    expect(res.status).toBe(403)
  })

  it('keeps the administrator path working for any profile', async () => {
    const { admin, otherStaff } = await setup()
    const res = await request(app)
      .post(`/staff/${otherStaff.id}/emergency-contacts`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send(contact)
    expect(res.status).toBe(201)
  })
})
