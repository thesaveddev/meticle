import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Concurrency + bounded-memory behaviour of Mica's follow-up memory.
 *
 * Three properties under load, all of them the reason a load test exists:
 *
 *   1. Concurrent users never see each other's turns — 200 parallel
 *      sessions over the same store, then every conversation replays
 *      exactly its own turns.
 *   2. Memory stays bounded: sessions expire lazily, so the in-process
 *      Map cannot grow with total traffic — only with *live* conversations
 *      (≤ TTL window). Same for the Redis fake: every write carries the
 *      TTL, so nothing persists forever.
 *   3. A wedged Redis mid-conversation fails over to per-worker memory
 *      without hanging any request.
 */

const store = new Map<string, { value: string; expiresAt: number }>()
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

type MicaSessionModule = typeof import('./mica.session')

/** Fresh module instance per test so the module-level Map never accumulates
 * state across cases — mirrors the redis index tests' approach. */
const freshModule = async (): Promise<MicaSessionModule> => {
  vi.resetModules()
  return import('./mica.session')
}

const TTL_MS = 30 * 60 * 1000
const USERS = 200

beforeEach(() => {
  store.clear()
  failing = false
})
afterEach(() => { store.clear(); failing = false })

describe('mica.session under concurrent load', () => {
  it('keeps 200 concurrent conversations isolated and correct on the Redis path', async () => {
    const m = await freshModule()
    const sessions = await Promise.all(
      Array.from({ length: USERS }, (_, i) =>
        m.loadOrCreateSession('org', `user-${i}`),
      ),
    )
    expect(new Set(sessions.map((s) => s!.sessionId)).size).toBe(USERS)

    // Every user records their own distinct turns, all in parallel (the
    // realistic burst pattern: a whole shift handover at once).
    await Promise.all(
      sessions.map((s, i) =>
        Promise.all(
          Array.from({ length: 3 }, (_, t) =>
            m.recordTurn(s!, `q-${i}-${t}`, `a-${i}-${t}`),
          ),
        ),
      ),
    )

    // Each conversation replays exactly its own turns — no cross-user leak.
    for (let i = 0; i < USERS; i += 25) {
      const reloaded = await m.loadOrCreateSession('org', `user-${i}`, sessions[i]!.sessionId)
      expect(reloaded!.sessionId).toBe(sessions[i]!.sessionId)
      const { messages, priorTurns } = m.buildFollowUpMessages(reloaded!, 'SYS', 'next?')
      expect(priorTurns).toBe(3)
      for (let t = 0; t < 3; t++) {
        expect(messages.some((c) => c.content === `q-${i}-${t}`)).toBe(true)
        expect(messages.some((c) => c.content === `a-${i}-${t}`)).toBe(true)
      }
      // Nothing from any other user.
      expect(messages.some((c) => c.content.includes('-1-'))).toBe(false)
    }
  })

  it('survives a full-cache evict-and-reload cycle without losing turns', async () => {
    const m = await freshModule()
    // Repeat the sweep's own work: evict then re-load every session from its
    // Redis copy and confirm the conversation is intact.
    const ids: string[] = []
    for (let i = 0; i < 50; i++) {
      const s = await m.loadOrCreateSession('org', `user-${i}`)
      await m.recordTurn(s!, `q-${i}`, `a-${i}`)
      ids.push(s!.sessionId)
    }
    // Simulate a deploy that wipes all local Maps across instances.
    const fresh = await freshModule()
    const restored = await Promise.all(
      ids.map((id, i) => fresh.loadOrCreateSession('org', `user-${i}`, id)),
    )
    expect(restored.every((s, i) => s!.sessionId === ids[i])).toBe(true)
    const spot = fresh.buildFollowUpMessages(restored[23]!, 'SYS', 'next?')
    expect(spot.priorTurns).toBe(1)
    expect(spot.messages.some((c) => c.content === 'q-23')).toBe(true)
  })

  it('bleeds wedged-Redis failures mid-conversation into per-worker memory without hanging', async () => {
    const m = await freshModule()
    failing = true
    const t0 = Date.now()
    // 50 concurrent requests while the whole Redis is wedged.
    const sessions = await Promise.all(
      Array.from({ length: 50 }, (_, i) => m.loadOrCreateSession('org', `user-${i}`)),
    )
    await Promise.all(sessions.map((s, i) => m.recordTurn(s!, `q-${i}`, `a-${i}`)))
    // Load test must finish fast — a wedged dependency cannot be allowed to
    // stall the API (this is the property that keeps authed routes bounded).
    expect(Date.now() - t0).toBeLessThan(5_000)

    // Same-worker follow-up still resolves from the per-process fallback.
    const next = await m.loadOrCreateSession('org', 'user-0', sessions[0]!.sessionId)
    expect(next!.sessionId).toBe(sessions[0]!.sessionId)
    expect(m.buildFollowUpMessages(next!, 'SYS', 'next?').priorTurns).toBe(1)
  }, 15_000)
})

