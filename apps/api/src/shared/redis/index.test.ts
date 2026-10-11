import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Each test gets a fresh module instance so the module-level client/down-until
 * state never leaks between cases, and REDIS_URL is restored afterwards so
 * other suites that do want a live redis keep seeing it.
 */
async function freshImport() {
  vi.resetModules();
  return import('./index');
}

const ORIGINAL_URL = process.env.REDIS_URL;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_URL;
});

describe('Redis client', () => {
  it('should return null when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const { getRedisClient } = await freshImport();
    const client = await getRedisClient();
    expect(client).toBeNull();
  });

  it('should fall back to null within the connect budget when REDIS_URL points at a dead host', async () => {
    // Non-routable address: TCP connect hangs until our timeout fires, which is
    // exactly the failure mode that used to leave authenticated routes hanging.
    process.env.REDIS_URL = 'redis://10.255.255.1:6379';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '300';
    const { getRedisClient } = await freshImport();
    const start = Date.now();
    const client = await getRedisClient();
    const elapsed = Date.now() - start;
    expect(client).toBeNull();
    expect(elapsed).toBeLessThan(5_000); // generous CI margin around the 300ms budget
  });

  it('should not redial during the cooldown after a failed connect', async () => {
    process.env.REDIS_URL = 'redis://10.255.255.1:6379';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '200';
    const { getRedisClient } = await freshImport();
    const first = await getRedisClient();
    expect(first).toBeNull();
    // Second request inside the 30s cooldown must return null immediately —
    // no second connect attempt — so authed routes don't pay the timeout again.
    const start = Date.now();
    const second = await getRedisClient();
    expect(second).toBeNull();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('should allow retries again once the cooldown has passed', async () => {
    process.env.REDIS_URL = 'redis://10.255.255.1:6379';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '200';
    const { getRedisClient, _setCooldownForTest } = await freshImport();
    expect(await getRedisClient()).toBeNull();
    // Jump past the cooldown and confirm a real attempt is made again (it will
    // fail again at a dead host, but the timeout — not the cooldown — now
    // governs the call duration).
    _setCooldownForTest(0);
    const start = Date.now();
    await getRedisClient();
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
  });
});
