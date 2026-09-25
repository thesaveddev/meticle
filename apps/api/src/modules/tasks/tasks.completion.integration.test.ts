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

/**
 * The Tasks page appears in the navigation for support workers, so the list has
 * to be actionable. It was not: the list loaded and every edit returned 403.
 */
async function team() {
  const org = await createOrg()
  const manager = await createUser({ email: `mgr-${Date.now()}@task-test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
  const worker = await createUser({ email: `worker-${Date.now()}@task-test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  await createStaffProfile({ userId: manager.id })
  await createStaffProfile({ userId: worker.id })
  return { org, manager, worker }
}

describe('Tasks — support worker completion', () => {
  it('lets a support worker complete a task', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Check the boiler room', status: 'pending' })
    expect(created.status).toBe(201)

    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ status: 'completed', notes: 'Checked, all clear' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('completed')
    expect(res.body.notes).toBe('Checked, all clear')
  })

  it('ignores allocation fields a support worker tries to change', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Deep clean the lounge', priority: 'high', status: 'pending' })

    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ status: 'completed', title: 'Renamed by a worker', priority: 'low' })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Deep clean the lounge')
    expect(res.body.priority).toBe('high')
  })

  it('refuses a support worker submission that contains only forbidden fields', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Order catering' })

    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ due_date: '2026-12-01' })

    expect(res.status).toBe(403)
  })

  it('keeps task creation and deletion with managers', async () => {
    const { worker } = await team()
    const token = generateToken(worker)

    expect((await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Mine now' })).status).toBe(403)

    const { manager } = await team()
    const created = await request(app).post('/tasks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ title: 'Delete me' })
    expect((await request(app).delete(`/tasks/${created.body.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(403)
  })
})

/**
 * Room checks are a support worker's task, and an unowned safety record is not
 * usable as inspection evidence, so the check has to record its author.
 */
describe('Room checks — support worker recording', () => {
  it('lets a support worker record a room check and attributes it to them', async () => {
    const { manager, worker } = await team()
    const res = await request(app)
      .post('/room-checks')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ room_number: 'Flat 4', status: 'needs_attention', notes: 'Radiator leaking' })

    expect(res.status).toBe(201)
    expect(res.body.checked_by).toBeTruthy()
    // The check is listed with the performer's name, not blank.
    const list = await request(app).get('/room-checks').set('Authorization', `Bearer ${generateToken(manager)}`)
    const mine = list.body.find((c: any) => c.id === res.body.id)
    expect(mine.checked_by_name).toContain('Test')
  })

  it('ignores a checked_by supplied in the body', async () => {
    const { manager, worker } = await team()
    const res = await request(app)
      .post('/room-checks')
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ room_number: 'Flat 9', checked_by: null })

    expect(res.status).toBe(201)
    expect(res.body.checked_by).toBeTruthy()
  })

  it('lets a support worker amend their own check', async () => {
    const { worker } = await team()
    const token = generateToken(worker)
    const created = await request(app).post('/room-checks').set('Authorization', `Bearer ${token}`)
      .send({ room_number: 'Flat 2', status: 'needs_attention' })

    const res = await request(app)
      .patch(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pass', notes: 'Re-checked, sorted' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pass')
  })

  it('refuses a support worker amending someone else safety record', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/room-checks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ room_number: 'Flat 7', status: 'fail' })

    const res = await request(app)
      .patch(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ status: 'pass' })

    expect(res.status).toBe(403)
  })

  it('refuses a support worker reassigning a check to someone else', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/room-checks').set('Authorization', `Bearer ${generateToken(manager)}`)
      .send({ room_number: 'Flat 3' })

    const res = await request(app)
      .patch(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ checked_by: '00000000-0000-0000-0000-000000000000' })

    // checked_by is not an updatable column, so the update affects nothing.
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) expect(res.body.checked_by).toBe(created.body.checked_by)
  })

  it('keeps deletion with the organisation admin', async () => {
    const { manager, worker } = await team()
    const created = await request(app).post('/room-checks').set('Authorization', `Bearer ${generateToken(worker)}`)
      .send({ room_number: 'Flat 1' })

    const res = await request(app)
      .delete(`/room-checks/${created.body.id}`)
      .set('Authorization', `Bearer ${generateToken(manager)}`)

    expect(res.status).toBe(403)
  })
})
