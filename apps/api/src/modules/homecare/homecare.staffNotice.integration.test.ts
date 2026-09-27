/**
 * Recording that a worker was shown the staff location notice.
 *
 * The notice is only a control if there is a record that it was shown. Without
 * one, an employer asked to evidence that their staff were told what location
 * collection involves has nothing to show, and a new starter on a shared device
 * would have been told nothing at all.
 *
 * The properties that matter are per-user and per-version. A single org-wide
 * "shown" flag would be satisfied by the first person to open the app and
 * wrong for everyone else, and a boolean rather than a version would mean a
 * worker who accepted last year's wording counts as having accepted this
 * year's.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { migrateQuery, query } from '../../shared/database'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express
beforeAll(() => { app = createTestApp() })

const KEY = 'staff_location'

async function twoCarers() {
  const stamp = Date.now() + Math.random()
  const org = await createOrg()
  const a = await createUser({ email: `notice-a-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  const b = await createUser({ email: `notice-b-${stamp}@test.com`, role: 'CARE_WORKER', organization_id: org.id })
  return { a, aToken: generateToken(a), b, bToken: generateToken(b) }
}

describe('staff privacy notices', () => {
  it('reports no acknowledgement for a worker who has not read one', async () => {
    const { a, aToken } = await twoCarers()
    const res = await request(app).get(`/homecare/staff-notices/${KEY}`).set('Authorization', `Bearer ${aToken}`)
    expect(res.status).toBe(200)
    expect(res.body.notice_key).toBeNull()
    expect(res.body.notice_version).toBeNull()
  })

  it('records the acknowledgement with the version and the time', async () => {
    const { a, aToken } = await twoCarers()
    const res = await request(app)
      .post('/homecare/staff-notices')
      .set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0', app_version: '1.2.3' })
    expect(res.status).toBe(201)

    const after = await request(app).get(`/homecare/staff-notices/${KEY}`).set('Authorization', `Bearer ${aToken}`)
    expect(after.body.notice_version).toBe('1.0')
    expect(after.body.app_version).toBe('1.2.3')
    expect(after.body.notice_accepted_at).toBeTruthy()
  })

  it('does not let one worker satisfy another\'s acknowledgement', async () => {
    // The failure this prevents: one carer opens the app, and an employer's
    // evidence that their whole team was told becomes one row.
    const { a, aToken, bToken } = await twoCarers()
    await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0' })

    const bRes = await request(app).get(`/homecare/staff-notices/${KEY}`).set('Authorization', `Bearer ${bToken}`)
    expect(bRes.body.notice_version).toBeNull()
  })

  it('keeps both versions when the notice is revised', async () => {
    const { a, aToken } = await twoCarers()
    await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0' })
    await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '2.0' })

    // The newest is what the app compares against, so a revised notice is
    // re-shown rather than treated as already read.
    const res = await request(app).get(`/homecare/staff-notices/${KEY}`).set('Authorization', `Bearer ${aToken}`)
    expect(res.body.notice_version).toBe('2.0')

    const rows = await migrateQuery(
      'SELECT notice_version FROM staff_data_notices WHERE user_id = $1 AND notice_key = $2 ORDER BY notice_version',
      [a.id, KEY],
    )
    expect(rows.rows.map((r: any) => r.notice_version)).toEqual(['1.0', '2.0'])
  })

  it('is idempotent, so a retry on a bad connection is not a second acceptance', async () => {
    const { a, aToken } = await twoCarers()
    const send = () => request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0' })
    await send()
    await send()
    await send()

    const rows = await migrateQuery(
      'SELECT COUNT(*)::int AS n FROM staff_data_notices WHERE user_id = $1 AND notice_key = $2',
      [a.id, KEY],
    )
    // Two evidence rows for one person would read as two separate
    // acknowledgements, which is not what happened.
    expect(rows.rows[0].n).toBe(1)
  })

  it('rejects an acknowledgement with no version', async () => {
    const { aToken } = await twoCarers()
    const res = await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY })
    expect(res.status).toBe(400)
  })

  it('requires a signed-in worker', async () => {
    const res = await request(app).post('/homecare/staff-notices').send({ notice_key: KEY, notice_version: '1.0' })
    expect(res.status).toBe(401)
  })

  it('writes to the signed-in worker only, never to a chosen user id', async () => {
    // The body carries no user_id at all. A version that let the client name
    // the row would let one worker mark the whole team as having been told.
    const { a, aToken, b } = await twoCarers()
    await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0', user_id: b.id })

    const rows = await query('SELECT user_id FROM staff_data_notices WHERE notice_key = $1 AND notice_version = $2', [KEY, '1.0'])
    expect(rows.rows.every((r: any) => r.user_id === a.id)).toBe(true)
  })

  it('audits the read, with a real row id and without claiming consent', async () => {
    const { a, aToken } = await twoCarers()
    await request(app).post('/homecare/staff-notices').set('Authorization', `Bearer ${aToken}`)
      .send({ notice_key: KEY, notice_version: '1.0', app_version: '1.2.3' })

    const noticeRow = await migrateQuery(
      'SELECT id FROM staff_data_notices WHERE user_id = $1 AND notice_key = $2',
      [a.id, KEY],
    )
    const audit = await migrateQuery(
      `SELECT action, entity_type, new_data FROM audit_logs
        WHERE entity_type = 'staff_data_notice' AND entity_id = $1::uuid
        ORDER BY created_at DESC LIMIT 1`,
      [noticeRow.rows[0].id],
    )
    // The audit row has to exist at all. audit() swallows its own errors, so an
    // entity_id that Postgres rejects produces silence rather than a failure —
    // which is exactly how an evidence trail disappears without anyone noticing.
    expect(audit.rows.length).toBe(1)
    // "read", not "consented". A processor cannot consent on a worker's behalf,
    // and an audit trail implying it could would be relied on by the wrong people.
    expect(audit.rows[0].action).toBe('read')
    expect(JSON.stringify(audit.rows[0].new_data)).not.toMatch(/consent/i)
  })
})
