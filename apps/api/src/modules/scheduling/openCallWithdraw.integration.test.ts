import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createShift, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/**
 * An organisation with a manager, a location they manage, and an open call that
 * a care worker can claim. Returns the tokens and ids the tests need.
 */
async function openCallWithClaimant() {
  const org = await createOrg()
  const manager = await createUser({ email: `manager-${Date.now()}@withdraw-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  await createStaffProfile({ userId: manager.id, locationId: null })
  const location = await createLocation({ organizationId: org.id, managerId: manager.id })

  const carer = await createUser({ email: `carer-${Date.now()}@withdraw-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const carerStaff = await createStaffProfile({ userId: carer.id, locationId: location.id })

  const otherCarer = await createUser({ email: `other-${Date.now()}@withdraw-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const otherStaff = await createStaffProfile({ userId: otherCarer.id, locationId: location.id })

  const shift = await createShift({
    organizationId: org.id,
    locationId: location.id,
    shiftType: 'day',
    status: 'open',
  })

  return {
    org, manager, location, shift,
    carer, carerStaff,
    otherCarer, otherStaff,
    carerToken: generateToken(carer),
    otherCarerToken: generateToken(otherCarer),
  }
}

async function claimShift(shiftId: string, token: string) {
  return request(app)
    .post(`/shifts/${shiftId}/claim`)
    .set('Authorization', `Bearer ${token}`)
    .send({})
}

async function assignmentFor(shiftId: string, staffId: string) {
  const result = await migrateQuery(
    'SELECT * FROM shift_assignments WHERE shift_id = $1 AND staff_id = $2',
    [shiftId, staffId]
  )
  return result.rows[0]
}

describe('Open call withdrawal — DELETE /shifts/:shiftId/withdraw-claim', () => {
  it('lets a care worker withdraw a claim they are still waiting on', async () => {
    const { shift, carerStaff, carerToken } = await openCallWithClaimant()
    const claim = await claimShift(shift.id, carerToken)
    expect(claim.status).toBe(201)
    expect((await assignmentFor(shift.id, carerStaff.id)).status).toBe('pending')

    const res = await request(app)
      .delete(`/shifts/${shift.id}/withdraw-claim`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')
    expect((await assignmentFor(shift.id, carerStaff.id)).status).toBe('rejected')
  }, 30_000)

  it('puts the shift back on the board once nobody is holding it', async () => {
    const { shift, carerToken } = await openCallWithClaimant()
    await claimShift(shift.id, carerToken)

    await request(app)
      .delete(`/shifts/${shift.id}/withdraw-claim`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send()

    const after = await migrateQuery('SELECT status FROM shifts WHERE id = $1', [shift.id])
    expect(after.rows[0].status).toBe('open')
  }, 30_000)

  it('refuses once a manager has approved the claim, because the worker is rostered on', async () => {
    const { shift, carerStaff, carer, carerToken } = await openCallWithClaimant()
    await claimShift(shift.id, carerToken)
    await migrateQuery("UPDATE shift_assignments SET status = 'assigned' WHERE shift_id = $1 AND staff_id = $2", [shift.id, carerStaff.id])

    const res = await request(app)
      .delete(`/shifts/${shift.id}/withdraw-claim`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send()

    expect(res.status).toBe(409)
    expect((await assignmentFor(shift.id, carerStaff.id)).status).toBe('assigned')
    expect(carer.id).toBeTruthy()
  }, 30_000)

  it('cannot be used to withdraw somebody else\u2019s claim', async () => {
    const { shift, carerStaff, carerToken, otherCarerToken } = await openCallWithClaimant()
    await claimShift(shift.id, carerToken)

    // There is no staff id in the path and none in the body, so the only claim
    // this can reach is the caller's own — which does not exist.
    const res = await request(app)
      .delete(`/shifts/${shift.id}/withdraw-claim`)
      .set('Authorization', `Bearer ${otherCarerToken}`)
      .send({ staff_id: carerStaff.id })

    expect(res.status).toBe(409)
    expect((await assignmentFor(shift.id, carerStaff.id)).status).toBe('pending')
  }, 30_000)

  it('rejects an unauthenticated withdrawal', async () => {
    const { shift, carerToken } = await openCallWithClaimant()
    await claimShift(shift.id, carerToken)

    const res = await request(app).delete(`/shifts/${shift.id}/withdraw-claim`).send()

    expect(res.status).toBe(401)
  }, 30_000)

  it('leaves a second worker\u2019s claim alone when the first withdraws', async () => {
    const { shift, carerStaff, otherStaff, carerToken } = await openCallWithClaimant()
    await claimShift(shift.id, carerToken)
    // A shift can only be claimed once through the endpoint — claiming takes it
    // off the board — so the second holder is put in place directly. What is
    // under test is the repository's arithmetic when one of two goes.
    await migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status, is_overtime)
       VALUES ($1, $2, 'pending', true)`,
      [shift.id, otherStaff.id]
    )

    await request(app)
      .delete(`/shifts/${shift.id}/withdraw-claim`)
      .set('Authorization', `Bearer ${carerToken}`)
      .send()

    expect((await assignmentFor(shift.id, carerStaff.id)).status).toBe('rejected')
    expect((await assignmentFor(shift.id, otherStaff.id)).status).toBe('pending')

    const after = await migrateQuery('SELECT status FROM shifts WHERE id = $1', [shift.id])
    expect(after.rows[0].status).not.toBe('open')
  }, 30_000)
})
