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

  it('files the handover-due alert under the staffing category a manager filters by', async () => {
    const org = await createOrg({ primary_service_type: 'supported_living' })
    const manager = await createUser({ email: `mc-handover-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
    const shift = await createShift({
      location_id: location.id,
      start_time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'filled',
    })
    // The row the sweep's consumer writes, raised as if `shift.handover_due` had just
    // been delivered.
    await migrateQuery(
      `INSERT INTO mission_control_alerts (organization_id, alert_type, aggregate_id, severity, title, message, link)
       VALUES ($1, 'shift.handover_due', $2, 'high', 'Handover missing: Ash Grove',
               'Day shift ended 22:00 with no handover recorded — 1 staff on the shift were told to write one', $3)`,
      [org.id, shift.id, `/scheduling?week=${shift.start_time.toISOString().slice(0, 10)}&shift=${shift.id}`],
    )

    const staffing = await request(app)
      .get('/mission-control/alerts?category=staffing')
      .set('Authorization', `Bearer ${token}`)
    expect(staffing.status).toBe(200)
    expect(staffing.body.map((row: any) => row.alert_type)).toContain('shift.handover_due')

    // And it is counted with the other staffing gaps, not dropped from the summary.
    const summary = await request(app)
      .get('/mission-control/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.categories.staffing_safety).toBe(1)
  })

  it('files the room-check-overdue alert under compliance and counts it there', async () => {
    const org = await createOrg({ primary_service_type: 'supported_living' })
    const manager = await createUser({ email: `mc-room-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
    // The row the sweep's consumer writes, raised as if `room_check.overdue` had just
    // been delivered. The aggregate is the room, not a shift: the state being reported
    // is a check that does not exist.
    await migrateQuery(
      `INSERT INTO mission_control_alerts (organization_id, alert_type, aggregate_id, severity, title, message, link)
       VALUES ($1, 'room_check.overdue', $2, 'high', 'Room check overdue: 12',
               '12 at Ash Grove had no room check recorded by 18:00 today.', '/room-checks')`,
      [org.id, `${location.id}:12`],
    )

    // A missing daily record is an evidence gap, so it has to survive the filter a
    // manager actually applies rather than only appearing under "All".
    const compliance = await request(app)
      .get('/mission-control/alerts?category=compliance')
      .set('Authorization', `Bearer ${token}`)
    expect(compliance.status).toBe(200)
    expect(compliance.body.map((row: any) => row.alert_type)).toContain('room_check.overdue')

    const summary = await request(app)
      .get('/mission-control/summary')
      .set('Authorization', `Bearer ${token}`)
    expect(summary.status).toBe(200)
    expect(summary.body.categories.compliance).toBe(1)
    // And it is not double-counted into the staffing bucket.
    expect(summary.body.categories.staffing_safety).toBe(0)
  })

  it('lists shifts that ended without a handover, with who was on them', async () => {
    const org = await createOrg({ primary_service_type: 'supported_living' })
    const otherOrg = await createOrg({ primary_service_type: 'supported_living' })
    const manager = await createUser({ email: `mc-gaps-${Date.now()}@test.com`, role: 'MANAGER', organization_id: org.id })
    const token = generateToken(manager)
    const location = await createLocation({ organization_id: org.id, name: 'Ash Grove' })
    const otherLocation = await createLocation({ organization_id: otherOrg.id, name: 'Foreign House' })

    const rostered = async (email: string, first: string, last: string, organizationId: string) => {
      const user = await createUser({ email, role: 'CARE_WORKER', organization_id: organizationId })
      return createStaffProfile({ user_id: user.id, location_id: location.id, first_name: first, last_name: last })
    }
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const nadia = await rostered(`mc-nadia-${Date.now()}@test.com`, 'Nadia', 'Khan', org.id)
    const tom = await rostered(`mc-tom-${Date.now()}@test.com`, 'Tom', 'Abara', org.id)

    // The gap: two staff on the shift, ended four hours ago, no handover.
    const missing = await createShift({
      location_id: location.id,
      start_time: hoursAgo(12),
      end_time: hoursAgo(4),
      status: 'filled',
    })
    for (const staff of [nadia, tom]) {
      await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [missing.id, staff.id])
    }

    // A shift somebody did hand over is not a gap.
    const written = await createShift({ location_id: location.id, start_time: hoursAgo(20), end_time: hoursAgo(12), status: 'filled' })
    await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [written.id, nadia.id])
    await migrateQuery(
      `INSERT INTO shift_handovers (organization_id, shift_id, author_id, what_happened, recorded_at)
       VALUES ($1, $2, $3, 'Evening was settled; no incidents.', CURRENT_TIMESTAMP)`,
      [org.id, written.id, nadia.user_id],
    )

    // A shift that ended five minutes ago is one the worker is still writing up, so
    // it is inside the same grace period the sweep uses and is not listed yet.
    const justEnded = await createShift({
      location_id: location.id,
      start_time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'filled',
    })
    await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [justEnded.id, nadia.id])

    // A cancelled shift happened to nobody, so it hands nothing over.
    const cancelled = await createShift({ location_id: location.id, start_time: hoursAgo(10), end_time: hoursAgo(2), status: 'cancelled' })
    await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [cancelled.id, tom.id])

    // Older than the default window, and already nudged: only the wider window sees it.
    const older = await createShift({ location_id: location.id, start_time: hoursAgo(24 * 10), end_time: hoursAgo(24 * 9), status: 'filled' })
    await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [older.id, nadia.id])
    await migrateQuery(`UPDATE shifts SET handover_due_notified_at = CURRENT_TIMESTAMP WHERE id = $1`, [older.id])

    // Another provider's gap is none of this provider's business.
    const foreignWorker = await createUser({ email: `mc-foreign-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: otherOrg.id })
    const foreignStaff = await createStaffProfile({ user_id: foreignWorker.id, location_id: otherLocation.id, first_name: 'Foreign', last_name: 'Worker' })
    const foreignShift = await createShift({ location_id: otherLocation.id, start_time: hoursAgo(9), end_time: hoursAgo(1), status: 'filled' })
    await migrateQuery(`INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1, $2, 'assigned')`, [foreignShift.id, foreignStaff.id])

    const response = await request(app)
      .get('/mission-control/handover-gaps')
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ window_days: 7, grace_minutes: 30, total: 1 })
    expect(response.body.shifts).toHaveLength(1)
    expect(response.body.shifts[0]).toMatchObject({
      shift_id: missing.id,
      location_name: 'Ash Grove',
      staff_notified: false,
      hours_since_end: 4,
    })
    expect(response.body.shifts[0].rostered.map((person: any) => person.name)).toEqual(['Nadia Khan', 'Tom Abara'])
    expect(JSON.stringify(response.body)).not.toContain('Foreign House')

    // The wider window reaches past the sweep's own lookback, and the marker the
    // sweep stamps is what tells a manager the staff have already been told.
    const wider = await request(app)
      .get('/mission-control/handover-gaps?days=14')
      .set('Authorization', `Bearer ${token}`)
    expect(wider.status).toBe(200)
    expect(wider.body.total).toBe(2)
    const nudged = wider.body.shifts.find((row: any) => row.shift_id === older.id)
    expect(nudged).toMatchObject({ staff_notified: true })
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
