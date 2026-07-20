import { describe, it, expect } from 'vitest';

describe('Redis client', () => {
  it('should return null when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const { getRedisClient } = await import('./index');
    const client = await getRedisClient();
    expect(client).toBeNull();
  });
});
