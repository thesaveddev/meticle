import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { Express } from 'express'
import { createTestApp } from '../../test/helpers'
import { createOrg, createUser, generateToken } from '../../test/factories'

let app: Express

beforeAll(async () => {
  app = createTestApp()
}, 30_000)

describe('Chat — channels, groups, messages, reactions', () => {
  it('should ensure general channel, create group, message, react and DM', async () => {
    const org = await createOrg()
    const userA = await createUser({ email: `ch-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const userB = await createUser({ email: `ch2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const token = generateToken(userA)

    const general = await request(app)
      .post('/chat/ensure-general')
      .set('Authorization', `Bearer ${token}`)
    expect(general.status).toBe(200)
    expect(general.body.id).toBeDefined()

    const group = await request(app)
      .post('/chat/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Night Shift', memberIds: [userA.id, userB.id] })
    expect(group.status).toBe(201)
    const channelId = group.body.id

    const msg = await request(app)
      .post(`/chat/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello team' })
    expect(msg.status).toBe(201)
    expect(msg.body.content).toBe('Hello team')

    const reply = await request(app)
      .post(`/chat/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Replying to this', parent_id: msg.body.id })
    expect(reply.status).toBe(201)
    expect(reply.body.parent_id).toBe(msg.body.id)

    const channels = await request(app)
      .get('/chat/channels')
      .set('Authorization', `Bearer ${token}`)
    expect(channels.status).toBe(200)
    expect(channels.body.some((c: any) => c.id === channelId)).toBe(true)

    const messages = await request(app)
      .get(`/chat/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
    expect(messages.status).toBe(200)
    expect(messages.body.messages.some((m: any) => m.id === msg.body.id)).toBe(true)

    const reaction = await request(app)
      .post(`/chat/channels/${channelId}/messages/${msg.body.id}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' })
    expect(reaction.status).toBe(200)

    const dm = await request(app)
      .post(`/chat/channels/dm/${userB.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(dm.status).toBe(200)

    const orgMembers = await request(app)
      .get('/chat/org-members')
      .set('Authorization', `Bearer ${token}`)
    expect(orgMembers.status).toBe(200)
    expect(orgMembers.body.some((m: any) => m.id === userB.id)).toBe(true)

    const search = await request(app)
      .get('/chat/search')
      .query({ q: 'Hello' })
      .set('Authorization', `Bearer ${token}`)
    expect(search.status).toBe(200)
  })

  it('should reject without auth (401)', async () => {
    const res = await request(app).get('/chat/channels')
    expect(res.status).toBe(401)
  })
})
