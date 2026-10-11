import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { migrateQuery } from '../../shared/database'
import { createTestApp } from '../../test/helpers'
import { createOrg, createPerson, createStaffProfile, createUser, createLocation, createShift, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

const dayFromNow = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

describe('Mission Control operational summary', () => {
  it('uses one selected date for calls while retaining a distinct all-date overdue backlog', async () => {
    const org = await createOrg({ primary_service_type: 'domiciliary' })
    const person = await createPerson({ organizationId: org.id })
    const manager = await createUser({ email: `mission-control-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    const selectedDate = dayFromNow(8)
    const nextDate = dayFromNow(9)

    const packageResult = await migrateQuery(
      `INSERT INTO homecare_packages (organization_id, person_id, name, status, start_date)
       VALUES ($1, $2, 'Mission Control test package', 'active', $3::date) RETURNING id`,
      [org.id, person.id, dayFromNow(1)],
    )
    const packageId = packageResult.rows[0].id
    const calls = [
      { status: 'completed', day: selectedDate, staffId: null },
      { status: 'scheduled', day: selectedDate, staffId: null },
      { status: 'missed', day: selectedDate, staffId: null },
      { status: 'missed', day: nextDate, staffId: null },
      { status: 'scheduled', day: dayFromNow(-3), staffId: null },
    ]
    for (const [index, call] of calls.entries()) {
      await migrateQuery(
        `INSERT INTO homecare_visits
           (organization_id, package_id, person_id, visit_type, label, scheduled_start, scheduled_end, status)
         VALUES ($1, $2, $3, 'routine', $4, $5::date + interval '10 hours', $5::date + interval '11 hours', $6)`,
        [org.id, packageId, person.id, `Mission Control call ${index}`, call.day, call.status],
      )
    }

    const selected = await request(app)
      .get(`/mission-control/homecare-summary?date=${selectedDate}`)
      .set('Authorization', `Bearer ${token}`)
    expect(selected.status).toBe(200)
    expect(selected.body).toMatchObject({
      total_today: 3,
      completed_today: 1,
      missed_today: 1,
      unassigned_today: 1,
      overdue_calls: 1,
    })
    expect(selected.body.calls_by_status).toEqual(expect.arrayContaining([
      { status: 'completed', count: 1 },
      { status: 'scheduled', count: 1 },
      { status: 'missed', count: 1 },
    ]))

    const adjacent = await request(app)
      .get(`/mission-control/homecare-summary?date=${nextDate}`)
      .set('Authorization', `Bearer ${token}`)
    expect(adjacent.status).toBe(200)
    expect(adjacent.body.total_today).toBe(1)
    expect(adjacent.body.missed_today).toBe(1)
    expect(adjacent.body.completed_today).toBe(0)
    // The backlog is explicitly organization-wide / all dates and is shared
    // regardless of which operational day is selected.
    expect(adjacent.body.overdue_calls).toBe(selected.body.overdue_calls)
  })

  it('reports seven-day coverage gaps against the configurable threshold and keeps data tenant-scoped', async () => {
    const org = await createOrg({ primary_service_type: 'supported_living' })
    await migrateQuery('UPDATE organizations SET minimum_staffing_coverage_percent = 80 WHERE id = $1', [org.id])
    const otherOrg = await createOrg({ primary_service_type: 'supported_living', minimum_staffing_coverage_percent: 1 })
    const manager = await createUser({ email: `mc-staffing-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    const location = await createLocation({ organization_id: org.id, minimum_staff_per_day: 2, name: 'Maple House' })
    const otherLocation = await createLocation({ organization_id: otherOrg.id, minimum_staff_per_day: 4, name: 'Foreign House' })
    const worker = await createUser({ email: `mc-staff-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
    const staffProfile = await createStaffProfile({ user_id: worker.id, location_id: location.id })
    const shift = await createShift({
      location_id: location.id,
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`,
      [shift.id, staffProfile.id],
    )
    await createShift({
      location_id: otherLocation.id,
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    })

    const response = await request(app)
      .get('/mission-control/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.staffing_coverage).toMatchObject({
      shifts_with_target: 1,
      below_minimum_shifts: 1,
      unstaffed_shifts: 0,
      coverage_percent: 50,
      staffing_shortfall: 1,
      required_coverage_percent: 80,
    })
    expect(response.body.staffing_coverage.affected_shifts).toHaveLength(1)
    expect(response.body.staffing_coverage.affected_shifts[0]).toMatchObject({
      location_id: location.id,
      assigned_staff: 1,
      minimum_staff: 2,
      shortfall: 1,
      coverage_percent: 50,
    })
    expect(JSON.stringify(response.body.staffing_coverage)).not.toContain('Foreign House')
  })

  it('keeps the homecare summary scoped to the authenticated organisation', async () => {
    const orgA = await createOrg({ primary_service_type: 'domiciliary' })
    const orgB = await createOrg({ primary_service_type: 'domiciliary' })
    const userA = await createUser({ email: `mc-org-a-${Date.now()}@test.com`, role: 'MANAGER', organization_id: orgA.id })
    const personB = await createPerson({ organizationId: orgB.id })
    const packageB = await migrateQuery(
      `INSERT INTO homecare_packages (organization_id, person_id, name, status, start_date)
       VALUES ($1, $2, 'Other organisation package', 'active', CURRENT_DATE) RETURNING id`,
      [orgB.id, personB.id],
    )
    await migrateQuery(
      `INSERT INTO homecare_visits
         (organization_id, package_id, person_id, visit_type, label, scheduled_start, scheduled_end, status)
       VALUES ($1, $2, $3, 'routine', 'Other tenant missed call', CURRENT_DATE + interval '10 hours', CURRENT_DATE + interval '11 hours', 'missed')`,
      [orgB.id, packageB.rows[0].id, personB.id],
    )

    const response = await request(app)
      .get(`/mission-control/homecare-summary?date=${dayFromNow(0)}`)
      .set('Authorization', `Bearer ${generateToken(userA)}`)
    expect(response.status).toBe(200)
    expect(response.body.missed_today).toBe(0)
    expect(response.body.total_today).toBe(0)
  })
})