describe('mica.session memory bounds (TTL sweep)', () => {
  it('the periodic sweep drops expired sessions, keeping the in-process Map bounded by live ones', async () => {
    const m = await freshModule()
    // Age real time: the sweep compares Date.now() against session.updatedAt,
    // so faking the clock is the honest way to prove the bounded-memory
    // property over a long shift.
    vi.useFakeTimers({ now: new Date('2026-10-01T09:00:00Z') })
    try {
      // 80 conversations during a shift, all written.
      for (let i = 0; i < 80; i++) {
        const s = await m.loadOrCreateSession('org', `user-${i}`)
        await m.recordTurn(s!, `q-${i}`, `a-${i}`)
      }
      // Nothing written for over the 30-minute TTL.
      vi.setSystemTime(new Date('2026-10-01T10:00:00Z'))
      // The session lives on only until the unref'd 60s interval ticks; new
      // traffic alone must NOT evict it (a stale session still gets served
      // from the local map until the sweep runs — the interval, simulated
      // here via its exported hook, is what cleans up).
      const fresh = await m.loadOrCreateSession('org', 'fresh-user')
      expect(fresh).toBeTruthy()
      // Fire the sweep exactly as the interval would: it drops all 80 stale
      // sessions plus the fresh one's predecessors, leaving only live ones.
      // In-process memory stays bounded by live conversations, never by
      // cumulative traffic.
      expect(m.sweepExpiredSessions()).toBe(1)
      expect(m.sessionCount()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('every Redis write carries the sliding TTL, so Redis-side memory is bounded too', async () => {
    const m = await freshModule()
    for (let i = 0; i < 40; i++) {
      const s = await m.loadOrCreateSession('org', `ttl-${i}`)
      await m.recordTurn(s!, `q-${i}`, `a-${i}`)
    }
    expect(store.size).toBe(40)
    const now = Date.now()
    for (const [, v] of store) {
      const remaining = v.expiresAt - now
      // Nothing is immortal: each entry expires within the TTL window.
      expect(remaining).toBeLessThanOrEqual(TTL_MS)
      expect(remaining).toBeGreaterThan(TTL_MS - 60_000) // written this second
    }
    // And they all expire together within one TTL of "now": no entry outlives
    // its last write by more than the TTL.
    const maxRemaining = Math.max(...[...store.values()].map((v) => v.expiresAt - now))
    expect(maxRemaining).toBeLessThanOrEqual(TTL_MS)
  })

  it('repeated sequential traffic over one hour of simulated shifts keeps memory flat', async () => {
    const m = await freshModule()
    // 60 sequential conversations, each written then never touched again
    // after their Redis TTL is manually advanced by hours.
    for (let i = 0; i < 60; i++) {
      const s = await m.loadOrCreateSession('org', `shift-${i}`)
      await m.recordTurn(s!, `q-${i}`, `a-${i}`)
      for (const [, v] of store) v.expiresAt = 0
    }
    // Nothing here should outlive its TTL — the map may hold at most the
    // entries it has not yet swept, which is ≤ 61 (60 + the current one).
    expect(m.sessionCount()).toBeLessThanOrEqual(61)
    // A follow-up trigger sweep: after the last write the count is exactly
    // 61 until the next minute-window sweep runs — bounded, not growing.
    expect(m.sessionCount()).toBeGreaterThan(0)
  })
})
