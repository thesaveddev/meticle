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

  it('reaches an old notification through the page cursor, in a fixed order', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `notif-page-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(user)
    // More than one page, and created in a burst so several share a timestamp: the
    // tie is exactly where an offset page slips and a keyset page does not.
    for (let i = 0; i < 25; i++) {
      await createNotification({ userId: user.id, title: `Page row ${i}` })
    }

    const seen: string[] = []
    let cursor: { before: string; beforeId: string } | null = null
    for (let page = 0; page < 5; page++) {
      const res = await request(app)
        .get('/notifications')
        .query({ limit: 10, ...(cursor || {}) })
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.length).toBeLessThanOrEqual(10)
      for (const row of res.body) seen.push(row.id)
      if (res.body.length < 10) break
      const last = res.body[res.body.length - 1]
      cursor = { before: last.created_at, beforeId: last.id }
    }

    // Every row once, no repeats, and all 25 reached: the older ones are the ones a
    // fixed limit of twenty used to make unreachable.
    expect(new Set(seen).size).toBe(seen.length)
    expect(seen.length).toBe(25)

    const firstPage = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
    expect(firstPage.status).toBe(200)
    expect(firstPage.body.length).toBe(20)
  })

  it('rejects half a page cursor rather than silently returning the newest page', async () => {
    const org = await createOrg()
    const user = await createUser({ email: `notif-cursor-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(user)
    const last = await createNotification({ userId: user.id, title: 'Cursor anchor' })

    const half = await request(app)
      .get('/notifications')
      .query({ before: new Date().toISOString() })
      .set('Authorization', `Bearer ${token}`)
    expect(half.status).toBe(400)

    const badId = await request(app)
      .get('/notifications')
      .query({ before: new Date().toISOString(), beforeId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${token}`)
    expect(badId.status).toBe(400)

    // A well-formed cursor is accepted, even when it sits at the oldest row.
    const ok = await request(app)
      .get('/notifications')
      .query({ before: last.created_at, beforeId: last.id })
      .set('Authorization', `Bearer ${token}`)
    expect(ok.status).toBe(200)
    expect(Array.isArray(ok.body)).toBe(true)
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
