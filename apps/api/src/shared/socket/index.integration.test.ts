import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createServer, Server as HTTPServer } from 'http'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import { AddressInfo } from 'net'
import { initSocketServer, closeSocketServer } from './index'
import { createOrg, createUser, generateToken } from '../../test/factories'
import { migrateQuery as query } from '../../shared/database'

vi.mock('../../shared/middleware/rateLimit.middleware', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}))

const createdOrgs: string[] = []
const createdUsers: string[] = []

function trackOrg(org: { id: string }) { createdOrgs.push(org.id); return org }
function trackUser(user: { id: string }) { createdUsers.push(user.id); return user }

async function createChannel(organizationId: string, name: string, type: string, createdBy: string) {
  const result = await query(
    `INSERT INTO chat_channels (organization_id, name, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
    [organizationId, name, type, createdBy]
  )
  return result.rows[0]
}

async function addMember(channelId: string, userId: string) {
  await query(
    `INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [channelId, userId]
  )
}

let httpServer: HTTPServer
let url: string

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioc(url, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token },
    })
    client.once('connect', () => resolve(client))
    client.once('connect_error', (err) => {
      client.close()
      reject(err)
    })
  })
}

beforeAll(async () => {
  httpServer = createServer()
  await initSocketServer(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const port = (httpServer.address() as AddressInfo).port
  url = `http://localhost:${port}`
}, 30_000)

afterAll(async () => {
  await closeSocketServer()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  // Targeted cleanup only (matches other integration tests — a blanket
  // cleanDatabase would wipe data mid-run for tests in parallel workers).
  for (const userId of createdUsers) {
    try { await query(`DELETE FROM chat_members WHERE user_id = $1`, [userId]); } catch { /* skip */ }
  }
  for (const orgId of createdOrgs) {
    try { await query(`DELETE FROM chat_members WHERE channel_id IN (SELECT id FROM chat_channels WHERE organization_id = $1)`, [orgId]); } catch { /* skip */ }
    try { await query(`DELETE FROM chat_channels WHERE organization_id = $1`, [orgId]); } catch { /* skip */ }
  }
  for (const userId of createdUsers) {
    try { await query(`DELETE FROM users WHERE id = $1`, [userId]); } catch { /* skip */ }
  }
  for (const orgId of createdOrgs) {
    try { await query(`DELETE FROM organizations WHERE id = $1`, [orgId]); } catch { /* skip */ }
  }
}, 30_000)

describe('socket auth middleware', () => {
  it('rejects connections without a token', async () => {
    await expect(connectClient('')).rejects.toThrow(/Authentication required/i)
  })

  it('rejects connections with an invalid token', async () => {
    await expect(connectClient('not-a-real-token')).rejects.toThrow()
  })

  it('accepts a valid token and joins the user room', async () => {
    const org = trackOrg(await createOrg())
    const user = trackUser(await createUser({ email: `sock-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const token = generateToken(user)

    // Register the snapshot listener before connect resolves — the server
    // emits presence:snapshot synchronously on connection.
    const snapshotP = new Promise<{ onlineUserIds: string[] }>((resolve) => {
      const probe = ioc(url, {
        transports: ['websocket'],
        reconnection: false,
        auth: { token },
      })
      probe.once('presence:snapshot', (data) => { probe.close(); resolve(data) })
      probe.once('connect', () => { /* presence snapshot will arrive right after */ })
    })

    const snapshot = await snapshotP
    expect(snapshot.onlineUserIds).toContain(user.id)
  })

  it('rejects a deactivated user', async () => {
    const org = trackOrg(await createOrg())
    const user = trackUser(await createUser({ email: `sock-inactive-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id, status: 'deactivated' }))
    const token = generateToken(user)

    await expect(connectClient(token)).rejects.toThrow(/deactivated/i)
  })

  it('rejects a token with a stale role', async () => {
    const org = trackOrg(await createOrg())
    const user = trackUser(await createUser({ email: `sock-role-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    // Token says MANAGER, DB says CARE_WORKER -> role mismatch
    const token = generateToken({ id: user.id, email: user.email, role: 'MANAGER', organization_id: org.id })

    await expect(connectClient(token)).rejects.toThrow(/permissions changed/i)
  })
})

function joinChannel(client: ClientSocket, channelId: string): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    client.emit('chat:join', channelId, (res: { ok: boolean }) => resolve(res))
    setTimeout(() => reject(new Error('chat:join ack timed out')), 5000)
  })
}

describe('socket chat:join / typing', () => {
  it('joins the channel room only for members and relays typing', async () => {
    const org = trackOrg(await createOrg())
    const member = trackUser(await createUser({ email: `sock-mem-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const nonMember = trackUser(await createUser({ email: `sock-nonmem-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const channel = await createChannel(org.id, 'Test Room', 'group', member.id)
    await addMember(channel.id, member.id)

    const tokenMember = generateToken(member)
    const tokenNonMember = generateToken(nonMember)

    const clientMember = await connectClient(tokenMember)
    const clientNonMember = await connectClient(tokenNonMember)

    try {
      // Members can join
      expect((await joinChannel(clientMember, channel.id)).ok).toBe(true)
      // Non-members cannot
      expect((await joinChannel(clientNonMember, channel.id)).ok).toBe(false)

      // Non-member typing should NOT reach the member's room
      let receivedByMember = false
      const typingP = new Promise<void>((resolve) => {
        clientMember.once('chat:typing', () => { receivedByMember = true; resolve() })
        clientNonMember.emit('chat:typing', { channelId: channel.id, isTyping: true })
        setTimeout(() => resolve(), 300)
      })
      await typingP
      expect(receivedByMember).toBe(false)
    } finally {
      clientMember.close()
      clientNonMember.close()
    }
  })

  it('relays typing only to other members of the room', async () => {
    const org = trackOrg(await createOrg())
    const alice = trackUser(await createUser({ email: `sock-alice-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const bob = trackUser(await createUser({ email: `sock-bob-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const channel = await createChannel(org.id, 'Typing Room', 'group', alice.id)
    await addMember(channel.id, alice.id)
    await addMember(channel.id, bob.id)

    const clientAlice = await connectClient(generateToken(alice))
    const clientBob = await connectClient(generateToken(bob))

    try {
      await joinChannel(clientAlice, channel.id)
      await joinChannel(clientBob, channel.id)

      const typing = await new Promise<{ channelId: string; userId: string; isTyping: boolean }>((resolve, reject) => {
        clientBob.once('chat:typing', resolve)
        clientAlice.emit('chat:typing', { channelId: channel.id, isTyping: true })
        setTimeout(() => reject(new Error('chat:typing not relayed')), 5000)
      })
      expect(typing.channelId).toBe(channel.id)
      expect(typing.userId).toBe(alice.id)
      expect(typing.isTyping).toBe(true)
    } finally {
      clientAlice.close()
      clientBob.close()
    }
  })
})

describe('socket presence', () => {
  it('broadcasts user:online on connect and user:offline on disconnect', async () => {
    const org = trackOrg(await createOrg())
    const a = trackUser(await createUser({ email: `sock-pa-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))
    const b = trackUser(await createUser({ email: `sock-pb-${Date.now()}@test.com`, role: 'CARE_WORKER', organization_id: org.id }))

    const clientA = await connectClient(generateToken(a))
    try {
      const gotOnline = new Promise<{ userId: string }>((resolve) => {
        clientA.once('user:online', resolve)
      })
      const clientB = await connectClient(generateToken(b))
      const online = await gotOnline
      expect(online.userId).toBe(b.id)

      const gotOffline = new Promise<{ userId: string }>((resolve) => {
        clientA.once('user:offline', resolve)
      })
      clientB.close()
      const offline = await gotOffline
      expect(offline.userId).toBe(b.id)
    } finally {
      clientA.close()
    }
  })
})
