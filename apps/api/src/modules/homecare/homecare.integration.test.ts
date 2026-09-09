import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery } from '../../shared/database'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

describe('Homecare Phase 2 foundation', () => {
  it('creates a package, executes an assigned visit, prepares and exports an approved timesheet', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `hc-manager-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `hc-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const packageResponse = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
      person_id: person.id, name: 'Morning and evening support', start_date: '2026-09-01', hourly_rate_pence: 1500, travel_time_paid: true, mileage_rate_pence: 45,
    })
    expect(packageResponse.status).toBe(201)

    const visitResponse = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
      package_id: packageResponse.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Morning call', scheduled_start: '2026-09-01T08:00:00.000Z', scheduled_end: '2026-09-01T09:00:00.000Z',
    })
    expect(visitResponse.status).toBe(201)

    const checkedIn = await request(app).post(`/homecare/visits/${visitResponse.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 12, actual_travel_minutes: 18, actual_mileage_miles: 4.2 })
    expect(checkedIn.status).toBe(200)
    expect(checkedIn.body.status).toBe('checked_in')

    const checkedOut = await request(app).post(`/homecare/visits/${visitResponse.body.id}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10, actual_mileage_miles: 4.2, note: 'Client supported with breakfast.' })
    expect(checkedOut.status).toBe(200)
    expect(checkedOut.body.status).toBe('completed')

    const timesheets = await request(app).get('/homecare/timesheets').set('Authorization', `Bearer ${managerToken}`)
    expect(timesheets.status).toBe(200)
    expect(timesheets.body[0].status).toBe('submitted')
    expect(timesheets.body[0].paid_travel_minutes).toBeGreaterThanOrEqual(18)

    const approved = await request(app).patch(`/homecare/timesheets/${timesheets.body[0].id}`).set('Authorization', `Bearer ${managerToken}`).send({ status: 'approved' })
    expect(approved.status).toBe(200)
    expect(approved.body.status).toBe('approved')

    const exportResponse = await request(app).get('/homecare/payroll/export.csv?from=2026-09-01&to=2026-09-30').set('Authorization', `Bearer ${managerToken}`)
    expect(exportResponse.status).toBe(200)
    expect(exportResponse.headers['content-type']).toContain('text/csv')
    expect(exportResponse.text).toContain('paid_travel_minutes')
    expect(exportResponse.text).toContain(carerProfile.id)
  })

  it('generates recurring visits once and rejects unavailable or overlapping assignments', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `hc-generator-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `hc-available-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const carerProfile = await createStaffProfile({ userId: carer.id })
    const managerToken = generateToken(manager)

    await migrateQuery(`INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, TRUE)`, [carerProfile.id, 1, '08:00', '18:00'])
    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Weekday calls', status: 'active', start_date: '2030-01-01' })
    const plan = await request(app).post(`/homecare/packages/${pkg.body.id}/visit-plans`).set('Authorization', `Bearer ${managerToken}`).send({ visit_type: 'routine', label: 'Routine call', days_of_week: [1], start_time: '09:00', duration_minutes: 30, default_staff_id: carerProfile.id })
    expect(plan.status).toBe(201)

    const generated = await request(app).post(`/homecare/visit-plans/${plan.body.id}/generate`).set('Authorization', `Bearer ${managerToken}`).send({ from: '2030-01-07', to: '2030-01-13' })
    expect(generated.status).toBe(201)
    expect(generated.body.generated_count).toBe(1)

    const repeated = await request(app).post(`/homecare/visit-plans/${plan.body.id}/generate`).set('Authorization', `Bearer ${managerToken}`).send({ from: '2030-01-07', to: '2030-01-13' })
    expect(repeated.status).toBe(201)
    expect(repeated.body.generated_count).toBe(0)
    expect(repeated.body.skipped_existing).toBe(1)

    const conflictingVisit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'routine', label: 'Overlapping call', scheduled_start: '2030-01-07T09:15:00.000Z', scheduled_end: '2030-01-07T09:45:00.000Z' })
    expect(conflictingVisit.status).toBe(409)

    const unavailablePlan = await request(app).post(`/homecare/packages/${pkg.body.id}/visit-plans`).set('Authorization', `Bearer ${managerToken}`).send({ visit_type: 'routine', label: 'Sunday call', days_of_week: [0], start_time: '09:00', duration_minutes: 30, default_staff_id: carerProfile.id })
    const unavailable = await request(app).post(`/homecare/visit-plans/${unavailablePlan.body.id}/generate`).set('Authorization', `Bearer ${managerToken}`).send({ from: '2030-01-13', to: '2030-01-13' })
    expect(unavailable.status).toBe(409)
    expect(unavailable.body.message).toContain('not available')
  })

  it('records and resolves manager exceptions, while keeping carer writes restricted', async () => {
    const org = await createOrg()
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `hc-exception-manager-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const carer = await createUser({ email: `hc-exception-carer-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const managerToken = generateToken(manager)
    const carerToken = generateToken(carer)

    const forbiddenPackage = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${carerToken}`).send({ person_id: person.id, name: 'No', start_date: '2030-01-01' })
    expect(forbiddenPackage.status).toBe(403)

    const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({ person_id: person.id, name: 'Package', start_date: '2030-01-01' })
    const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({ package_id: pkg.body.id, person_id: person.id, visit_type: 'routine', label: 'Missed call', scheduled_start: '2030-01-01T10:00:00.000Z', scheduled_end: '2030-01-01T10:30:00.000Z' })
    const missed = await request(app).patch(`/homecare/visits/${visit.body.id}`).set('Authorization', `Bearer ${managerToken}`).send({ status: 'missed', late_reason: 'Client unavailable' })
    expect(missed.status).toBe(200)

    const exceptions = await request(app).get('/homecare/exceptions').set('Authorization', `Bearer ${managerToken}`)
    expect(exceptions.status).toBe(200)
    expect(exceptions.body.some((item: any) => item.id === visit.body.id)).toBe(true)

    const resolved = await request(app).post(`/homecare/visits/${visit.body.id}/resolve-exception`).set('Authorization', `Bearer ${managerToken}`).send({ exception_type: 'missed', resolution_note: 'Manager contacted the client and arranged a welfare follow-up.' })
    expect(resolved.status).toBe(200)
    expect(resolved.body.exception_resolved_at).toBeTruthy()
  })

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/homecare/packages')
    expect(res.status).toBe(401)
  })
})
