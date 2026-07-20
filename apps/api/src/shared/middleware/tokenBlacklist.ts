import { getRedisClient } from '../redis';

const inMemoryBlacklist = new Map<string, number>();
const CLEANUP_INTERVAL = 60_000;
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of inMemoryBlacklist) {
    if (expiresAt < now) inMemoryBlacklist.delete(key);
  }
}, CLEANUP_INTERVAL);
cleanup.unref();

export const blacklistToken = async (token: string, expiresInMs: number): Promise<void> => {
  const client = await getRedisClient();
  if (client) {
    await client.set(`bl:${token}`, '1', { PX: expiresInMs });
    return;
  }
  inMemoryBlacklist.set(token, Date.now() + expiresInMs);
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const client = await getRedisClient();
  if (client) {
    const result = await client.get(`bl:${token}`);
    return result === '1';
  }
  return inMemoryBlacklist.has(token);
};
