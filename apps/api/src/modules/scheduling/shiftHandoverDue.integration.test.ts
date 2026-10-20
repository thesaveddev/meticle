/**
 * Handover due at shift end — the last open event type in blueprint §9.9.
 *
 * What is tested is the state of the world the nudge exists for: a shift whose rota
 * end time has passed, with staff on it, and no handover recorded. The sweep has to
 * find that and raise `shift.handover_due`; the production consumers have to turn it
 * into a notification for each of those staff, carrying the link to the shift, and a
 * Mission Control alert for the manager; and the whole thing has to happen exactly
 * once per shift.
 *
 * The cases that are *not* nudges matter as much as the case that is, because each of
 * them is a way this becomes noise: a shift that has not ended yet, a shift that
 * ended a moment ago and whose worker is still finishing up, a shift that ended with
 * a handover already written, and a shift that ended with nobody rostered to write
 * one — that last one has no audience at all, and is the unfilled-shift family's
 * business.
 *
 * The sweep is global by design (it enumerates organisations), so every assertion
 * below is scoped to this test's own shift, user or organisation rather than to a
 * total.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createShift, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { runHandoverDueSweep } from './shiftHandoverDue'
import { registerProductionConsumers } from '../events/consumers/register'
import { processOutbox } from '../events/events.outbox'

let app: Express
beforeAll(() => {
  app = createTestApp()
  // Registered before any event is published, as the API does before
  // `EventWorker.start()`: the app under test drains the outbox on its own timer, and
  // an event published while the registry is empty is marked published with nobody
  // to deliver it, permanently. Registering per-delivery left that window open.
  registerProductionConsumers()
})

/**
 * A shift that ended `endsMinutesAgo` ago with one worker rostered on it.
 *
 * `assign: false` leaves the shift with nobody on it, which is the case with no
 * audience.
 */
async function endedShiftFixture(options: { endsMinutesAgo?: number; assign?: boolean } = {}) {
  const org = await createOrg()
  const location = await createLocation({ organizationId: org.id, name: 'Ash Grove' })
  const workerUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const worker = await createStaffProfile({
    userId: workerUser.id, first_name: 'Priya', last_name: 'Sharma', locationId: location.id,
  })
  const manager = await createUser({ role: 'MANAGER', organization_id: org.id })

  const end = new Date(Date.now() - (options.endsMinutesAgo ?? 60) * 60_000)
  const start = new Date(end.getTime() - 8 * 60 * 60_000)
  const shift = await createShift({
    organizationId: org.id,
    locationId: location.id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    shift_type: 'day',
    status: 'filled',
  })

  if (options.assign !== false) {
    await migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
      [shift.id, worker.id],
    )
  }

  return {
    org, location, shift, worker, workerUser, manager,
    startDay: start.toISOString().slice(0, 10),
    workerToken: generateToken(workerUser),
  }
}

/** The events raised about one shift. */
async function eventsFor(shiftId: string) {
  const result = await migrateQuery(
    `SELECT id, event_name, aggregate_type, payload FROM domain_events WHERE aggregate_id = $1 ORDER BY created_at`,
    [shiftId],
  )
  return result.rows
}

