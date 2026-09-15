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
    await client.set(`bl:${token}`, '1', { PX: Math.max(1, expiresInMs) });
    return;
  }
  inMemoryBlacklist.set(token, Date.now() + expiresInMs);
};

/**
 * Atomically claim a token before using it. This prevents two concurrent
 * refresh requests from both accepting the same refresh token.
 */
export const claimToken = async (token: string, expiresInMs: number): Promise<boolean> => {
  const client = await getRedisClient();
  if (client) {
    const result = await client.set(`bl:${token}`, '1', { PX: Math.max(1, expiresInMs), NX: true });
    return result === 'OK';
  }
  const now = Date.now();
  const expiresAt = inMemoryBlacklist.get(token);
  if (expiresAt && expiresAt > now) return false;
  inMemoryBlacklist.set(token, now + expiresInMs);
  return true;
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const client = await getRedisClient();
  if (client) {
    const result = await client.get(`bl:${token}`);
    return result === '1';
  }
  const expiresAt = inMemoryBlacklist.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    inMemoryBlacklist.delete(token);
    return false;
  }
  return true;
};
