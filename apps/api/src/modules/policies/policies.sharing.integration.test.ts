import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createStaffProfile, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

async function setup() {
  const org = await createOrg()
  const stamp = Date.now() + Math.floor(Math.random() * 100000)
  const admin = await createUser({ email: `share-admin-${stamp}@test.com`, password: 'TestPass123!', role: 'ORG_ADMIN', organization_id: org.id })
  const carer = await createUser({ email: `share-carer-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const other = await createUser({ email: `share-other-${stamp}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
  const policy = await request(app)
    .post('/policies')
    .set('Authorization', `Bearer ${generateToken(admin)}`)
    .send({ title: 'Safeguarding Adults Policy', category: 'Safeguarding', content: 'Read this.' })
  expect(policy.status).toBe(201)
  return { admin, carer, other, policyId: policy.body.id as string }
}

describe('Policies — versions, sharing and read requests (5.10)', () => {
  it('snapshots v1 on create so the history starts at the beginning', async () => {
    const { admin, policyId } = await setup()
    const res = await request(app)
      .get(`/policies/${policyId}/versions`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].version).toBe('1.0')
  })

  it('snapshots a new version on edit and returns it newest first', async () => {
    const { admin, policyId } = await setup()
    const updated = await request(app)
      .patch(`/policies/${policyId}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ content: 'Read this, then sign.', version: '1.1', what_changed: 'Added the sign-off step.' })
    expect(updated.status).toBe(200)
    const res = await request(app)
      .get(`/policies/${policyId}/versions`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].version).toBe('1.1')
    expect(res.body[0].what_changed).toBe('Added the sign-off step.')
  })

  it('publishing asks the staff to read the policy again', async () => {
    const { admin, carer, other, policyId } = await setup()
    const updated = await request(app)
      .patch(`/policies/${policyId}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ status: 'published', version: '1.0' })
    expect(updated.status).toBe(200)
    expect(updated.body.readRequestsSent).toBe(2)
    const inbox = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${generateToken(carer)}`)
    expect(inbox.status).toBe(200)
    expect((inbox.body as any[]).some((note: any) => note.link === `/policies/${policyId}`)).toBe(true)
    const otherInbox = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${generateToken(other)}`)
    expect((otherInbox.body as any[]).some((note: any) => note.link === `/policies/${policyId}`)).toBe(true)
  })

  it('lets a manager ask unsigned staff to read, and skips those who signed', async () => {
    const { admin, carer, other, policyId } = await setup()
    // Read requests file a task only for recipients with a staff profile —
    // createUser deliberately makes a bare user. The assertion below is about
    // that task, so the fixture has to model an actual staff member.
    await createStaffProfile({ user_id: other.id })
    await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${generateToken(carer)}`)
    const res = await request(app)
      .post(`/policies/${policyId}/read-requests`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ mode: 'unsigned', read_by: '2027-09-14', message: 'Please read before the visit.' })
    expect(res.status).toBe(201)
    expect(res.body.requested).toBe(1)
    const tasks = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect((tasks.body as any[]).some((task: any) => task.title === 'Read: Safeguarding Adults Policy')).toBe(true)
  })

  it('refuses read requests from a care worker', async () => {
    const { carer, policyId } = await setup()
    const res = await request(app)
      .post(`/policies/${policyId}/read-requests`)
      .set('Authorization', `Bearer ${generateToken(carer)}`)
      .send({ mode: 'all' })
    expect(res.status).toBe(403)
  })

  it('shares a policy link by email and reports what went out', async () => {
    const { admin, policyId } = await setup()
    const res = await request(app)
      .post(`/policies/${policyId}/share`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ emails: ['amara@example.com', 'joseph@example.com'], message: 'Worth a read.' })
    expect(res.status).toBe(200)
    expect(res.body.sent).toBe(2)
  })

  it('rejects a share with no valid address', async () => {
    const { admin, policyId } = await setup()
    const res = await request(app)
      .post(`/policies/${policyId}/share`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ emails: ['not-an-email'] })
    expect(res.status).toBe(400)
  })

  it('reminds only the staff who have not signed yet', async () => {
    const { admin, carer, other, policyId } = await setup()
    await request(app).post(`/policies/${policyId}/acknowledge`).set('Authorization', `Bearer ${generateToken(carer)}`)
    const res = await request(app)
      .post(`/policies/${policyId}/remind`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
    expect(res.status).toBe(201)
    expect(res.body.reminded).toBe(1)
    const otherInbox = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${generateToken(other)}`)
    expect((otherInbox.body as any[]).some((note: any) => note.title.startsWith('Reminder'))).toBe(true)
  })
})
