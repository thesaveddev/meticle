import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, createNotification, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Notifications', () => {
  it('should list my notifications and unread count', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `notif-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createNotification({ userId: user.id, title: 'Shift reminder' })
    await createNotification({ userId: user.id, title: 'Read one', read: true })
    const token = generateToken(user)

    const list = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.length).toBe(2)

    const count = await request(app)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
    expect(count.status).toBe(200)
    expect(count.body.count).toBe(1)
  })

  it('should mark a notification as read and all as read', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `notif2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const n1 = await createNotification({ userId: user.id, title: 'A' })
    const n2 = await createNotification({ userId: user.id, title: 'B' })
    const token = generateToken(user)

    const one = await request(app)
      .patch(`/notifications/${n1.id}/read`)
      .set('Authorization', `Bearer ${token}`)
    expect(one.status).toBe(200)

    const all = await request(app)
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
    expect(all.status).toBe(200)

    const count = await request(app)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
    expect(count.body.count).toBe(0)
  })

  it('should not leak another user notifications', async () => {
    const org = await createOrg()
    const a = await createUser({ email: `notif3a-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const b = await createUser({ email: `notif3b-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    await createNotification({ userId: b.id, title: 'For B only' })

    const res = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${generateToken(a)}`)
    expect(res.status).toBe(200)
    expect(res.body.some((n: any) => n.title === 'For B only')).toBe(false)
  })

  it('should list and update notification preferences', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `notif4-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(user)

    const prefs = await request(app)
      .get('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
    expect(prefs.status).toBe(200)
    expect(Array.isArray(prefs.body)).toBe(true)
    expect(prefs.body.length).toBeGreaterThan(0)

    const updated = await request(app)
      .patch('/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ notification_type: 'compliance', enabled: false })
    expect(updated.status).toBe(200)
  })

  it('should reject without auth', async () => {
    const res = await request(app).get('/notifications')
    expect(res.status).toBe(401)
  })
})
