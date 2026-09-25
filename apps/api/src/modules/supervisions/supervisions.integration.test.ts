import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function orgWithTeam() {
  const org = await createOrg()
  const manager = await createUser({ email: `manager-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const carer = await createUser({ email: `carer-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  await createStaffProfile({ userId: manager.id, first_name: 'Man', last_name: 'Ager' })
  await createStaffProfile({ userId: carer.id, first_name: 'Care', last_name: 'Rour' })
  return { org, manager, carer }
}

describe('Supervisions Integration', () => {
  it('should start with no coverage recorded', async () => {
    const { manager } = await orgWithTeam()
    const res = await request(app)
      .get('/supervisions/summary')
      .set('Authorization', `Bearer ${generateToken(manager)}`)

    expect(res.status).toBe(200)
    expect(res.body.sessions).toBe(0)
  })

  it('should record a supervision and report it in the coverage summary', async () => {
    const { manager, carer } = await orgWithTeam()
    const token = generateToken(manager)

    const created = await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        staff_user_id: carer.id,
        supervisor_user_id: manager.id,
        supervised_at: '2026-09-01',
        supervision_type: 'individual',
        notes: 'Discussed medication administration and record keeping.',
      })

    expect(created.status).toBe(201)
    expect(created.body.staff_name).toContain('Care')
    expect(created.body.supervisor_name).toContain('Man')

    const summary = await request(app)
      .get('/supervisions/summary')
      .set('Authorization', `Bearer ${token}`)

    expect(summary.status).toBe(200)
    expect(summary.body.sessions).toBe(1)
    expect(summary.body.done).toBe(1)
  })

  it('should list supervisions for a manager', async () => {
    const { manager, carer } = await orgWithTeam()
    const token = generateToken(manager)
    await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${token}`)
      .send({ staff_user_id: carer.id, supervisor_user_id: manager.id, supervised_at: '2026-09-02' })

    const res = await request(app)
      .get('/supervisions')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].file_type).toBeUndefined()
  })

  it('should only show a care worker their own supervisions', async () => {
    const org = await createOrg()
    const manager = await createUser({ email: `manager-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const carerA = await createUser({ email: `a-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const carerB = await createUser({ email: `b-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createStaffProfile({ userId: manager.id })
    await createStaffProfile({ userId: carerA.id })
    await createStaffProfile({ userId: carerB.id })

    const managerToken = generateToken(manager)
    await request(app).post('/supervisions').set('Authorization', `Bearer ${managerToken}`)
      .send({ staff_user_id: carerA.id, supervisor_user_id: manager.id, supervised_at: '2026-09-01' })
    await request(app).post('/supervisions').set('Authorization', `Bearer ${managerToken}`)
      .send({ staff_user_id: carerB.id, supervisor_user_id: manager.id, supervised_at: '2026-09-01' })

    const res = await request(app)
      .get('/supervisions')
      .set('Authorization', `Bearer ${generateToken(carerA)}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].staff_user_id).toBe(carerA.id)
  })

  it('should refuse to let a care worker record a supervision', async () => {
    const { manager, carer } = await orgWithTeam()
    const res = await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${generateToken(carer)}`)
      .send({ staff_user_id: carer.id, supervisor_user_id: manager.id })

    expect(res.status).toBe(403)
  })

  it('should refuse a supervisor from another organisation', async () => {
    const { manager, carer } = await orgWithTeam()
    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `outsider-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: otherOrg.id })
    await createStaffProfile({ userId: outsider.id })

    const res = await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ staff_user_id: carer.id, supervisor_user_id: outsider.id })

    expect(res.status).toBe(400)
  })

  it('should refuse a supervision of the supervisor themselves', async () => {
    const { manager } = await orgWithTeam()
    const res = await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ staff_user_id: manager.id, supervisor_user_id: manager.id })

    expect(res.status).toBe(400)
  })

  it('should refuse a staff member from another organisation', async () => {
    const { manager } = await orgWithTeam()
    const otherOrg = await createOrg()
    const outsider = await createUser({ email: `outsider-${Date.now()}@sup-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: otherOrg.id })
    await createStaffProfile({ userId: outsider.id })

    const res = await request(app)
      .post('/supervisions')
      .set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ staff_user_id: outsider.id, supervisor_user_id: manager.id })

    expect(res.status).toBe(404)
  })

  it('should refuse unauthenticated access', async () => {
    expect((await request(app).get('/supervisions')).status).toBe(401)
    expect((await request(app).get('/supervisions/summary')).status).toBe(401)
  })
})
