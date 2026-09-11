import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery as query } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

describe('Homecare E2E critical workflows', () => {
  it('org admin can create a care package with funding type and client rate', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-pkg-${Date.now()}@test.com`, role: 'ORG_ADMIN', organization_id: org.id })
    const token = generateToken(manager)

    const res = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        person_id: person.id,
        name: 'E2E Test Package',
        status: 'active',
        funding_type: 'local_authority',
        start_date: '2026-09-01',
        weekly_hours: 14,
        hourly_rate_pence: 1800,
        client_rate_pence: 2200,
        travel_time_paid: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('E2E Test Package')
    expect(res.body.funding_type).toBe('local_authority')
    expect(res.body.client_rate_pence).toBe(2200)
  })

  it('carer can check in and check out a visit with GPS coordinates', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-visit-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-visit-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Visit Test', status: 'active', start_date: '2026-09-01', funding_type: 'private' })
    const pkgId = pkgRes.body.id

    // Create visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',
        scheduled_start: '2026-09-11T09:00:00.000Z',
        scheduled_end: '2026-09-11T10:00:00.000Z',
      })
    expect(visitRes.status).toBe(201)
    const visitId = visitRes.body.id

    // Check in
    const checkInRes = await request(app)
      .post(`/homecare/visits/${visitId}/check-in`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send({ latitude: 51.5074, longitude: -0.1278, accuracy_meters: 10 })
    expect(checkInRes.status).toBe(200)
    expect(checkInRes.body.status).toBe('checked_in')

    // Check out
    const checkOutRes = await request(app)
      .post(`/homecare/visits/${visitId}/check-out`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send({ latitude: 51.5075, longitude: -0.1279, note: 'Visit completed', actual_travel_minutes: 15, actual_mileage_miles: 3.2 })
    expect(checkOutRes.status).toBe(200)
    expect(checkOutRes.body.status).toBe('completed')
  })

  it('manager can approve a timesheet and export payroll CSV', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-pay-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-pay-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Pay Test', status: 'active', start_date: '2026-09-01', hourly_rate_pence: 1500, funding_type: 'private' })
    const pkgId = pkgRes.body.id

    // Create and complete a visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',
        scheduled_start: '2026-09-10T09:00:00.000Z',
        scheduled_end: '2026-09-10T10:00:00.000Z',
      })
    const visitId = visitRes.body.id

    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })
    await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })

    // List timesheets
    const tsRes = await request(app).get('/homecare/timesheets').set('Authorization', `Bearer ${managerToken}`)
    expect(tsRes.status).toBe(200)
    expect(tsRes.body.length).toBeGreaterThan(0)

    // Approve timesheet
    const tsId = tsRes.body[0].id
    const approveRes = await request(app).patch(`/homecare/timesheets/${tsId}`).set('Authorization', `Bearer ${managerToken}`).send({ status: 'approved' })
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.status).toBe('approved')

    // Export payroll CSV
    const csvRes = await request(app).get('/homecare/payroll/export.csv?from=2026-09-01&to=2026-09-30').set('Authorization', `Bearer ${managerToken}`)
    expect(csvRes.status).toBe(200)
    expect(csvRes.headers['content-type']).toContain('text/csv')
  })

  it('manager can create, approve, and download a client billing invoice', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-bill-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-bill-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package with client rate
    const pkgRes = await request(app)
      .post('/homecare/packages')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ person_id: person.id, name: 'Bill Test', status: 'active', start_date: '2026-08-01', client_rate_pence: 2000, funding_type: 'private' })
    const pkgId = pkgRes.body.id

    // Create and complete a visit
    const visitRes = await request(app)
      .post('/homecare/visits')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        package_id: pkgId,
        person_id: person.id,
        assigned_staff_id: carerProfile.id,
        visit_type: 'morning',
        label: 'Morning call',
        scheduled_start: '2026-08-15T09:00:00.000Z',
        scheduled_end: '2026-08-15T10:00:00.000Z',
      })
    const visitId = visitRes.body.id

    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })
    await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })

    // Create billing run
    const runRes = await request(app)
      .post('/homecare/client-billing/runs')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ from: '2026-08-01', to: '2026-08-31' })
    expect(runRes.status).toBe(201)
    const runId = runRes.body.run.id

    // Approve billing run
    const approveRes = await request(app).post(`/homecare/client-billing/runs/${runId}/approve`).set('Authorization', `Bearer ${managerToken}`)
    expect(approveRes.status).toBe(200)
    expect(approveRes.body.invoice_number).toBeDefined()

    // Download MTD export
    const mtdRes = await request(app).get(`/homecare/client-billing/runs/${runId}/mtd-export`).set('Authorization', `Bearer ${managerToken}`)
    expect(mtdRes.status).toBe(200)
    expect(mtdRes.body.format).toBe('HMRC_MTD_VAT')
    expect(mtdRes.body.invoice.invoice_number).toBe(approveRes.body.invoice_number)
  })
})
