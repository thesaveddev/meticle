/**
 * Room check overdue — the last event type in blueprint §9.9, and the one whose
 * subject is an *absence*: a room that should have a check today and does not.
 *
 * The property being bought here is that the absence is noticed for the rooms that
 * are actually occupied, that it is noticed once and not once per sweep, and that
 * it is addressed to somebody who can do something about it. Each "not" case below is
 * a way this becomes noise or a way it misses: a room that was checked, a room with
 * nobody in it, a domiciliary service with no rooms at all, a room before the due
 * hour, and a room nobody is rostered around (which still reaches the manager through
 * Mission Control, because a room nobody was rostered for is a staffing gap too).
 *
 * The sweep is global by design — it enumerates organisations — so every assertion is
 * scoped to this test's own organisation, room or user rather than to a total.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createPerson, createShift } from '../../test/factories'
import { migrateQuery } from '../../shared/database'
import { runRoomCheckOverdueSweep, hasReachedDueHour } from './roomCheckOverdue'
import { roomCheckAggregateId } from './room-check.events'
import { registerProductionConsumers } from '../events/consumers/register'
import { getConsumers, DomainEvent } from '../events/events.consumers'
import { runWithOrgContext } from '../events/events.org-context'
import { RoomCheckOverdueNotificationConsumer } from '../events/consumers/room-check-overdue-notification.consumer'
import { MissionControlAlertConsumer } from '../events/consumers/mission-control-alert.consumer'

let app: Express
beforeAll(() => {
  app = createTestApp()
  // The production registry, so the wiring the API relies on is what this suite
  // asserts on: a consumer kept out of it would still pass a hand-rolled call and
  // fail in production.
  registerProductionConsumers()
})

/** The provider's own day, as the API will resolve it. */
async function localDay(timezone: string): Promise<string> {
  const result = await migrateQuery(
    `SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE $1, 'YYYY-MM-DD') AS day`,
    [timezone],
  )
  return result.rows[0].day
}

interface RoomFixtureOptions {
  serviceTypes?: string[]
  roomNumber?: string | null
  checkedToday?: boolean
  rosterToday?: boolean
  timezone?: string
}

/**
 * One occupied room in one provider, with a worker on shift at that location today.
 *
 * The shift spans the whole local day so it is genuinely "today" whatever hour the
 * suite runs at, and the roster is what makes the worker the audience for the nudge.
 */
async function occupiedRoomFixture(options: RoomFixtureOptions = {}) {
  const org = await createOrg({
    serviceTypes: options.serviceTypes ?? ['supported_living'],
  })
  if (options.timezone) {
    await migrateQuery(`UPDATE organizations SET timezone = $2 WHERE id = $1`, [org.id, options.timezone])
  }
  const location = await createLocation({ organizationId: org.id, name: `Ash Grove ${Math.random().toString(36).slice(2, 6)}` })
  const resident = await createPerson({
    organization_id: org.id,
    location_id: location.id,
    first_name: 'Ada',
    last_name: 'Lovelace',
    room_number: options.roomNumber === undefined ? '12' : options.roomNumber || '12',
  })
  if (options.roomNumber === null) {
    // The factory treats an empty room as "use the default", so the person with no
    // room assigned is created the only way that means anything: by clearing it.
    await migrateQuery(`UPDATE people SET room_number = NULL WHERE id = $1`, [resident.id])
  }

  const workerUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const worker = await createStaffProfile({
    userId: workerUser.id, first_name: 'Priya', last_name: 'Sharma', locationId: location.id,
  })
  const manager = await createUser({ role: 'MANAGER', organization_id: org.id })

  if (options.rosterToday !== false) {
    const shift = await createShift({
      locationId: location.id,
      start_time: new Date(Date.now() - 6 * 60 * 60_000).toISOString(),
      end_time: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      shift_type: 'day',
      status: 'filled',
    })
    await migrateQuery(
      `INSERT INTO shift_assignments (shift_id, staff_id, status) VALUES ($1,$2,'assigned')`,
      [shift.id, worker.id],
    )
  }

  if (options.checkedToday) {
    await migrateQuery(
      `INSERT INTO room_checks (organization_id, location_id, room_number, checked_by, check_date, status, cleanliness_rating, safety_rating)
       VALUES ($1,$2,$3,$4,CURRENT_DATE,'pass',5,5)`,
      [org.id, location.id, options.roomNumber || '12', worker.id],
    )
  }

  const timezone = options.timezone || 'Europe/London'
  return { org, location, resident, worker, workerUser, manager, timezone, today: await localDay(timezone) }
}

