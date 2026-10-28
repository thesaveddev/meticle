import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createPerson, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

const STAFF_CONFIG = {
  name: 'Managers list',
  dataset: 'staff',
  columns: ['first_name', 'last_name', 'role'],
  filters: [{ field: 'role', op: 'eq', value: 'MANAGER' }],
  sort_by: 'last_name',
  sort_dir: 'asc',
  row_limit: 100,
  chart_type: 'table',
}

describe('Reporting — custom report builder', () => {
  it('should expose dataset metadata for the builder', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `cb-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const token = generateToken(mgr)

    const res = await request(app).get('/reporting/custom/datasets').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const ids = res.body.datasets.map((d: { id: string }) => d.id)
    for (const expected of ['staff', 'people', 'incidents', 'leave', 'shifts', 'training', 'compliance', 'tasks']) {
      expect(ids).toContain(expected)
    }
    const staff = res.body.datasets.find((d: { id: string }) => d.id === 'staff')
    expect(staff.columns.length).toBeGreaterThan(0)
    expect(staff.columns[0]).toHaveProperty('key')
    expect(staff.columns[0]).toHaveProperty('type')
  })

  it('should run an ad-hoc report against live data', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `cb-run-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ user_id: mgr.id, first_name: 'Mara', last_name: 'Manager' })
    const token = generateToken(mgr)

    const res = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: STAFF_CONFIG })
    expect(res.status).toBe(200)
    expect(res.body.table.columns.map((c: { key: string }) => c.key)).toEqual(['first_name', 'last_name', 'role'])
    expect(res.body.table.rows.length).toBeGreaterThanOrEqual(1)
    expect(res.body.table.rows.every((r: any) => r.role === 'MANAGER')).toBe(true)
    expect(res.body.summary.cards[0].label).toBe('Records')
  })

  it('should group with aggregation and reject unknown references', async () => {
    const org = await createOrg()
    const mgr = await createUser({ email: `cb-grp-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ user_id: mgr.id, first_name: 'Greg', last_name: 'Group' })
    const token = generateToken(mgr)

    const grouped = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { name: 'By role', dataset: 'staff', columns: ['role'], group_by: 'role', sort_by: 'records', sort_dir: 'desc', row_limit: 100, chart_type: 'bar' } })
    expect(grouped.status).toBe(200)
    expect(grouped.body.table.columns.map((c: { key: string }) => c.key)).toEqual(['role', 'records'])
    expect(grouped.body.series.length).toBeGreaterThanOrEqual(1)

    const badDataset = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { ...STAFF_CONFIG, dataset: 'users' } })
    expect(badDataset.status).toBe(400)

    const badColumn = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { ...STAFF_CONFIG, columns: ['password_hash'] } })
    expect(badColumn.status).toBe(400)

    const injection = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { ...STAFF_CONFIG, sort_by: 'role; DROP TABLE users;--' } })
    expect(injection.status).toBe(400)
  })

  it('should scope rows to the caller organisation', async () => {
    const orgA = await createOrg()
    const orgB = await createOrg()
    const mgrA = await createUser({ email: `cb-a-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: orgA.id })
    const mgrB = await createUser({ email: `cb-b-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: orgB.id })
    await createStaffProfile({ user_id: mgrA.id, first_name: 'Only', last_name: 'OrgA' })
    await createPerson({ organization_id: orgB.id, first_name: 'Only', last_name: 'OrgB' })

    const resA = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${generateToken(mgrA)}`)
      .send({ config: { name: 'People', dataset: 'people', columns: ['first_name', 'last_name'], row_limit: 100, chart_type: 'table' } })
    expect(resA.status).toBe(200)
    expect(resA.body.table.rows).toEqual([])

    const resB = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${generateToken(mgrB)}`)
      .send({ config: { name: 'People', dataset: 'people', columns: ['first_name', 'last_name'], row_limit: 100, chart_type: 'table' } })
    expect(resB.status).toBe(200)
    expect(resB.body.table.rows.length).toBe(1)
  })

  it('should save, list, load, update, export and delete a configuration', async () => {
    const org = await createOrg()
    const admin = await createUser({ email: `cb-crud-${Date.now()}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
    await createStaffProfile({ user_id: admin.id, first_name: 'Ada', last_name: 'Admin' })
    // The saved config filters role = MANAGER, so the org needs one.
    const mgr = await createUser({ email: `cb-crud-mgr-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    await createStaffProfile({ user_id: mgr.id, first_name: 'Mara', last_name: 'Manager' })
    const token = generateToken(admin)

    const created = await request(app)
      .post('/reporting/custom')
      .set('Authorization', `Bearer ${token}`)
      .send(STAFF_CONFIG)
    expect(created.status).toBe(201)
    const id = created.body.report.id
    expect(id).toBeTruthy()

    const listed = await request(app).get('/reporting/custom').set('Authorization', `Bearer ${token}`)
    expect(listed.status).toBe(200)
    expect(listed.body.reports.some((r: { id: string }) => r.id === id)).toBe(true)

    const loaded = await request(app).get(`/reporting/custom/${id}`).set('Authorization', `Bearer ${token}`)
    expect(loaded.status).toBe(200)
    expect(loaded.body.report.name).toBe('Managers list')

    const runSaved = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ saved_id: id })
    expect(runSaved.status).toBe(200)
    expect(runSaved.body.table.rows.length).toBeGreaterThanOrEqual(1)

    const exported = await request(app)
      .post('/reporting/custom/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ saved_id: id, format: 'csv' })
    expect(exported.status).toBe(200)
    expect(exported.headers['content-type']).toContain('text/csv')
    expect(exported.text).toContain('Managers list')

    const updated = await request(app)
      .put(`/reporting/custom/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...STAFF_CONFIG, name: 'Managers list v2' })
    expect(updated.status).toBe(200)
    expect(updated.body.report.name).toBe('Managers list v2')

    const deleted = await request(app).delete(`/reporting/custom/${id}`).set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(200)
    const gone = await request(app).get(`/reporting/custom/${id}`).set('Authorization', `Bearer ${token}`)
    expect(gone.status).toBe(404)
  })

  it('should reject a CARE_WORKER and an unauthenticated caller (403/401)', async () => {
    const org = await createOrg()
    const worker = await createUser({ email: `cb-w-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })

    const forbidden = await request(app)
      .post('/reporting/custom/run')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ config: STAFF_CONFIG })
    expect(forbidden.status).toBe(403)

    const anon = await request(app).get('/reporting/custom/datasets')
    expect(anon.status).toBe(401)
  })
})
