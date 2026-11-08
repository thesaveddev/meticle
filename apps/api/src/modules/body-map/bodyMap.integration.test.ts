import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createPerson, generateToken } from '../../test/factories'
import { migrateQuery } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

/**
 * A body map is how a provider evidences a bruise, pressure sore or skin tear:
 * the record is clinical, it is looked at in safeguarding and CQC reviews, and a
 * carer or manager adds to it mid-shift. It had no test file at all, so nothing
 * here was checked — not the defaults, not the role split between recording and
 * deleting, not whether an entry deleted by a manager left any trace.
 */
async function team() {
  const org = await createOrg()
  const manager = await createUser({ email: `bm-mgr-${Date.now()}-${Math.random()}@body-map-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const worker = await createUser({ email: `bm-worker-${Date.now()}-${Math.random()}@body-map-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const resident = await createPerson({ organization_id: org.id })
  return { org, manager, worker, resident }
}

function entryPayload(personId: string, overrides: Record<string, any> = {}) {
  return {
    person_id: personId,
    body_view: 'front',
    body_zone: 'left_forearm',
    zone_x: 0.32,
    zone_y: 0.48,
    condition_type: 'bruise',
    description: '4cm bruise, yellowing at the edges, no break in the skin.',
    ...overrides,
  }
}

describe('Body map', () => {
  it('records an entry with the database defaults a carer relies on', async () => {
    const { worker, resident } = await team()
    const res = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(resident.id))

    expect(res.status).toBe(201)
    expect(res.body.person_id).toBe(resident.id)
    expect(res.body.condition_type).toBe('bruise')
    expect(res.body.description).toBe('4cm bruise, yellowing at the edges, no break in the skin.')
    // A carer picks the zone and the condition; everything else is the record's
    // own default, and a condition recorded without a severity must not land as
    // null (it is the field the dashboard counts on).
    expect(res.body.severity).toBe('mild')
    expect(res.body.status).toBe('active')
    expect(res.body.recorded_date).toBeTruthy()
    expect(res.body.created_by).toBe(worker.id)
  })

  it('writes an audit row for the record it creates', async () => {
    const { worker, resident } = await team()
    const res = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(resident.id))

    const audits = await migrateQuery(
      `SELECT user_id, action, new_data FROM audit_logs
       WHERE entity_type = 'body_map_entry' AND entity_id = $1`,
      [res.body.id],
    )
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].user_id).toBe(worker.id)
    expect(audits.rows[0].action).toBe('create')
    expect(audits.rows[0].new_data).toMatchObject({
      person_id: resident.id,
      body_zone: 'left_forearm',
      condition_type: 'bruise',
    })
    // The narrative is not duplicated into the audit log, where it would be a
    // second plaintext copy of a clinical record.
    expect(audits.rows[0].new_data).not.toHaveProperty('description')
  })

  it('rejects a malformed entry instead of storing it', async () => {
    const { worker, resident } = await team()
    const token = generateToken(worker)

    const badCondition = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id, { condition_type: 'sunburn' }))
    expect(badCondition.status).toBe(400)

    const badView = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id, { body_view: 'side' }))
    expect(badView.status).toBe(400)

    const noPerson = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${token}`)
      .send({ body_view: 'front', body_zone: 'neck', condition_type: 'rash' })
    expect(noPerson.status).toBe(400)
  })

  it('refuses to record against a resident in another organisation', async () => {
    const { worker } = await team()
    const otherOrg = await createOrg()
    const outsider = await createPerson({ organization_id: otherOrg.id })

    const res = await request(app)
      .post('/body-map')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(outsider.id))

    expect(res.status).toBe(404)
    const rows = await migrateQuery('SELECT id FROM body_map_entries WHERE person_id = $1', [outsider.id])
    expect(rows.rows).toHaveLength(0)
  })

  it('lists every entry, only the active ones, and a bounded history', async () => {
    const { manager, resident } = await team()
    const token = generateToken(manager)

    const first = await request(app).post('/body-map').set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id, { body_zone: 'left_knee', condition_type: 'rash' }))
    const second = await request(app).post('/body-map').set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id, { body_zone: 'right_heel', condition_type: 'pressure_sore' }))
    const third = await request(app).post('/body-map').set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id, { body_zone: 'left_elbow', condition_type: 'skin_tear' }))

    expect([first.status, second.status, third.status]).toEqual([201, 201, 201])

    // The oldest one is resolved, so it belongs in the history and not on the
    // active body a carer is looking at.
    const resolved = await request(app)
      .patch(`/body-map/${first.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', resolved_date: '2026-09-20' })
    expect(resolved.status).toBe(200)
    expect(resolved.body.status).toBe('resolved')

    const all = await request(app).get(`/body-map/person/${resident.id}`).set('Authorization', `Bearer ${token}`)
    expect(all.status).toBe(200)
    expect(all.body).toHaveLength(3)

    const active = await request(app).get(`/body-map/person/${resident.id}/active`).set('Authorization', `Bearer ${token}`)
    expect(active.status).toBe(200)
    expect(active.body.map((e: any) => e.body_zone).sort()).toEqual(['left_elbow', 'right_heel'])

    const history = await request(app).get(`/body-map/person/${resident.id}/history?limit=1`).set('Authorization', `Bearer ${token}`)
    expect(history.status).toBe(200)
    expect(history.body).toHaveLength(1)

    const stats = await request(app).get(`/body-map/person/${resident.id}/stats`).set('Authorization', `Bearer ${token}`)
    expect(stats.status).toBe(200)
    expect(stats.body).toMatchObject({ active_count: 2, healing_count: 0, resolved_count: 1, total_count: 3 })
  })

  it('reads a single entry and refuses one from another organisation', async () => {
    const { worker, resident } = await team()
    const created = await request(app).post('/body-map').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(resident.id))

    const res = await request(app).get(`/body-map/${created.body.id}`).set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(created.body.id)

    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `bm-outsider-${Date.now()}-${Math.random()}@body-map-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: otherOrg.id })
    const denied = await request(app).get(`/body-map/${created.body.id}`).set('Authorization', `Bearer ${generateToken(outsider)}`)
    expect(denied.status).toBe(404)
  })

  it('updates an entry, and answers 404 for one that does not exist', async () => {
    const { worker, resident } = await team()
    const token = generateToken(worker)
    const created = await request(app).post('/body-map').set('Authorization', `Bearer ${token}`)
      .send(entryPayload(resident.id))

    const updated = await request(app)
      .patch(`/body-map/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ severity: 'severe', description: 'Spread overnight; district nurse informed.' })
    expect(updated.status).toBe(200)
    expect(updated.body.severity).toBe('severe')
    expect(updated.body.description).toBe('Spread overnight; district nurse informed.')

    const missing = await request(app)
      .patch('/body-map/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ severity: 'mild' })
    expect(missing.status).toBe(404)

    const audits = await migrateQuery(
      `SELECT action, old_data, new_data FROM audit_logs
       WHERE entity_type = 'body_map_entry' AND entity_id = $1 AND action = 'update'`,
      [created.body.id],
    )
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].old_data).toMatchObject({ severity: 'mild' })
    expect(audits.rows[0].new_data).toMatchObject({ severity: 'severe' })
  })

  it('lets a manager delete an entry and leaves an audit row behind', async () => {
    const { worker, manager, resident } = await team()
    const created = await request(app).post('/body-map').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(resident.id))

    const res = await request(app)
      .delete(`/body-map/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(manager)}`)
    expect(res.status).toBe(204)

    const gone = await migrateQuery('SELECT id FROM body_map_entries WHERE id = $1', [created.body.id])
    expect(gone.rows).toHaveLength(0)

    const audits = await migrateQuery(
      `SELECT user_id, action, old_data FROM audit_logs
       WHERE entity_type = 'body_map_entry' AND entity_id = $1 AND action = 'delete'`,
      [created.body.id],
    )
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].user_id).toBe(manager.id)
    expect(audits.rows[0].old_data).toMatchObject({ person_id: resident.id, body_zone: 'left_forearm' })
  })

  it('keeps deletion with managers and admins, not the carer who recorded it', async () => {
    const { worker, resident } = await team()
    const created = await request(app).post('/body-map').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send(entryPayload(resident.id))

    const res = await request(app)
      .delete(`/body-map/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
    expect(res.status).toBe(403)

    const stillThere = await migrateQuery('SELECT id FROM body_map_entries WHERE id = $1', [created.body.id])
    expect(stillThere.rows).toHaveLength(1)
  })

  it('requires authentication', async () => {
    const { resident } = await team()
    expect((await request(app).get(`/body-map/person/${resident.id}`)).status).toBe(401)
    expect((await request(app).post('/body-map').send(entryPayload(resident.id))).status).toBe(401)
  })
})
