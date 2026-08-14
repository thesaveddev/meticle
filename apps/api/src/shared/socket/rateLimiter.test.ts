import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkConnectionLimit, checkEventLimit } from './rateLimiter'

vi.mock('../redis', () => ({
  getRedisClient: async () => null, // force the in-memory fallback path
}))

beforeEach(async () => {
  // Reset in-memory state between tests by using fresh keys
})

describe('socket rateLimiter (in-memory fallback)', () => {
  it('allows connections under the limit', async () => {
    expect(await checkConnectionLimit('test-ip-1')).toBe(false)
    expect(await checkConnectionLimit('test-ip-1')).toBe(false)
  })

  it('rejects once the connection limit is exceeded', async () => {
    const key = `conn-${Date.now()}`
    let rejected = false
    for (let i = 0; i < 150; i++) {
      const blocked = await checkConnectionLimit(key)
      if (blocked) { rejected = true; break }
    }
    expect(rejected).toBe(true)
  })

  it('tracks connection limits per key independently', async () => {
    const keyA = `connA-${Date.now()}`
    const keyB = `connB-${Date.now()}`
    let aBlocked = false
    for (let i = 0; i < 150; i++) {
      if (await checkConnectionLimit(keyA)) { aBlocked = true; break }
    }
    expect(aBlocked).toBe(true)
    expect(await checkConnectionLimit(keyB)).toBe(false)
  })

  it('allows events under the limit', async () => {
    expect(await checkEventLimit('user-1')).toBe(false)
    expect(await checkEventLimit('user-1')).toBe(false)
  })

  it('rejects once the event limit is exceeded', async () => {
    const userId = `evt-${Date.now()}`
    let rejected = false
    for (let i = 0; i < 400; i++) {
      if (await checkEventLimit(userId)) { rejected = true; break }
    }
    expect(rejected).toBe(true)
  })

  it('reports a full count when blocked', async () => {
    const key = `exact-${Date.now()}`
    // 101st connection within the window should trip the 100/min default
    let blocked = false
    for (let i = 0; i < 101; i++) {
      blocked = await checkConnectionLimit(key)
    }
    expect(blocked).toBe(true)
  })
})
