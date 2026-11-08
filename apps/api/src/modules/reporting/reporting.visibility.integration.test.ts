import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, createLocation, createDepartment, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

const STAFF_CONFIG = {
  name: 'Visibility probe',
  dataset: 'staff',
  columns: ['first_name', 'last_name'],
  filters: [],
  sort_dir: 'asc',
  row_limit: 50,
  chart_type: 'table',
}

async function setup() {
  const org = await createOrg()
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  // Departments hang off a location, which is what gives them an organisation.
  const location = await createLocation({ organization_id: org.id })
  const deptA = await createDepartment({ location_id: location.id, name: `Dept A ${suffix}` })
  const deptB = await createDepartment({ location_id: location.id, name: `Dept B ${suffix}` })
  const admin = await createUser({ email: `vis-admin-${suffix}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  const mgrA = await createUser({ email: `vis-mgra-${suffix}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const mgrA2 = await createUser({ email: `vis-mgra2-${suffix}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const mgrB = await createUser({ email: `vis-mgrb-${suffix}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  await createStaffProfile({ user_id: mgrA.id, department_id: deptA.id })
  await createStaffProfile({ user_id: mgrA2.id, department_id: deptA.id })
  await createStaffProfile({ user_id: mgrB.id, department_id: deptB.id })
  return {
    org,
    adminToken: generateToken(admin),
    tokenA: generateToken(mgrA),
    tokenA2: generateToken(mgrA2),
    tokenB: generateToken(mgrB),
  }
}

describe('Reporting — custom report visibility', () => {
  it('defaults to managers and rejects unknown values', async () => {
    const { tokenA } = await setup()
    const created = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${tokenA}`).send(STAFF_CONFIG)
    expect(created.status).toBe(201)
    expect(created.body.report.visibility).toBe('managers')

    const bad = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${tokenA}`).send({ ...STAFF_CONFIG, name: 'Bad vis', visibility: 'everyone' })
    expect(bad.status).toBe(400)
  })

  it('hides team reports from other departments and me reports from everyone but the owner', async () => {
    const { tokenA, tokenA2, tokenB, adminToken } = await setup()

    const team = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${tokenA}`).send({ ...STAFF_CONFIG, name: 'Team report', visibility: 'team' })
    expect(team.status).toBe(201)
    const mine = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${tokenA}`).send({ ...STAFF_CONFIG, name: 'Private report', visibility: 'me' })
    expect(mine.status).toBe(201)

    // Same department sees the team report; the other department does not.
    expect((await request(app).get(`/reporting/custom/${team.body.report.id}`).set('Authorization', `Bearer ${tokenA2}`)).status).toBe(200)
    expect((await request(app).get(`/reporting/custom/${team.body.report.id}`).set('Authorization', `Bearer ${tokenB}`)).status).toBe(404)

    // Only the owner (and admins) see the me report.
    expect((await request(app).get(`/reporting/custom/${mine.body.report.id}`).set('Authorization', `Bearer ${tokenA2}`)).status).toBe(404)
    expect((await request(app).get(`/reporting/custom/${mine.body.report.id}`).set('Authorization', `Bearer ${tokenB}`)).status).toBe(404)
    expect((await request(app).get(`/reporting/custom/${mine.body.report.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200)
    expect((await request(app).get(`/reporting/custom/${team.body.report.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200)

    // The library lists only what each viewer may see.
    const listB = await request(app).get('/reporting/custom').set('Authorization', `Bearer ${tokenB}`)
    const idsB = listB.body.reports.map((r: { id: string }) => r.id)
    expect(idsB).not.toContain(team.body.report.id)
    expect(idsB).not.toContain(mine.body.report.id)
    const listA2 = await request(app).get('/reporting/custom').set('Authorization', `Bearer ${tokenA2}`)
    const idsA2 = listA2.body.reports.map((r: { id: string }) => r.id)
    expect(idsA2).toContain(team.body.report.id)
    expect(idsA2).not.toContain(mine.body.report.id)

    // Saved-id runs and exports respect visibility too.
    const runDenied = await request(app).post('/reporting/custom/run').set('Authorization', `Bearer ${tokenB}`).send({ saved_id: team.body.report.id })
    expect(runDenied.status).toBe(404)
    const runAllowed = await request(app).post('/reporting/custom/run').set('Authorization', `Bearer ${tokenA2}`).send({ saved_id: team.body.report.id })
    expect(runAllowed.status).toBe(200)
  })

  it('lets only the owner or an admin change or delete a restricted report', async () => {
    const { tokenA, tokenA2, adminToken } = await setup()
    // A team report is visible to a colleague in the same department, so this
    // reaches the edit check. A "me" report would correctly 404 before it, to
    // avoid disclosing that the report exists at all.
    const created = await request(app).post('/reporting/custom').set('Authorization', `Bearer ${tokenA}`).send({ ...STAFF_CONFIG, name: 'Owned report', visibility: 'team' })
    const id = created.body.report.id

    const forbidden = await request(app).put(`/reporting/custom/${id}`).set('Authorization', `Bearer ${tokenA2}`).send({ ...STAFF_CONFIG, name: 'Hijacked' })
    expect(forbidden.status).toBe(403)
    const delForbidden = await request(app).delete(`/reporting/custom/${id}`).set('Authorization', `Bearer ${tokenA2}`)
    expect(delForbidden.status).toBe(403)

    const adminUpdate = await request(app).put(`/reporting/custom/${id}`).set('Authorization', `Bearer ${adminToken}`).send({ ...STAFF_CONFIG, name: 'Renamed', visibility: 'team' })
    expect(adminUpdate.status).toBe(200)
    expect(adminUpdate.body.report.name).toBe('Renamed')
  })
})
