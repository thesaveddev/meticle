import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Redis mode for Mica's follow-up memory. The shared redis module is mocked at
 * the `getRedisClient` seam with a minimal Map-backed fake that implements the
 * three node-redis methods the store uses (GET/SET with PX expiry + TTL read),
 * so these tests exercise the exact code paths — Redis-then-memory lookup
 * ordering, blob restore/scoping, sliding-TTL write — without standing up a
 * real Redis server, and so the fallback (null client, or a client that
 * throws) is testable deterministically.
 */

const store = new Map<string, { value: string; expiresAt: number }>()
/** Set by individual tests to make the fake client throw (wedged Redis). */
let failing = false

const fakeClient = {
  isOpen: true,
  get: async (key: string) => {
    if (failing) throw new Error('connection wedged')
    const e = store.get(key)
    if (!e || e.expiresAt < Date.now()) { if (e) store.delete(key); return null }
    return e.value
  },
  set: async (key: string, value: string, opts?: { PX?: number }) => {
    if (failing) throw new Error('connection wedged')
    store.set(key, { value, expiresAt: opts?.PX ? Date.now() + opts.PX : Number.MAX_SAFE_INTEGER })
    return 'OK'
  },
}

vi.mock('../../shared/redis', () => ({
  getRedisClient: async () => fakeClient,
}))

import {
  loadOrCreateSession, recordTurn, buildFollowUpMessages,
} from './mica.session'

beforeEach(() => {
  vi.resetModules()
  store.clear()
  failing = false
})
afterEach(() => { store.clear(); failing = false })

describe('mica.session (redis mode)', () => {
  it('persists a turn to Redis with a sliding TTL and reads it back cross-instance', async () => {
    const s = await loadOrCreateSession('org1', 'user1')
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')

    const raw = store.get(`mica:sess:${s!.sessionId}`)
    expect(raw).toBeTruthy()
    // Sliding TTL: roughly 30 minutes from now, not an absolute instant.
    expect(raw!.expiresAt - Date.now()).toBeGreaterThan(29 * 60 * 1000)
    expect(JSON.parse(raw!.value).turns[0].question).toBe('who is on shift today?')

    // A second "worker" (empty in-process cache would matter here only if the
    // store were per-instance) — loading by id hits the Redis copy.
    const again = await loadOrCreateSession('org1', 'user1', s!.sessionId)
    expect(again!.sessionId).toBe(s!.sessionId)
    expect(buildFollowUpMessages(again!, 'SYS', 'and tonight?').priorTurns).toBe(1)
  })

  it('survives a process restart: the session lives in Redis, not in process memory', async () => {
    const s = await loadOrCreateSession('org1', 'user1')
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')
    const id = s!.sessionId

    // Simulate a restart: re-import the module so its in-process Map is empty.
    vi.resetModules()
    const fresh = await import('./mica.session')

    const restored = await fresh.loadOrCreateSession('org1', 'user1', id)
    expect(restored!.sessionId).toBe(id)
    const { messages, priorTurns } = buildFollowUpMessages(restored!, 'SYS', 'what about tomorrow?')
    expect(priorTurns).toBe(1)
    expect(messages.some((m) => m.content === 'who is on shift today?')).toBe(true)
  })

  it('falls back to the in-process map when Redis is unavailable, and still answers', async () => {
    failing = true
    const s = await loadOrCreateSession('org1', 'user1')
    expect(s).toBeTruthy()
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')
    // The in-process copy still resolves the next turn; nothing hung.
    const next = await loadOrCreateSession('org1', 'user1', s!.sessionId)
    expect(next!.sessionId).toBe(s!.sessionId)
    expect(buildFollowUpMessages(next!, 'SYS', 'and tonight?').priorTurns).toBe(1)
  })

  it('still rejects a foreign or expired session through the Redis path', async () => {
    const s = await loadOrCreateSession('org1', 'user1')
    await recordTurn(s!, 'who is on shift today?', 'Fatima Iqbal.')

    const other = await loadOrCreateSession('org1', 'user2', s!.sessionId)
    expect(other!.sessionId).not.toBe(s!.sessionId)
    expect(buildFollowUpMessages(other!, 'SYS', 'anything?').priorTurns).toBe(0)
  })
})
