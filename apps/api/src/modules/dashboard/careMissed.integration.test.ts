import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express

beforeAll(() => {
  app = createTestApp()
}, 30_000)

/**
 * Care 1.5: the medication widget separates missed from overdue so today's
 * chart alone never says "0 due" when care slipped through yesterday.
 */
describe('Care — missed-medication distinction (1.5)', () => {
  it('names the people behind the missed count, with the chart the reminder opens', async () => {
    const org = await createOrg()
    const admin = await createUser({
      email: `care-med-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'ORG_ADMIN',
      organization_id: org.id,
    })
    const token = generateToken(admin)
    const workerUser = await createUser({
      email: `care-med-staff-${Date.now()}@test.com`,
      role: 'CARE_WORKER',
      organization_id: org.id,
    })
    const staff = await createStaffProfile({
      user_id: workerUser.id,
      first_name: 'Jide',
      last_name: 'Okafor',
    })

    // Other provider: their missed medication must not leak into ours.
    const otherOrg = await createOrg()
    const otherWorker = await createUser({
      email: `care-med-other-${Date.now()}@test.com`,
      role: 'CARE_WORKER',
      organization_id: otherOrg.id,
    })
    const otherStaff = await createStaffProfile({ user_id: otherWorker.id })
    const otherPerson = await migrateQuery(
      `INSERT INTO people (organization_id, first_name, last_name) VALUES ($1, 'Foreign', 'Resident') RETURNING id`,
      [otherOrg.id],
    )
    const otherRecord = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, created_by)
       VALUES ($1, $2, 'Other chart', CURRENT_DATE - 1, CURRENT_DATE + 30, $3) RETURNING id`,
      [otherOrg.id, otherPerson.rows[0].id, admin.id],
    )
    const otherItem = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, frequency)
       VALUES ($1, 'OtherMed', '5mg', 'daily') RETURNING id`,
      [otherRecord.rows[0].id],
    )
    // Missed two days ago in that other provider — well outside today's chart, wrong org.
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '2 days', 'missed')`,
      [otherItem.rows[0].id, otherStaff.id],
    )

    const person = await migrateQuery(
      `INSERT INTO people (organization_id, first_name, last_name) VALUES ($1, 'Amara', 'Nwosu') RETURNING id`,
      [org.id],
    )
    const ourPersonId = person.rows[0].id
    const record = await migrateQuery(
      `INSERT INTO emedication_records (organization_id, person_id, title, start_date, end_date, created_by)
       VALUES ($1, $2, 'Amara chart', CURRENT_DATE - 1, CURRENT_DATE + 30, $3) RETURNING id`,
      [org.id, ourPersonId, admin.id],
    )
    const item = await migrateQuery(
      `INSERT INTO emedication_items (emedication_record_id, name, dosage, frequency)
       VALUES ($1, 'Metformin', '500mg', 'daily') RETURNING id`,
      [record.rows[0].id],
    )
    const ourItemId = item.rows[0].id

    // A missed dose −25h ago: missed yesterday (and overdue), outside today's chart.
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '25 hours', 'missed')`,
      [ourItemId, staff.id],
    )
    // A pending slot −31min ago: the overdue one.
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '31 minutes', 'pending')`,
      [ourItemId, staff.id],
    )
    // A pending slot tomorrow: must not be counted (the fix: pending rows had
    // no chart context, so "overdue" meant nothing was under control yet).
    await migrateQuery(
      `INSERT INTO emedication_administrations (emedication_item_id, staff_id, scheduled_time, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '2 hours', 'pending')`,
      [ourItemId, staff.id],
    )

    const res = await request(app)
      .get('/dashboard/widgets')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)

    const widgets = res.body.widgets ?? res.body
    expect(widgets.overdue_medications).toBe(1)
    expect(widgets.missed_medications).toBe(1)
    // The −25h missed row stays on the detail (a miss unaddressed this morning
    // is still today's problem); the +2h future row stays off it (not yet due
    // is not a miss).
    const missed = widgets.missed_detail as Array<{ person_name: string; resident_id: string }>
    const amara = missed.filter((row) => row.resident_id === ourPersonId)
    expect(amara.length).toBe(1)
    expect(amara[0].person_name).toContain('Amara')
    // Nobody else's resident appears.
    expect(missed.some((row) => row.person_name.includes('Foreign'))).toBe(false)
  })
})
