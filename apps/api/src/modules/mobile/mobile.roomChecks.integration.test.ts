/**
 * The phone's room-check board: the rooms a worker can clear tonight, and the check
 * that clears them.
 *
 * The property bought here is that the phone and the overdue nudge are looking at the
 * same rooms. The sweep tells a worker "12 at Ash Grove has no room check recorded
 * today"; this board has to name that room, in a spelling the POST will accept, and
 * then stop calling it outstanding once the check is recorded from the phone. A screen
 * that shows a room the server will not record, or keeps showing one it has already
 * recorded, is the failure mode.
 *
 * The POST is the room-checks route itself — the phone sends JSON, not multipart — so
 * this suite is also what proves a photo-less check from a device is accepted: the
 * upload middleware runs on that route, and a worker whose only device is their phone
 * must not be the one who finds out that it does not.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createPerson, createShift, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

let app: Express
beforeAll(() => {
  app = createTestApp()
}, 30_000)

interface BoardFixtureOptions {
  serviceTypes?: string[]
  checkedToday?: boolean
  rosterToday?: boolean
}

/**
 * One occupied room, its resident, and the worker who would check it.
 *
 * The shift spans the whole of today so "rostered today" holds whatever hour the suite
 * runs at, which is what scopes the board to the rooms the worker can walk to.
 */
async function boardFixture(options: BoardFixtureOptions = {}) {
  const org = await createOrg({ serviceTypes: options.serviceTypes ?? ['supported_living'] })
  const location = await createLocation({ organizationId: org.id, name: `Ash Grove ${Math.random().toString(36).slice(2, 6)}` })
  const resident = await createPerson({
    organization_id: org.id,
    location_id: location.id,
    first_name: 'Ada',
    last_name: 'Lovelace',
    room_number: '12',
  })

  const workerUser = await createUser({ role: 'CARE_WORKER', organization_id: org.id })
  const worker = await createStaffProfile({
    userId: workerUser.id, first_name: 'Priya', last_name: 'Sharma', locationId: location.id,
  })
  const workerToken = generateToken(workerUser)

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
       VALUES ($1,$2,'12',$3,CURRENT_DATE,'pass',5,5)`,
      [org.id, location.id, worker.id],
    )
  }

  return { org, location, resident, worker, workerUser, workerToken }
}

describe('mobile room-check board', () => {
  it('lists the occupied room as outstanding, with the sweep\'s own due hour', async () => {
    const { resident, workerToken } = await boardFixture()

    const res = await request(app)
      .get('/mobile/room-checks/today')
      .set('Authorization', `Bearer ${workerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.applicable).toBe(true)
    expect(res.body.due_hour).toBe(18)
    expect(typeof res.body.due).toBe('boolean')
    expect(res.body.outstanding).toBe(1)

    const room = res.body.rooms.find((r: any) => r.room_number === '12')
    expect(room).toBeDefined()
    expect(room.room_key).toBe('12')
    expect(room.checked_at).toBeNull()
    expect(room.checked_by_name).toBeNull()
    expect(room.location_name).toBeTruthy()
    // The resident the room belongs to is who the check is for, and the room came from
    // that resident's own record rather than a room list of its own.
    expect(resident.room_number).toBe('12')
  })

  it('keeps a checked room on the board and stops counting it as outstanding', async () => {
    const { workerToken } = await boardFixture({ checkedToday: true })

    const res = await request(app)
      .get('/mobile/room-checks/today')
      .set('Authorization', `Bearer ${workerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.outstanding).toBe(0)
    const room = res.body.rooms.find((r: any) => r.room_number === '12')
    expect(room.checked_at).toBeTruthy()
    expect(room.checked_by_name).toContain('Priya')
    expect(room.status).toBe('pass')
  })

  it('clears the room when the worker records the check from the phone', async () => {
    const { workerToken } = await boardFixture()

    // JSON, not multipart: this is what the app sends.
    const created = await request(app)
      .post('/room-checks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ room_number: '12', status: 'needs_attention', cleanliness_rating: 3, safety_rating: 4, notes: 'Window catch loose' })

    expect(created.status).toBe(201)
    expect(created.body.room_number).toBe('12')
    // The check is attributed to the signed-in worker rather than to the request body.
    expect(created.body.checked_by).toBeTruthy()

    const after = await request(app)
      .get('/mobile/room-checks/today')
      .set('Authorization', `Bearer ${workerToken}`)

    expect(after.status).toBe(200)
    expect(after.body.outstanding).toBe(0)
    const room = after.body.rooms.find((r: any) => r.room_number === '12')
    expect(room.checked_at).toBeTruthy()
    expect(room.status).toBe('needs_attention')
  })

  it('answers an unrostered worker with the whole provider rather than nothing', async () => {
    // A worker covering a shift they were not assigned to must still be able to clear a
    // room; the alternative is a board that says there is nothing to do while the
    // manager's copy says a room is overdue.
    const { workerToken } = await boardFixture({ rosterToday: false })

    const res = await request(app)
      .get('/mobile/room-checks/today')
      .set('Authorization', `Bearer ${workerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.applicable).toBe(true)
    expect(res.body.rooms.some((r: any) => r.room_number === '12')).toBe(true)
  })

  it('tells a domiciliary provider the board does not apply, instead of failing', async () => {
    const { workerToken } = await boardFixture({ serviceTypes: ['domiciliary'] })

    const res = await request(app)
      .get('/mobile/room-checks/today')
      .set('Authorization', `Bearer ${workerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.applicable).toBe(false)
    expect(res.body.rooms).toEqual([])
    expect(res.body.outstanding).toBe(0)
  })

  it('rejects an unauthenticated call', async () => {
    const res = await request(app).get('/mobile/room-checks/today')
    expect(res.status).toBe(401)
  })
})
