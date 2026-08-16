import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Family Portal — members management', () => {
  it('should create, list, update, revoke, refresh and delete a family member', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({ organizationId: org.id, locationId: location.id })
    const mgr = await createUser({ email: `fm-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const created = await request(app)
      .post('/family-portal/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ person_id: person.id, name: 'Jane Relative', email: `fmrel-${Date.now()}@example.com`, relationship: 'daughter', phone: '07700000001' })
    expect(created.status).toBe(201)
    expect(created.body.access_token).toBeDefined()
    expect(created.body.status).toBe('invited')

    const list = await request(app)
      .get(`/family-portal/members?person_id=${person.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((m: any) => m.id === created.body.id)).toBe(true)

    const noPersonId = await request(app)
      .get('/family-portal/members')
      .set('Authorization', `Bearer ${token}`)
    expect(noPersonId.status).toBe(400)

    const updated = await request(app)
      .patch(`/family-portal/members/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ relationship: 'next of kin' })
    expect(updated.status).toBe(200)
    expect(updated.body.relationship).toBe('next of kin')

    const refreshed = await request(app)
      .post(`/family-portal/members/${created.body.id}/refresh-token`)
      .set('Authorization', `Bearer ${token}`)
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.access_token).toBeDefined()

    const revoked = await request(app)
      .post(`/family-portal/members/${created.body.id}/revoke`)
      .set('Authorization', `Bearer ${token}`)
    expect(revoked.status).toBe(200)
    expect(revoked.body.status).toBe('revoked')

    const deleted = await request(app)
      .delete(`/family-portal/members/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject creating a member for a person in another org (400)', async () => {
    const orgA = await createOrg()
    const orgB = await createOrg()
    const person = await createPerson({ organizationId: orgB.id })
    const mgr = await createUser({ email: `fm2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: orgA.id })

    const res = await request(app)
      .post('/family-portal/members')
      .set('Authorization', `Bearer ${generateToken(mgr)}`)
      .send({ person_id: person.id, name: 'Other', email: `fm2-${Date.now()}@example.com` })
    expect(res.status).toBe(400)
  })

  it('should reject a CARE_WORKER (403)', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const worker = await createUser({ email: `fm3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/family-portal/members')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ person_id: person.id, name: 'Nope', email: `fm3-${Date.now()}@example.com` })
    expect(res.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/family-portal/members')
    expect(res.status).toBe(401)
  })
})