/** The room-check events raised about one room on one day. */
async function eventsForRoom(orgId: string, locationId: string, room: string, day: string) {
  const result = await migrateQuery(
    `SELECT id, event_name, aggregate_type, aggregate_id, payload FROM domain_events
      WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY created_at`,
    [orgId, roomCheckAggregateId(locationId, day, room)],
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
 * Hand a published event to the two consumers that act on it, exactly as the outbox
 * would, and wait for them to finish.
 *
 * The drain is deliberately not used here. `processOutbox()` with no organisation
 * filter — which the outbox's own suite runs — claims every tenant's pending events,
 * and a suite whose registry does not include this event type marks them published
 * with nobody to deliver them. Two suites sharing one database then race for the same
 * row, and whichever loses asserts on an effect that will never arrive. That is a
 * property of running the API suites in parallel against one database, not of the
 * sweep, and it is why this suite drives the consumers directly: what the sweep owes
 * is the event and its payload (asserted above), and what the consumers owe is the
 * message (asserted below). Registration is asserted separately, so nothing here
 * assumes a consumer exists without checking.
 */
async function deliverToConsumers(orgId: string, row: { id: string; aggregate_type: string; aggregate_id: string; payload: any }) {
  const event: DomainEvent = {
    id: row.id,
    organizationId: orgId,
    eventName: 'room_check.overdue',
    aggregateType: row.aggregate_type,
    // The aggregate is the room's key for the day — what Mission Control de-duplicates
    // on, so one empty room produces one alert rather than one per delivery.
    aggregateId: row.aggregate_id,
    payload: row.payload,
    published: true,
    status: 'published',
    publishAttempts: 0,
    eventTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  await runWithOrgContext(orgId, () => RoomCheckOverdueNotificationConsumer.handle(event))
  await runWithOrgContext(orgId, () => MissionControlAlertConsumer.handle(event))
}

describe('room check overdue', () => {
  it('raises the event for an occupied room with no check today, and tells the staff on shift', async () => {
    const f = await occupiedRoomFixture()

    // dueHour 0: the suite cannot choose the hour, so it asks for the rule with the
    // gate open. The gate itself is asserted separately below.
    const sweep = await runRoomCheckOverdueSweep({ dueHour: 0 })
    expect(sweep.failed).toBe(0)

    const events = await eventsForRoom(f.org.id, f.location.id, '12', f.today)
    expect(events).toHaveLength(1)
    expect(events[0].event_name).toBe('room_check.overdue')
    expect(events[0].aggregate_type).toBe('room_check')
    const payload = events[0].payload as any
    expect(payload.room_number).toBe('12')
    expect(payload.location_name).toBe(f.location.name)
    expect(payload.check_date).toBe(f.today)
    // The roster travels with the event: it is who is owed the nudge.
    expect(payload.rostered.map((p: any) => p.user_id)).toEqual([f.workerUser.id])
    expect(payload.rostered[0].name).toMatch(/Priya Sharma/)

    await deliverToConsumers(f.org.id, events[0] as any)

    const mine = await notificationsFor(f.workerUser.id)
    expect(mine).toHaveLength(1)
    expect(mine[0].title).toBe('Room check overdue')
    expect(mine[0].message).toMatch(/12/)
    expect(mine[0].message).toMatch(f.location.name)
    expect(mine[0].type).toBe('compliance')
    // The notification opens the page the check is recorded on.
    expect(mine[0].link).toBe('/room-checks')

    // A manager who is not on the shift is not notified directly: §10 routes this
    // row to the support worker and keeps the manager's copy in Mission Control.
    expect(await notificationsFor(f.manager.id)).toHaveLength(0)

    const alert = await migrateQuery(
      `SELECT alert_type, title, severity, link FROM mission_control_alerts
        WHERE organization_id = $1 AND alert_type = 'room_check.overdue'`,
      [f.org.id],
    )
    expect(alert.rows).toHaveLength(1)
    expect(alert.rows[0].severity).toBe('high')
    expect(alert.rows[0].title).toMatch(/Room check overdue/)
    expect(alert.rows[0].link).toBe('/room-checks')
  })

  it('has a consumer registered for each of the two audiences the event has', () => {
    // The sweep can publish all day and nothing will happen if the outbox has nobody
    // registered for the event name. This is the wiring the production registry owes,
    // asserted on its own so a missing registration fails here rather than looking
    // like a flaky delivery test.
    const names = getConsumers('room_check.overdue').map(consumer => consumer.name)
    expect(names).toContain('room-check-overdue-notification')
    expect(names).toContain('mission-control-alert')
  })

  it('says it once per room per day, however often the sweep runs', async () => {
    const f = await occupiedRoomFixture()

    await runRoomCheckOverdueSweep({ dueHour: 0 })
    const first = await eventsForRoom(f.org.id, f.location.id, '12', f.today)
    expect(first).toHaveLength(1)

    const second = await runRoomCheckOverdueSweep({ dueHour: 0 })
    const after = await eventsForRoom(f.org.id, f.location.id, '12', f.today)
    // The ledger row behind the absence is what makes the second run a no-op.
    expect(after.map(row => row.id)).toEqual(first.map(row => row.id))
    expect(second.failed).toBe(0)

    const nudged = await migrateQuery(
      `SELECT COUNT(*)::int AS n FROM room_check_nudges WHERE organization_id = $1`,
      [f.org.id],
    )
    expect(nudged.rows[0].n).toBe(1)
  })

  it('says nothing for a room that was checked today', async () => {
    const f = await occupiedRoomFixture({ checkedToday: true })

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    expect(await eventsForRoom(f.org.id, f.location.id, '12', f.today)).toHaveLength(0)
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)
  })

  it('counts a check recorded without a location as the room being checked', async () => {
    // The resident's own profile records a check against their room; before this
    // sweep existed the row carried no location at all. Refusing to count it would
    // nudge about work that was done, which is how an alert teaches people to ignore
    // it.
    const f = await occupiedRoomFixture({ checkedToday: true })
    await migrateQuery(`UPDATE room_checks SET location_id = NULL WHERE organization_id = $1`, [f.org.id])

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    expect(await eventsForRoom(f.org.id, f.location.id, '12', f.today)).toHaveLength(0)
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)
  })

  it('has no opinion about a domiciliary service, or about a room nobody sleeps in', async () => {
    const domiciliary = await occupiedRoomFixture({ serviceTypes: ['domiciliary'] })
    const roomless = await occupiedRoomFixture({ roomNumber: null, serviceTypes: ['supported_living'] })

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    // A provider with no rooms cannot have an overdue one, and an active person with
    // no room assigned is not a room. The expectation is derived from the people
    // record, so an unassigned room is not invented for them.
    expect(await eventsForRoom(domiciliary.org.id, domiciliary.location.id, '12', domiciliary.today)).toHaveLength(0)
    expect(await notificationsFor(domiciliary.workerUser.id)).toHaveLength(0)
    expect(await eventsForRoom(roomless.org.id, roomless.location.id, '', roomless.today)).toHaveLength(0)
    expect(await notificationsFor(roomless.workerUser.id)).toHaveLength(0)
  })

  it('still reaches the manager when nobody was rostered at the location', async () => {
    const f = await occupiedRoomFixture({ rosterToday: false })

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    const events = await eventsForRoom(f.org.id, f.location.id, '12', f.today)
    expect(events).toHaveLength(1)
    // Nobody to tell, so the manager's copy is the whole of the signal.
    expect((events[0].payload as any).rostered).toEqual([])
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)

    await deliverToConsumers(f.org.id, events[0] as any)
    const alert = await migrateQuery(
      `SELECT id FROM mission_control_alerts WHERE organization_id = $1 AND alert_type = 'room_check.overdue'`,
      [f.org.id],
    )
    expect(alert.rows).toHaveLength(1)
    // And still nobody in the bell: the alert is the manager's copy, not a message to
    // a worker who was not there.
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)
  })

  /**
   * The room is a room, not a string.
   *
   * The resident's room and the checked room are free text typed by two different
   * people on two different screens, so an exact comparison is wrong in both
   * directions — and both directions are silent. A check that was recorded under
   * another spelling does not clear the room, so a room that was done is reported
   * overdue; the same physical room spelled two ways is reported twice. Neither shows
   * up as an error, which is why the two failures are pinned separately here.
   */
  it('counts a check recorded under a different spelling of the same room', async () => {
    const f = await occupiedRoomFixture()
    await migrateQuery(
      `INSERT INTO room_checks (organization_id, location_id, room_number, checked_by, check_date, status)
       VALUES ($1, $2, '  Room 12 ', $3, CURRENT_DATE, 'pass')`,
      [f.org.id, f.location.id, f.worker.id],
    )

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    expect(await eventsForRoom(f.org.id, f.location.id, '12', f.today)).toHaveLength(0)
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(0)
  })

  it('does not let a check for another room clear this one', async () => {
    const f = await occupiedRoomFixture({ roomNumber: '12A' })
    await migrateQuery(
      `INSERT INTO room_checks (organization_id, location_id, room_number, checked_by, check_date, status)
       VALUES ($1, $2, '012', $3, CURRENT_DATE, 'pass')`,
      [f.org.id, f.location.id, f.worker.id],
    )

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    // The suffix is part of the room: folding it away would invent a check for 12A
    // out of one done in 12.
    const events = await eventsForRoom(f.org.id, f.location.id, '12A', f.today)
    expect(events).toHaveLength(1)
    expect((events[0].payload as any).room_number).toBe('12A')
  })

  it('reports one room once, however its two residents spell it', async () => {
    const f = await occupiedRoomFixture()
    // A second resident in the same room, who wrote it differently — and one of them
    // with the label nobody folded away before migration 156.
    await migrateQuery(
      `UPDATE people SET room_number = 'Room 12' WHERE id = $1`,
      [f.resident.id],
    )
    const second = await createPerson({
      organization_id: f.org.id,
      location_id: f.location.id,
      first_name: 'Grace',
      last_name: 'Hopper',
      room_number: '012',
    })
    expect(second.id).toBeTruthy()

    await runRoomCheckOverdueSweep({ dueHour: 0 })

    const events = await migrateQuery(
      `SELECT id, payload FROM domain_events
        WHERE organization_id = $1 AND event_name = 'room_check.overdue'`,
      [f.org.id],
    )
    expect(events.rows).toHaveLength(1)

    // Two residents, one physical room, one nudge: the staff are told about room 12
    // once, not once per spelling of it.
    await deliverToConsumers(f.org.id, events.rows[0] as any)
    expect(await notificationsFor(f.workerUser.id)).toHaveLength(1)
  })

  it('waits for the provider’s own due hour before calling a room overdue', async () => {
    // The suite cannot choose the wall clock, so the provider's own hour is read
    // from the database and the rule is asked about one hour past it — at which
    // point the room is genuinely not overdue yet, whatever time it is here.
    //
    // The timezone is picked so "one hour past the local hour" is a real hour: with
    // the clock at 23 local, +1 wraps to midnight and the assertion would be about a
    // different day's gate. The two zones below are 26 hours apart, so they cannot
    // both be at 23:00.
    const first = 'Etc/GMT-14'
    const second = 'Etc/GMT+12'
    const hourOf = async (timezone: string) => {
      const result = await migrateQuery(
        `SELECT EXTRACT(HOUR FROM (CURRENT_TIMESTAMP AT TIME ZONE $1))::int AS hour`,
        [timezone],
      )
      return Number(result.rows[0].hour)
    }
    const timezone = (await hourOf(first)) === 23 ? second : first
    const localHour = await hourOf(timezone)

    const f = await occupiedRoomFixture({ timezone })
    await runRoomCheckOverdueSweep({ dueHour: localHour + 1 })

    expect(await eventsForRoom(f.org.id, f.location.id, '12', f.today)).toHaveLength(0)

    // The rule itself, both ways round, so a gate that never opens fails too.
    expect(hasReachedDueHour(localHour, localHour + 1)).toBe(false)
    expect(hasReachedDueHour(localHour + 1, localHour)).toBe(true)
  })
})

