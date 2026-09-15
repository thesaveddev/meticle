import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Settings — org, locations, compliance, delegations', () => {
  it('should read and update org settings', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `set-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const got = await request(app)
      .get('/settings/org')
      .set('Authorization', `Bearer ${token}`)
    expect(got.status).toBe(200)

    const updated = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ minimum_compliance_percent: 90 })
    expect(updated.status).toBe(200)
  })

  it('should create, list, update and delete a location as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `set2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const created = await request(app)
      .post('/settings/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cedar House', address: '10 Cedar Lane' })
    expect(created.status).toBe(201)
    expect(created.body.name).toBe('Cedar House')

    const list = await request(app)
      .get('/settings/locations')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((l: any) => l.id === created.body.id)).toBe(true)

    const updated = await request(app)
      .put(`/settings/locations/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cedar House 2' })
    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('Cedar House 2')

    const deleted = await request(app)
      .delete(`/settings/locations/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should manage compliance config and profiles as ORG_ADMIN', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `set3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const cfg = await request(app)
      .post('/settings/compliance-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'DBS check', category: 'criminal-records', is_mandatory: true, days_warning: 60, days_overdue: 90 })
    expect(cfg.status).toBe(201)
    expect(cfg.body.name).toBe('DBS check')

    const cfgList = await request(app)
      .get('/settings/compliance-config')
      .set('Authorization', `Bearer ${token}`)
    expect(cfgList.status).toBe(200)
    expect(cfgList.body.some((c: any) => c.id === cfg.body.id)).toBe(true)

    const profile = await request(app)
      .post('/settings/compliance-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Care Worker', role_name: 'CARE_WORKER', description: 'Standard' })
    expect(profile.status).toBe(201)

    const profiles = await request(app)
      .get('/settings/compliance-profiles')
      .set('Authorization', `Bearer ${token}`)
    expect(profiles.status).toBe(200)
    expect(profiles.body.some((p: any) => p.id === profile.body.id)).toBe(true)
  })

  it('should create a manager delegation as ORG_ADMIN', async () => {
    const org = await createOrg()
    const mgrA = await createUser({ email: `set4a-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const mgrB = await createUser({ email: `set4b-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ userId: mgrA.id })
    await createStaffProfile({ userId: mgrB.id })
    const admin = await createUser({ email: `set4c-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const created = await request(app)
      .post('/settings/delegations')
      .set('Authorization', `Bearer ${token}`)
      .send({ primary_manager_id: mgrA.id, delegate_manager_id: mgrB.id })
    expect(created.status).toBe(201)
    expect(created.body.primary_manager_id).toBe(mgrA.id)

    const list = await request(app)
      .get('/settings/delegations')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.some((d: any) => d.id === created.body.id)).toBe(true)

    const deleted = await request(app)
      .delete(`/settings/delegations/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
  })

  it('should reject a CARE_WORKER creating a location (403)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `set5-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const res = await request(app)
      .post('/settings/locations')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ name: 'Nope' })
    expect(res.status).toBe(403)
  })

  it('should store, read back, preserve and clear the two organisation SOS contacts', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `sos-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(admin)

    const saved = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ emergency_contact_1_label: 'Office', emergency_contact_1_phone: '020 7946 0000', emergency_contact_2_label: 'Supervisor', emergency_contact_2_phone: '07700 900123' })
    expect(saved.status).toBe(200)

    const read = await request(app).get('/settings/org').set('Authorization', `Bearer ${token}`)
    expect(read.body.emergency_contact_1_label).toBe('Office')
    expect(read.body.emergency_contact_1_phone).toBe('020 7946 0000')
    expect(read.body.emergency_contact_2_label).toBe('Supervisor')
    expect(read.body.emergency_contact_2_phone).toBe('07700 900123')

    // Saving a different settings section must not wipe the contacts, and the
    // numbers travel with the session so the mobile SOS sheet has them.
    await request(app).patch('/settings/org').set('Authorization', `Bearer ${token}`).send({ minimum_compliance_percent: 85 })
    const afterOtherSection = await request(app).get('/settings/org').set('Authorization', `Bearer ${token}`)
    expect(afterOtherSection.body.emergency_contact_1_phone).toBe('020 7946 0000')
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(me.body.organization.emergency_contact_1_phone).toBe('020 7946 0000')
    expect(me.body.organization.emergency_contact_2_label).toBe('Supervisor')

    // An empty value removes a contact so it stops appearing on the SOS button.
    const cleared = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${token}`)
      .send({ emergency_contact_1_phone: '' })
    expect(cleared.status).toBe(200)
    expect(cleared.body.emergency_contact_1_phone).toBeNull()
    expect(cleared.body.emergency_contact_2_phone).toBe('07700 900123')
  })

  it('should reject SOS contacts that are not dialable (400)', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `sos2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })

    const res = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ emergency_contact_1_phone: 'call the office' })
    expect(res.status).toBe(400)
  })

  it('should refuse SOS contacts from managers and carers', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `sos3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const worker = await createUser({ email: `sos4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const asManager = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ emergency_contact_1_phone: '07700 900456' })
    expect(asManager.status).toBe(403)

    const asWorker = await request(app)
      .patch('/settings/org')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ emergency_contact_1_phone: '07700 900456' })
    expect(asWorker.status).toBe(403)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/settings/org')
    expect(res.status).toBe(401)
  })
})
