import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../redis';

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();
const CLEANUP_INTERVAL = 60_000;
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryStore) {
    if (value.resetAt < now) inMemoryStore.delete(key);
  }
}, CLEANUP_INTERVAL);
cleanup.unref();

type RedisResult = 'ok' | 'reject' | null;

async function redisCheck(windowMs: number, key: string, maxRequests: number): Promise<RedisResult> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const multi = client.multi();
    multi.incr(key);
    multi.pTTL(key);
    const [count, ttl] = await multi.exec() as [number, number];
    if (ttl < 0) await client.pExpire(key, windowMs);
    return count > maxRequests ? 'reject' : 'ok';
  } catch {
    return null;
  }
}

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `rl:${req.ip}:${req.path}`;
    const now = Date.now();

    // Seconds until this window resets, for `Retry-After`. Rounded up and
    // floored at 1 so a client is never told to retry after zero seconds.
    const retryAfter = (resetAt: number) => Math.max(1, Math.ceil((resetAt - now) / 1000));

    const tooManyRequests = (resetAt: number) => res.status(429)
      .set('Retry-After', String(retryAfter(resetAt)))
      .json({
        statusCode: 429,
        message: 'Too many requests. Please wait a moment and try again.',
        retryAfterSeconds: retryAfter(resetAt),
      });

    const redisResult = await redisCheck(windowMs, key, maxRequests);
    if (redisResult === 'ok') return next();
    if (redisResult === 'reject') {
      // Redis holds the authoritative window, so read it back for a truthful
      // `Retry-After` rather than guessing at a fresh window's length.
      let resetAt = now + windowMs;
      try {
        const client = await getRedisClient();
        const ttl = client ? await client.pTTL(key) : -1;
        if (ttl > 0) resetAt = now + ttl;
      } catch {
        // Fall back to the window length above; an approximate hint is better
        // than none.
      }
      return tooManyRequests(resetAt);
    }

    const record = inMemoryStore.get(key);
    if (!record || record.resetAt < now) {
      inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      return tooManyRequests(record.resetAt);
    }
    record.count++;
    next();
  };
};