async function notificationsFor(userId: string) {
  const result = await migrateQuery(
    `SELECT title, message, type, link FROM notifications WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  )
  return result.rows
}

/**
 * Drain the outbox for one organisation on top of whatever the app's own worker has
 * already done. Consumers are registered in `beforeAll`, so this cannot race the
 * worker into a delivery with nobody listening.
 */
async function deliver(orgId: string) {
  return processOutbox(orgId)
}

describe('handover due at shift end', () => {
  it('raises the event for a shift that ended with no handover, and tells the staff on it', async () => {
    const f = await endedShiftFixture({ endsMinutesAgo: 60 })

    const sweep = await runHandoverDueSweep()
    expect(sweep.published).toBeGreaterThanOrEqual(1)
    expect(sweep.failed).toBe(0)

    const events = await eventsFor(f.shift.id)
    expect(events).toHaveLength(1)
    expect(events[0].event_name).toBe('shift.handover_due')
    expect(events[0].aggregate_type).toBe('shift')
    const payload = events[0].payload as any
    expect(payload.location_name).toBe('Ash Grove')
    expect(payload.shift_type).toBe('day')
    // The roster travels with the event: it is who is owed the nudge.
    expect(payload.rostered.map((p: any) => p.user_id)).toEqual([f.workerUser.id])
    expect(payload.rostered[0].name).toMatch(/Priya Sharma/)
    // The week is the rota grid's own opening day, which is how the link finds it.
    expect(payload.week).toBe(f.startDay)

    // Through the real outbox, with the production consumers registered. The app's
    // worker may have drained the event first, so what is asserted is that nobody was
    // dropped for want of a consumer — the notifications below are the effect.
    const stats = await deliver(f.org.id)
    expect(stats.noConsumers).toBe(0)

    const mine = await notificationsFor(f.workerUser.id)
    expect(mine).toHaveLength(1)
    expect(mine[0].title).toBe('Handover due at shift end')
    expect(mine[0].message).toMatch(/ended at/)
    expect(mine[0].message).toMatch(/no handover recorded/)
    // The notification opens the shift it is about, on the week it belongs to.
    expect(mine[0].link).toBe(`/scheduling?week=${f.startDay}&shift=${f.shift.id}`)
    // A shift notification, so the worker's own preferences apply to it.
    expect(mine[0].type).toBe('shift')

    // The manager is not told by this consumer: §10 routes the row to the worker on
    // the shift, and a manager who is not on it is not the person owed a handover.
    expect(await notificationsFor(f.manager.id)).toHaveLength(0)

    // Mission Control keeps the manager-facing copy, on the same shift.
    const alert = await migrateQuery(
      `SELECT alert_type, title, severity, link FROM mission_control_alerts
       WHERE aggregate_id = $1 AND alert_type = 'shift.handover_due'`,
      [f.shift.id],
    )
    expect(alert.rows).toHaveLength(1)
    expect(alert.rows[0].severity).toBe('high')
    expect(alert.rows[0].title).toMatch(/Handover missing/)
    expect(alert.rows[0].link).toBe(`/scheduling?week=${f.startDay}&shift=${f.shift.id}`)
  })

  it('nudges once per shift, however often the sweep runs', async () => {
    const f = await endedShiftFixture({ endsMinutesAgo: 60 })

    await runHandoverDueSweep()
    const first = await eventsFor(f.shift.id)
    expect(first).toHaveLength(1)

    const second = await runHandoverDueSweep()
    const after = await eventsFor(f.shift.id)
    // The marker on the shift is what makes the second run a no-op.
    expect(after.map((row) => row.id)).toEqual(first.map((row) => row.id))
    expect(second.failed).toBe(0)

    const marked = await migrateQuery('SELECT handover_due_notified_at FROM shifts WHERE id = $1', [f.shift.id])
    expect(marked.rows[0].handover_due_notified_at).toBeTruthy()
  })

  it('says nothing for a shift whose handover was already recorded', async () => {
    const f = await endedShiftFixture({ endsMinutesAgo: 60 })

    const written = await request(app)
      .post(`/shifts/${f.shift.id}/handover`)
      .set('Authorization', `Bearer ${f.workerToken}`)
      .send({ what_happened: 'Quiet shift. Pat ate well and went to bed at 22:00.' })
    expect(written.status).toBe(201)

    await runHandoverDueSweep()

    expect(await eventsFor(f.shift.id)).toHaveLength(0)
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)
  })

  it('leaves a shift alone until the grace period has passed, and until it has ended', async () => {
    // The worker is still on site: the rota says the shift ended ten minutes ago.
    const finishingUp = await endedShiftFixture({ endsMinutesAgo: 10 })
    // And a shift that has not ended at all.
    const org = await createOrg()
    const location = await createLocation({ organizationId: org.id })
    const futureShift = await createShift({
      organizationId: org.id,
      locationId: location.id,
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      status: 'filled',
    })

    await runHandoverDueSweep()

    expect(await eventsFor(finishingUp.shift.id)).toHaveLength(0)
    expect(await eventsFor(futureShift.id)).toHaveLength(0)
    expect(await notificationsFor(finishingUp.workerUser.id)).toHaveLength(0)
  })

  it('says nothing about a shift that ended with nobody rostered on it', async () => {
    const f = await endedShiftFixture({ endsMinutesAgo: 60, assign: false })

    await runHandoverDueSweep()

    // Nobody to hand over to and nobody to tell: an unstaffed shift is the
    // `shift.unfilled` family's business, raised before it ever started.
    expect(await eventsFor(f.shift.id)).toHaveLength(0)
  })

  it('does not raise it for a cancelled shift that ran past its end time', async () => {
    const f = await endedShiftFixture({ endsMinutesAgo: 60 })
    await migrateQuery(`UPDATE shifts SET status = 'cancelled' WHERE id = $1`, [f.shift.id])

    await runHandoverDueSweep()

    expect(await eventsFor(f.shift.id)).toHaveLength(0)
  })

  it('leaves a shift that ended longer ago than the lookback alone', async () => {
    // Three days ago: a nudge now would be about work nobody can still do, and the
    // first run after a deploy must not raise one for every historical shift.
    const f = await endedShiftFixture({ endsMinutesAgo: 3 * 24 * 60 })

    await runHandoverDueSweep()

    expect(await eventsFor(f.shift.id)).toHaveLength(0)
  })
})