/**
 * What the normalisation is allowed to do to a room number — the contract the whole
 * comparison rests on, asserted directly rather than only through the sweep.
 *
 * Two lists, because the failure runs in two directions: the spellings that must fold
 * into one room (or a recorded check is missed), and the distinct rooms that must not
 * (or a check is invented). The stored generated column is asserted too — a function
 * that is right but not wired to the columns would pass every case below and still
 * compare raw text.
 */
describe('room numbers are normalised conservatively', () => {
  it('folds case, surrounding and internal space, a Room/Rm label and leading zeros', async () => {
    const equivalent = ['12', ' 12 ', 'Room 12', 'room 12', 'Rm. 12', 'rm 12', '012', 'ROOM  12', 'Room-12']
    const results = await Promise.all(equivalent.map(async (value) => {
      const res = await migrateQuery(`SELECT normalize_room_number($1) AS normalized`, [value])
      return res.rows[0].normalized
    }))
    expect(new Set(results).size).toBe(1)
  })

  it('keeps rooms that are genuinely different apart', async () => {
    const distinct = ['12', '12A', '12 a', '13', '12B']
    const results = await Promise.all(distinct.map(async (value) => {
      const res = await migrateQuery(`SELECT normalize_room_number($1) AS normalized`, [value])
      return res.rows[0].normalized
    }))
    // '12 a' and '12A' are the same room written two ways; everything else stands alone.
    expect(results).toEqual(['12', '12a', '12a', '13', '12b'])
  })

  it('treats a missing room as missing rather than as a room', async () => {
    const res = await migrateQuery(`SELECT normalize_room_number(NULL) AS normalized`)
    expect(res.rows[0].normalized).toBeNull()
  })

  it('maintains the normalised columns for whatever is written', async () => {
    const org = await createOrg({ serviceTypes: ['supported_living'] })
    const location = await createLocation({ organizationId: org.id })
    const person = await createPerson({
      organization_id: org.id,
      location_id: location.id,
      first_name: 'Ada',
      last_name: 'Lovelace',
      room_number: '  Room 07B ',
    })
    const stored = await migrateQuery(`SELECT room_number_normalized FROM people WHERE id = $1`, [person.id])
    expect(stored.rows[0].room_number_normalized).toBe('7b')

    const check = await migrateQuery(
      `INSERT INTO room_checks (organization_id, location_id, room_number, check_date, status)
       VALUES ($1, $2, '07b', CURRENT_DATE, 'pass') RETURNING room_number_normalized`,
      [org.id, location.id],
    )
    expect(check.rows[0].room_number_normalized).toBe('7b')
  })
})
