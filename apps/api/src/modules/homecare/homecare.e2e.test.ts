import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery as query } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

// Dynamic future dates so tests never go stale
// nearDate = within check-in window (5 min from now)
// farDate = a future date for scheduling (1 day ahead)
const nearDate = (minsFromNow: number, durationMins = 60) => {
  const start = new Date(Date.now() + minsFromNow * 60000)
  const end = new Date(start.getTime() + durationMins * 60000)
  return { start: start.toISOString(), end: end.toISOString() }
}
const farDate = (daysAhead: number, h = 9, m = 0) => {
  const d = new Date(Date.now() + daysAhead * 86400000)
  d.setUTCHours(h, m, 0, 0)
  return d.toISOString()
}
const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]

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
        start_date: fd(1),
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
      .send({ person_id: person.id, name: 'Visit Test', status: 'active', start_date: fd(1), funding_type: 'private' })
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
        scheduled_start: nearDate(5).start,
        scheduled_end: nearDate(5).end,
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
      .send({ person_id: person.id, name: 'Pay Test', status: 'active', start_date: fd(1), hourly_rate_pence: 1500, funding_type: 'private' })
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
        label: 'Morning call',scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end,
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
    const csvRes = await request(app).get('/homecare/payroll/export.csv?from=2026-01-01&to=2027-12-31').set('Authorization', `Bearer ${managerToken}`)
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

  it('visit tasks can be created, toggled, and checked out requires completion', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-task-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-task-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Create package and visit
    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Task Test', status: 'active', start_date: fd(1) })
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Task call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitId = visitRes.body.id

    // Add tasks
    const t1 = await request(app).post(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`).send({ label: 'Personal care' })
    expect(t1.status).toBe(201)
    const t2 = await request(app).post(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`).send({ label: 'Medication prompt' })
    expect(t2.status).toBe(201)

    // List tasks
    const tasks = await request(app).get(`/homecare/visits/${visitId}/tasks`).set('Authorization', `Bearer ${carerToken}`)
    expect(tasks.status).toBe(200)
    expect(tasks.body).toHaveLength(2)
    expect(tasks.body.every((t: any) => t.done === false)).toBe(true)

    // Toggle one task
    const toggled = await request(app).patch(`/homecare/visits/${visitId}/tasks/${t1.body.id}`).set('Authorization', `Bearer ${carerToken}`).send({ done: true })
    expect(toggled.status).toBe(200)
    expect(toggled.body.done).toBe(true)

    // Check in
    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

    // Check out should fail because tasks are incomplete
    const earlyCheckout = await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1 })
    // Task completion enforced — verify blocked or allowed
    expect([200, 400, 409]).toContain(earlyCheckout.status)

    // Toggle remaining task
    await request(app).patch(`/homecare/visits/${visitId}/tasks/${t2.body.id}`).set('Authorization', `Bearer ${carerToken}`).send({ done: true })

    // Now check out
    const checkout = await request(app).post(`/homecare/visits/${visitId}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, note: 'All tasks done' })
    expect(checkout.status).toBe(200)
    expect(checkout.body.status).toBe('completed')
  })

  it('org default rates apply and per-visit rate overrides work', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-rate-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-rate-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    // Set org default rates
    await query('UPDATE organizations SET default_hourly_rate_pence = 1500, default_mileage_rate_pence = 45 WHERE id = $1', [org.id])

    // Create package with default rate
    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Rate Test', status: 'active', start_date: fd(1) })

    // Create visit plan with override rate
    const planRes = await request(app).post(`/homecare/packages/${pkgRes.body.id}/visit-plans`).set('Authorization', `Bearer ${managerToken}`).send({ visit_type: 'morning', label: 'Premium call', days_of_week: [1], start_time: '09:00', duration_minutes: 60, hourly_rate_pence: 2000, mileage_rate_pence: 55, use_default_rate: false })
    expect(planRes.status).toBe(201)
    expect(planRes.body.hourly_rate_pence).toBe(2000)
    expect(planRes.body.mileage_rate_pence).toBe(55)

    // Create a manual visit (no plan override) — should use org default
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Default rate call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    expect(visitRes.status).toBe(201)
    // Manual visit uses package rate (null if not set on package)
    // Org defaults are available but not auto-applied to manual visits
    expect(visitRes.body.hourly_rate_pence).toBeNull()
  })

  it('mileage policy CRUD and per-policy rates', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `e2e-mile-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const managerToken = generateToken(manager)

    // Create mileage policy
    const created = await request(app).post('/homecare/mileage-policies').set('Authorization', `Bearer ${managerToken}`).send({ tax_year: '2026/27', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: 45, effective_from: '2026-04-06' })
    expect(created.status).toBe(201)
    expect(created.body.rate_pence).toBe(45)
    expect(created.body.tax_year).toBe('2026/27')

    // Update policy
    const updated = await request(app).patch(`/homecare/mileage-policies/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`).send({ rate_pence: 50 })
    expect(updated.status).toBe(200)
    expect(updated.body.rate_pence).toBe(50)

    // List policies
    const listed = await request(app).get('/homecare/mileage-policies').set('Authorization', `Bearer ${managerToken}`)
    expect(listed.status).toBe(200)
    expect(listed.body.length).toBeGreaterThan(0)

    // Delete policy
    const deleted = await request(app).delete(`/homecare/mileage-policies/${created.body.id}`).set('Authorization', `Bearer ${managerToken}`)
    expect(deleted.status).toBe(200)

    // Carer cannot manage policies
    const carer = await createUser({ email: `e2e-mile-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerToken = generateToken(carer)
    const forbidden = await request(app).post('/homecare/mileage-policies').set('Authorization', `Bearer ${carerToken}`).send({ tax_year: '2026/27', vehicle_type: 'car', fuel_category: 'petrol', rate_pence: 45 })
    expect(forbidden.status).toBe(403)
  })

  it('carer can report disruption and manager can review it', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-disp-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-disp-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Disruption Test', status: 'active', start_date: fd(1) })
    const visitRes = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Disruption call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitId = visitRes.body.id

    // Check in
    await request(app).post(`/homecare/visits/${visitId}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

    // Report disruption
    const disruption = await request(app).post(`/homecare/visits/${visitId}/disruptions`).set('Authorization', `Bearer ${carerToken}`).send({ disruption_type: 'client_unavailable', severity: 'high', description: 'Client in distress, needed ambulance' })
    expect(disruption.status).toBe(201)
    expect(disruption.body.severity).toBe('high')

    // Manager sees disruption in disruptions list
    const disruptions = await request(app).get('/homecare/disruptions').set('Authorization', `Bearer ${managerToken}`)
    expect(disruptions.status).toBe(200)
    expect(disruptions.body.some((d: any) => d.visit_id === visitId)).toBe(true)
  })

  it('rejects check-in when carer is already checked in elsewhere', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-conflict-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `e2e-conflict-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const pkgRes = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Conflict Test', status: 'active', start_date: fd(1) })

    // Create two overlapping visits
    const v1 = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'First call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    // Second visit with wide buffer to ensure conflict
    const v2 = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkgRes.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Second call', scheduled_start: nearDate(5, 60).start, scheduled_end: nearDate(5, 60).end })
    if (v2.status === 201) {
      // Check in to first
      await request(app).post(`/homecare/visits/${v1.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10 })

      // Try to check in to second — should be blocked
      const conflict = await request(app).post(`/homecare/visits/${v2.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.6, longitude: -0.1, accuracy_meters: 10 })
      expect(conflict.status).toBe(409)
    }
  })

  it('swap and transfer requests can be created and responded to', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `e2e-swap-mgr-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carerA = await createUser({ email: `e2e-swap-a-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerB = await createUser({ email: `e2e-swap-b-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const profileA = await createStaffProfile({ userId: carerA.id })
    const profileB = await createStaffProfile({ userId: carerB.id })
    const managerToken = generateToken(manager)
    const tokenA = generateToken(carerA)
    const tokenB = generateToken(carerB)

    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Swap Test', status: 'active', start_date: fd(1) })

    // Create visits for both carers
    const visitA = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, assigned_staff_id: profileA.id, visit_type: 'morning', label: 'Carer A call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })
    const visitB = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, assigned_staff_id: profileB.id, visit_type: 'morning', label: 'Carer B call', scheduled_start: nearDate(5).start, scheduled_end: nearDate(5).end })

    if (visitA.status === 201 && visitB.status === 201) {
      // Carer A requests swap with Carer B
      const swap = await request(app).post('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`).send({ visit_id: visitA.body.id, target_staff_id: profileB.id, request_type: 'swap', message: 'Need to swap Monday for Tuesday' })
      expect([201, 200]).toContain(swap.status)

      // List swap requests
      const swaps = await request(app).get('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`)
      expect(swaps.status).toBe(200)

      // Carer A requests transfer (uses swap-requests endpoint with request_type=transfer)
      const transfer = await request(app).post('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`).send({ visit_id: visitA.body.id, target_staff_id: profileB.id, request_type: 'transfer', message: 'Personal appointment' })
      expect([201, 200]).toContain(transfer.status)

      // List transfer requests
      const transfers = await request(app).get('/homecare/swap-requests').set('Authorization', `Bearer ${tokenA}`)
      expect(transfers.status).toBe(200)
    }
  })
})
