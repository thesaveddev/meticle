import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery as query } from '../../shared/database'

let app: Express
beforeAll(() => { app = createTestApp() })

/**
 * A call window starting imminently, plus the calendar day the payslip queries
 * will actually match it on.
 *
 * The day cannot be taken from the UTC timestamp. The payslip and earnings
 * queries bound the period with bare `::date` casts, which Postgres resolves in
 * the session TimeZone, so "a whole day" in Europe/London ends at 23:00Z rather
 * than midnight. Slicing the ISO string gives the UTC date, and during the last
 * hour of a UTC day that is a different day from the one the query sees — the
 * suite would then fail only when CI happened to run in that hour. Asking the
 * database for the date in its own timezone is the only version that agrees
 * with the query.
 */
const nearDate = async (minsFromNow: number, durationMins = 60) => {
  const start = new Date(Date.now() + minsFromNow * 60000)
  const end = new Date(start.getTime() + durationMins * 60000)
  const { rows } = await query(
    `SELECT to_char($1::timestamptz AT TIME ZONE current_setting('TimeZone'), 'YYYY-MM-DD') AS day`,
    [start.toISOString()]
  )
  return { start: start.toISOString(), end: end.toISOString(), day: rows[0].day }
}
const fd = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0]
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** A completed, timesheeted call so the carer has earnings in the period. */
async function carerWithCompletedCall() {
  const org = await createOrg()
  const person = await createPerson({ organizationId: org.id })
  const manager = await createUser({ email: `payslip-manager-${unique()}@test.com`, role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `payslip-carer-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const carerProfile = await createStaffProfile({ userId: carer.id })
  const managerToken = generateToken(manager)
  const carerToken = generateToken(carer)

  const pkg = await request(app).post('/homecare/packages').set('Authorization', `Bearer ${managerToken}`).send({
    person_id: person.id, name: 'Payslip package', start_date: fd(1), hourly_rate_pence: 1500, travel_time_paid: true, mileage_rate_pence: 45,
  })
  expect(pkg.status).toBe(201)

  const when = await nearDate(5)
  const visit = await request(app).post('/homecare/visits').set('Authorization', `Bearer ${managerToken}`).send({
    package_id: pkg.body.id, person_id: person.id, assigned_staff_id: carerProfile.id, visit_type: 'morning', label: 'Morning call', scheduled_start: when.start, scheduled_end: when.end,
  })
  expect(visit.status).toBe(201)

  const checkedIn = await request(app).post(`/homecare/visits/${visit.body.id}/check-in`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 12, actual_travel_minutes: 15, actual_mileage_miles: 4.2 })
  expect(checkedIn.status).toBe(200)
  const checkedOut = await request(app).post(`/homecare/visits/${visit.body.id}/check-out`).set('Authorization', `Bearer ${carerToken}`).send({ latitude: 51.5, longitude: -0.1, accuracy_meters: 10, actual_mileage_miles: 4.2, note: 'Supported with breakfast.' })
  expect(checkedOut.status).toBe(200)

  return { org, person, manager, managerToken, carer, carerToken, carerProfile, day: when.day }
}

describe('payslip download', () => {
  it('refuses a carer trying to download another carer\u2019s payslip', async () => {
    const { org, carerToken, day } = await carerWithCompletedCall()
    const colleague = await createUser({ email: `payslip-colleague-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const colleagueProfile = await createStaffProfile({ userId: colleague.id })

    const response = await request(app)
      .get(`/homecare/my-payslip?from=${day}&to=${day}&staffId=${colleagueProfile.id}`)
      .set('Authorization', `Bearer ${carerToken}`)

    expect(response.status).toBe(403)
    expect(response.body.message).toContain('managers')
  })

  it('cannot reach a staff profile in another organisation, even as a manager', async () => {
    const { managerToken, day } = await carerWithCompletedCall()
    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `payslip-outsider-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: otherOrg.id })
    const outsiderProfile = await createStaffProfile({ userId: outsider.id })

    const response = await request(app)
      .get(`/homecare/my-payslip?from=${day}&to=${day}&staffId=${outsiderProfile.id}`)
      .set('Authorization', `Bearer ${managerToken}`)

    expect(response.status).toBe(404)
    expect(response.body.message).toContain('Staff member not found')
  })

  it('rejects a request with no period, and a carer with no staff profile', async () => {
    const { org, carerToken, day } = await carerWithCompletedCall()

    const noPeriod = await request(app).get('/homecare/my-payslip').set('Authorization', `Bearer ${carerToken}`)
    expect(noPeriod.status).toBe(400)

    const noProfile = await createUser({ email: `payslip-no-profile-${unique()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const response = await request(app)
      .get(`/homecare/my-payslip?from=${day}&to=${day}`)
      .set('Authorization', `Bearer ${generateToken(noProfile)}`)
    expect(response.status).toBe(404)
  })

  it('is not exposed to roles with no field or manager responsibility', async () => {
    const { org, day } = await carerWithCompletedCall()
    const unrelated = await createUser({ email: `payslip-unrelated-${unique()}@test.com`, role: 'COMPLIANCE_OFFICER', organization_id: org.id })
    const response = await request(app)
      .get(`/homecare/my-payslip?from=${day}&to=${day}`)
      .set('Authorization', `Bearer ${generateToken(unrelated)}`)
    expect(response.status).toBe(403)
  })
})

describe('year-to-date earnings', () => {
  it('reports month buckets that add up to the year-to-date totals', async () => {
    const { carerToken, day } = await carerWithCompletedCall()

    const response = await request(app)
      .get(`/homecare/my-earnings?from=${day}&to=${day}`)
      .set('Authorization', `Bearer ${carerToken}`)

    expect(response.status).toBe(200)
    expect(response.body.summary.visit_count).toBe(1)

    const ytd = response.body.ytd
    expect(ytd.year).toBe(Number(day.slice(0, 4)))
    expect(ytd.visit_count).toBe(1)
    expect(ytd.total_gross_pay_pence).toBe(response.body.summary.total_gross_pay_pence)
    expect(ytd.months).toHaveLength(1)
    expect(ytd.months[0].month).toBe(day.slice(0, 7))
    expect(ytd.months[0].gross_pay_pence).toBe(response.body.summary.total_gross_pay_pence)
  })
})
