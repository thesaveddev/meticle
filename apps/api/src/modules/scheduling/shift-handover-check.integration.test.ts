/**
 * Shift handover list and senior check — the contract behind the Shift
 * handovers page.
 *
 * A handover is filed as to-check until a manager or admin verifies the
 * current wording. The check is a stamp (who, when), not a second record, and
 * it is never the author's own acknowledgement under another name: the route
 * is role-gated, and re-checking refreshes rather than duplicating.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createShift, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express
beforeAll(() => { app = createTestApp() })

async function handoverFixture() {
  const org = await createOrg()
  const location = await createLocation({ organizationId: org.id })
  const admin = await createUser({ role: 'ORG_ADMIN', organization_id: org.id })
  const onDutyUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const onDuty = await createStaffProfile({ userId: onDutyUser.id, locationId: location.id })
  const shift = await createShift({ organizationId: org.id, locationId: location.id, status: 'filled' })
  await migrateQuery(
    `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
    [shift.id, onDuty.id]
  )
  const recorded = await request(app)
    .post(`/shifts/${shift.id}/handover`)
    .set('Authorization', `Bearer ${generateToken(onDutyUser)}`)
    .send({ what_happened: 'Quiet night. Everyone slept well.' })
  expect(recorded.status).toBe(201)
  return { org, location, shift, admin, adminToken: generateToken(admin), workerToken: generateToken(onDutyUser) }
}

describe('shift handover senior check', () => {
  it('lists the recorded handover as unchecked with its shift and author', async () => {
    const f = await handoverFixture()
    const res = await request(app)
      .get('/shifts/handovers')
      .set('Authorization', `Bearer ${f.adminToken}`)
    expect(res.status).toBe(200)
    const row = (res.body as any[]).find((h: any) => h.shift_id === f.shift.id)
    expect(row).toBeDefined()
    expect(row.author_name).toBeTruthy()
    expect(row.location_id).toBe(f.location.id)
    expect(row.checked_at).toBeNull()
    expect(row.acknowledgement_count).toBe(0)
  })

  it('lets a manager check the handover, and shows the stamp on the list', async () => {
    const f = await handoverFixture()
    const checked = await request(app)
      .post(`/shifts/${f.shift.id}/handover/check`)
      .set('Authorization', `Bearer ${f.adminToken}`)
    expect(checked.status).toBe(200)
    expect(checked.body.checked_by).toBe(f.admin.id)
    expect(checked.body.checked_at).toBeTruthy()

    const res = await request(app)
      .get('/shifts/handovers')
      .set('Authorization', `Bearer ${f.adminToken}`)
    const row = (res.body as any[]).find((h: any) => h.shift_id === f.shift.id)
    expect(row.checked_at).toBeTruthy()
    expect(row.checked_by).toBe(f.admin.id)
  })

  it('refreshes rather than duplicates a second check', async () => {
    const f = await handoverFixture()
    const first = await request(app).post(`/shifts/${f.shift.id}/handover/check`).set('Authorization', `Bearer ${f.adminToken}`)
    const second = await request(app).post(`/shifts/${f.shift.id}/handover/check`).set('Authorization', `Bearer ${f.adminToken}`)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
  })

  it('refuses a check from a care worker', async () => {
    const f = await handoverFixture()
    const res = await request(app)
      .post(`/shifts/${f.shift.id}/handover/check`)
      .set('Authorization', `Bearer ${f.workerToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when there is no handover to check', async () => {
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const admin = await createUser({ role: 'ORG_ADMIN', organization_id: org.id })
    const shift = await createShift({ organizationId: org.id, locationId: location.id, status: 'open' })
    const res = await request(app)
      .post(`/shifts/${shift.id}/handover/check`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(404)
  })

  it('scopes the list to the requested location', async () => {
    const f = await handoverFixture()
    const otherLocation = await createLocation({ organizationId: f.org.id })
    const res = await request(app)
      .get(`/shifts/handovers?locationId=${otherLocation.id}`)
      .set('Authorization', `Bearer ${f.adminToken}`)
    expect(res.status).toBe(200)
    expect((res.body as any[]).find((h: any) => h.shift_id === f.shift.id)).toBeUndefined()
  })
})
