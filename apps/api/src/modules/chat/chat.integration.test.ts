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
      .send({ message: 'Hello team' })
    expect(msg.status).toBe(201)
    expect(msg.body.message).toBe('Hello team')

    const reply = await request(app)
      .post(`/chat/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Replying to this', reply_to_id: msg.body.id })
    expect(reply.status).toBe(201)
    expect(reply.body.reply_to_id).toBe(msg.body.id)

    const channels = await request(app)
      .get('/chat/channels')
      .set('Authorization', `Bearer ${token}`)
    expect(channels.status).toBe(200)
    expect(channels.body.some((c: any) => c.id === channelId)).toBe(true)

    const messages = await request(app)
      .get(`/chat/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${token}`)
    expect(messages.status).toBe(200)
    expect(Array.isArray(messages.body)).toBe(true)
    expect(messages.body.some((m: any) => m.id === msg.body.id)).toBe(true)

    const reaction = await request(app)
      .post(`/chat/channels/${channelId}/messages/${msg.body.id}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' })
    expect(reaction.status).toBe(200)

    const dm = await request(app)
      .post(`/chat/channels/dm/${userB.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(dm.status).toBe(201)

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

  it('should add members to a group and expose member profile fields', async () => {
    const org = await createOrg()
    const creator = await createUser({ email: `ch-add-${Date.now()}@test.com`, password: 'TestPass123!', role: 'MANAGER', organization_id: org.id })
    const joiner = await createUser({ email: `ch-add2-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const outsider = await createUser({ email: `ch-add3-${Date.now()}@test.com`, password: 'TestPass123!', role: 'CARE_WORKER', organization_id: org.id })
    const creatorToken = generateToken(creator)
    const outsiderToken = generateToken(outsider)

    const group = await request(app)
      .post('/chat/groups')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ name: 'Add Squad', memberIds: [] })
    expect(group.status).toBe(201)
    const channelId = group.body.id

    // Outsider (not a member) cannot add
    const forbidden = await request(app)
      .post(`/chat/channels/${channelId}/members`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ memberIds: [joiner.id] })
    expect(forbidden.status).toBe(403)

    const added = await request(app)
      .post(`/chat/channels/${channelId}/members`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ memberIds: [joiner.id] })
    expect(added.status).toBe(201)
    expect(added.body.added).toBe(1)

    // Re-adding is idempotent
    const repeat = await request(app)
      .post(`/chat/channels/${channelId}/members`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ memberIds: [joiner.id] })
    expect(repeat.status).toBe(201)
    expect(repeat.body.added).toBe(0)

    const members = await request(app)
      .get(`/chat/channels/${channelId}/members`)
      .set('Authorization', `Bearer ${creatorToken}`)
    expect(members.status).toBe(200)
    const row = members.body.find((m: any) => m.user_id === joiner.id)
    expect(row).toBeDefined()
    expect(row).toHaveProperty('first_name')
    expect(row).toHaveProperty('role')
    expect(row).toHaveProperty('location_name')

    const orgMembers = await request(app)
      .get('/chat/org-members')
      .set('Authorization', `Bearer ${creatorToken}`)
    expect(orgMembers.status).toBe(200)
    expect(orgMembers.body.some((m: any) => m.id === joiner.id && 'location_name' in m)).toBe(true)

    // DMs stay closed
    const dm = await request(app)
      .post(`/chat/channels/dm/${joiner.id}`)
      .set('Authorization', `Bearer ${creatorToken}`)
    expect(dm.status).toBe(201)
    const dmAdd = await request(app)
      .post(`/chat/channels/${dm.body.id}/members`)
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ memberIds: [outsider.id] })
    expect(dmAdd.status).toBe(400)
  })
})
