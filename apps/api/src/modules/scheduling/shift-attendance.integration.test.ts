/**
 * Shift attendance and handover — the two P0 gaps in the supported-living
 * blueprint (§9.1, §9.2).
 *
 * What is being tested is not that the endpoints exist, but the properties that
 * make them evidence:
 *
 *  * attendance belongs to the person rostered on the shift, so a manager who
 *    can edit the rota still cannot clock anyone in;
 *  * a replay of an offline action is the same action, never a second one, and
 *    a replayed failure stays failed;
 *  * a handover amendment keeps the wording a colleague already read;
 *  * acknowledgement is by somebody other than the author, and is recorded once.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createShift, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express
beforeAll(() => { app = createTestApp() })

/** Two workers rostered on one shift, plus an admin who is not on it. */
async function shiftFixture() {
  const org = await createOrg()
  const location = await createLocation({ organizationId: org.id })
  const admin = await createUser({ role: 'ORG_ADMIN', organization_id: org.id })
  const onDutyUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const onDuty = await createStaffProfile({ userId: onDutyUser.id, locationId: location.id })
  const colleagueUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const colleague = await createStaffProfile({ userId: colleagueUser.id, locationId: location.id })
  const shift = await createShift({ organizationId: org.id, locationId: location.id, status: 'filled' })
  await migrateQuery(
    `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
    [shift.id, onDuty.id]
  )
  return {
    org, location, shift,
    admin, onDuty, colleague,
    adminToken: generateToken(admin),
    onDutyToken: generateToken(onDutyUser),
    colleagueToken: generateToken(colleagueUser),
  }
}

function clockOn(token: string, shiftId: string, body: Record<string, unknown> = {}) {
  return request(app).post(`/shifts/${shiftId}/clock-on`).set('Authorization', `Bearer ${token}`).send(body)
}
function clockOff(token: string, shiftId: string, body: Record<string, unknown> = {}) {
  return request(app).post(`/shifts/${shiftId}/clock-off`).set('Authorization', `Bearer ${token}`).send(body)
}
function offlineAction(token: string, shiftId: string, action: string, body: Record<string, unknown>) {
  return request(app).post(`/shifts/${shiftId}/offline/${action}`).set('Authorization', `Bearer ${token}`).send(body)
}
function attendance(token: string, shiftId: string) {
  return request(app).get(`/shifts/${shiftId}/attendance`).set('Authorization', `Bearer ${token}`)
}

describe('shift attendance', () => {
  it('opens the shift as unattended with the rostered staff listed', async () => {
    const f = await shiftFixture()
    const res = await attendance(f.onDutyToken, f.shift.id)
    expect(res.status).toBe(200)
    expect(res.body.unattended).toBe(true)
    expect(res.body.actual_start_at).toBeNull()
    expect(res.body.events).toEqual([])
    expect(res.body.rostered.map((r: any) => r.staff_id)).toContain(f.onDuty.id)

    // The client shows the clock buttons off these two fields rather than
    // guessing who is signed in, so the marking is part of the contract.
    expect(res.body.rostered.find((r: any) => r.staff_id === f.onDuty.id).is_me).toBe(true)
    const seenByColleague = await attendance(f.colleagueToken, f.shift.id)
    expect(seenByColleague.body.rostered.find((r: any) => r.staff_id === f.onDuty.id).is_me).toBe(false)
  })

  it('records a clock-on and a clock-off, and reports the worked minutes between them', async () => {
    const f = await shiftFixture()
    // Two hours ago to now, so the pairing is what the assertion measures rather
    // than how long the suite happened to take.
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const on = await clockOn(f.onDutyToken, f.shift.id, { recorded_at: startedAt, note: 'Took over from the night staff' })
    expect(on.status).toBe(201)
    expect(on.body.event.event).toBe('clock_on')
    expect(on.body.event.source).toBe('online')
    expect(on.body.shift.actual_start_at).toBeTruthy()

    const off = await clockOff(f.onDutyToken, f.shift.id, { recorded_at: new Date().toISOString() })
    expect(off.status).toBe(201)
    expect(off.body.event.event).toBe('clock_off')

    const after = await attendance(f.onDutyToken, f.shift.id)
    expect(after.body.unattended).toBe(false)
    const mine = after.body.rostered.find((r: any) => r.staff_id === f.onDuty.id)
    expect(mine.on_duty).toBe(false)
    expect(mine.clocked_on_at).toBe(startedAt)
    expect(mine.worked_minutes).toBeGreaterThanOrEqual(119)
    expect(mine.worked_minutes).toBeLessThanOrEqual(121)
    expect(after.body.events).toHaveLength(2)
  })

  it('shows a worker who has not clocked off as still on duty', async () => {
    const f = await shiftFixture()
    await clockOn(f.onDutyToken, f.shift.id)
    const res = await attendance(f.onDutyToken, f.shift.id)
    const mine = res.body.rostered.find((r: any) => r.staff_id === f.onDuty.id)
    expect(mine.on_duty).toBe(true)
    // An unfinished interval is not counted as worked time, so nothing here is
    // reported as evidence of a shift that has not ended.
    expect(mine.worked_minutes).toBe(0)
  })

  it('refuses a clock-off without a clock-on, and a second clock-on', async () => {
    const f = await shiftFixture()
    const early = await clockOff(f.onDutyToken, f.shift.id)
    expect(early.status).toBe(409)
    expect(early.body.message).toMatch(/not clocked on/i)

    await clockOn(f.onDutyToken, f.shift.id)
    const twice = await clockOn(f.onDutyToken, f.shift.id)
    expect(twice.status).toBe(409)
    expect(twice.body.message).toMatch(/already clocked on/i)
  })

  it('refuses attendance from a manager or a colleague who is not on the shift', async () => {
    const f = await shiftFixture()
    // The admin can edit the rota; they are still not the person on duty.
    const byAdmin = await clockOn(f.adminToken, f.shift.id)
    expect(byAdmin.status).toBe(403)

    const byColleague = await clockOn(f.colleagueToken, f.shift.id)
    expect(byColleague.status).toBe(403)
    expect(byColleague.body.message).toMatch(/rostered/i)

    const events = await migrateQuery('SELECT event FROM shift_attendance_events WHERE shift_id = $1', [f.shift.id])
    expect(events.rows).toEqual([])
  })

  it('refuses a recorded time in the future', async () => {
    const f = await shiftFixture()
    const res = await clockOn(f.onDutyToken, f.shift.id, {
      recorded_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/future/i)
  })
})

describe('shift attendance — the offline action key', () => {
  it('makes a replayed clock-on the same clock-on', async () => {
    const f = await shiftFixture()
    const key = `offline-${f.shift.id}-on`
    const queuedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const first = await offlineAction(f.onDutyToken, f.shift.id, 'clock-on', { action_key: key, recorded_at: queuedAt })
    expect(first.status).toBe(201)
    expect(first.body.replayed).toBe(false)
    expect(first.body.event.source).toBe('offline')

    const replay = await offlineAction(f.onDutyToken, f.shift.id, 'clock-on', { action_key: key, recorded_at: queuedAt })
    expect(replay.status).toBe(200)
    expect(replay.body.replayed).toBe(true)

    const events = await migrateQuery(
      `SELECT event, recorded_at FROM shift_attendance_events WHERE shift_id = $1 AND event = 'clock_on'`,
      [f.shift.id]
    )
    expect(events.rows).toHaveLength(1)
    // The device's clock survives the trip: the record says when the worker
    // clocked on, not when the phone found a signal.
    expect(new Date(events.rows[0].recorded_at).toISOString()).toBe(queuedAt)
  })

  it('records the two actions a queue actually sends — one on, one off', async () => {
    const f = await shiftFixture()
    await offlineAction(f.onDutyToken, f.shift.id, 'clock-on', { action_key: `q-on-${f.shift.id}` })
    await offlineAction(f.onDutyToken, f.shift.id, 'clock-off', { action_key: `q-off-${f.shift.id}` })
    await offlineAction(f.onDutyToken, f.shift.id, 'clock-off', { action_key: `q-off-${f.shift.id}` })

    const res = await attendance(f.onDutyToken, f.shift.id)
    expect(res.body.events).toHaveLength(2)
    expect(res.body.rostered.find((r: any) => r.staff_id === f.onDuty.id).on_duty).toBe(false)
  })

  it('requires a key on the offline route', async () => {
    const f = await shiftFixture()
    const res = await offlineAction(f.onDutyToken, f.shift.id, 'clock-on', {})
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/action key/i)
  })

  it('keeps a failed action failed, with the reason, rather than retrying it into existence', async () => {
    const f = await shiftFixture()
    const key = `failed-${f.shift.id}`
    // A clock-off with no clock-on behind it can never succeed.
    const first = await offlineAction(f.onDutyToken, f.shift.id, 'clock-off', { action_key: key })
    expect(first.status).toBe(409)

    const ledger = await migrateQuery(
      'SELECT status, error_message FROM shift_offline_actions WHERE action_key = $1',
      [key]
    )
    expect(ledger.rows[0].status).toBe('failed')

    const replay = await offlineAction(f.onDutyToken, f.shift.id, 'clock-off', { action_key: key })
    expect(replay.status).toBe(409)
    expect(replay.body.message).toMatch(/not clocked on/i)
  })
})

describe('shift handover', () => {
  it('records the handover and its first revision', async () => {
    const f = await shiftFixture()
    const res = await request(app)
      .post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send({
        what_happened: 'Pat had two seizures, both self-limiting. GP called, no change to medication.',
        outstanding: 'Neurology review letter is still in Pat\'s file for the GP.',
        who_is_aware: 'Duty manager and Pat\'s daughter',
      })

    expect(res.status).toBe(201)
    expect(res.body.created).toBe(true)
    expect(res.body.handover.version).toBe(1)

    const read = await request(app).get(`/shifts/${f.shift.id}/handover`).set('Authorization', `Bearer ${f.colleagueToken}`)
    expect(read.status).toBe(200)
    expect(read.body.handover.what_happened).toMatch(/two seizures/)
    expect(read.body.revisions).toHaveLength(1)
    expect(read.body.handover.acknowledgements).toEqual([])
    expect(read.body.viewer_acknowledged).toBe(false)
    // The author is not offered their own acknowledgement, which is what this
    // field is for.
    expect(read.body.viewer_is_author).toBe(false)

    const asAuthor = await request(app).get(`/shifts/${f.shift.id}/handover`).set('Authorization', `Bearer ${f.onDutyToken}`)
    expect(asAuthor.body.viewer_is_author).toBe(true)
  })

  it('keeps the wording a colleague already read when the handover is amended', async () => {
    const f = await shiftFixture()
    const post = (body: Record<string, unknown>) => request(app)
      .post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send(body)

    await post({ what_happened: 'Quiet shift. Pat ate well and went to bed at 22:00.' })
    const amended = await post({
      what_happened: 'Quiet shift. Pat ate well and went to bed at 22:00.',
      outstanding: 'Water low in the bathroom — reported to maintenance at 22:10.',
    })
    expect(amended.status).toBe(200)
    expect(amended.body.created).toBe(false)
    expect(amended.body.handover.version).toBe(2)

    const read = await request(app).get(`/shifts/${f.shift.id}/handover`).set('Authorization', `Bearer ${f.onDutyToken}`)
    expect(read.body.revisions.map((r: any) => r.version)).toEqual([2, 1])
    // The amendment is an amendment: the first wording is still there.
    expect(read.body.revisions[1].outstanding).toBeNull()
    expect(read.body.handover.outstanding).toMatch(/maintenance/)
  })

  it('accepts a handover acknowledged by a named colleague, once', async () => {
    const f = await shiftFixture()
    await request(app).post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send({ what_happened: 'Settled shift.' })

    const ack = await request(app).post(`/shifts/${f.shift.id}/handover/acknowledge`)
      .set('Authorization', `Bearer ${f.colleagueToken}`)
      .send({ note: 'Read and taken over.' })
    expect(ack.status).toBe(201)
    expect(ack.body.replayed).toBe(false)
    expect(ack.body.acknowledgement.acknowledged_by_name).toMatch(/Staff/)

    const again = await request(app).post(`/shifts/${f.shift.id}/handover/acknowledge`)
      .set('Authorization', `Bearer ${f.colleagueToken}`)
      .send({})
    expect(again.status).toBe(200)
    expect(again.body.replayed).toBe(true)

    const read = await request(app).get(`/shifts/${f.shift.id}/handover`).set('Authorization', `Bearer ${f.colleagueToken}`)
    expect(read.body.handover.acknowledgements).toHaveLength(1)
    expect(read.body.viewer_acknowledged).toBe(true)
  })

  it('refuses a handover acknowledged by its own author', async () => {
    const f = await shiftFixture()
    await request(app).post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send({ what_happened: 'Settled shift.' })

    const ack = await request(app).post(`/shifts/${f.shift.id}/handover/acknowledge`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send({})
    expect(ack.status).toBe(400)
    expect(ack.body.message).toMatch(/your own handover/i)
  })

  it('refuses a handover from someone who was not on the shift, and allows a manager', async () => {
    const f = await shiftFixture()
    const byColleague = await request(app).post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.colleagueToken}`)
      .send({ what_happened: 'Not mine to write.' })
    expect(byColleague.status).toBe(403)

    // A manager may write one when the shift had nobody to do it, and the record
    // names the manager rather than a worker who did not write it.
    const byManager = await request(app).post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.adminToken}`)
      .send({ what_happened: 'Covered by an agency worker; recorded by the duty manager.' })
    expect(byManager.status).toBe(201)
    expect(byManager.body.handover.author_id).toBe(f.admin.id)
  })

  it('requires something to have happened', async () => {
    const f = await shiftFixture()
    const res = await request(app).post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.onDutyToken}`)
      .send({ what_happened: '   ' })
    expect(res.status).toBe(400)
  })

  it('takes a handover from the offline queue once, however many times it is sent', async () => {
    const f = await shiftFixture()
    const key = `handover-${f.shift.id}`
    const body = { action_key: key, what_happened: 'Handover written on a phone with no signal.' }

    const first = await offlineAction(f.onDutyToken, f.shift.id, 'handover', body)
    expect(first.status).toBe(201)
    expect(first.body.replayed).toBe(false)

    const replay = await offlineAction(f.onDutyToken, f.shift.id, 'handover', body)
    expect(replay.status).toBe(200)
    expect(replay.body.replayed).toBe(true)

    const read = await request(app).get(`/shifts/${f.shift.id}/handover`).set('Authorization', `Bearer ${f.onDutyToken}`)
    expect(read.body.revisions).toHaveLength(1)
  })
})

describe('shift attendance and handover — tenant isolation', () => {
  it('hides another organisation\'s shift from every route', async () => {
    const mine = await shiftFixture()
    const theirs = await shiftFixture()

    for (const res of [
      await attendance(mine.onDutyToken, theirs.shift.id),
      await request(app).get(`/shifts/${theirs.shift.id}/handover`).set('Authorization', `Bearer ${mine.onDutyToken}`),
      await clockOn(mine.onDutyToken, theirs.shift.id),
      await request(app).post(`/shifts/${theirs.shift.id}/handover`)
        .set('Authorization', `Bearer ${mine.adminToken}`)
        .send({ what_happened: 'Not my shift.' }),
    ]) {
      expect(res.status).toBe(404)
    }

    const rows = await migrateQuery(
      'SELECT id FROM shift_attendance_events WHERE shift_id = $1',
      [theirs.shift.id]
    )
    expect(rows.rows).toEqual([])
  })
})
