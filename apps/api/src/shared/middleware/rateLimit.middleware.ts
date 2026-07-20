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

    const redisResult = await redisCheck(windowMs, key, maxRequests);
    if (redisResult === 'ok') return next();
    if (redisResult === 'reject') {
      return res.status(429).json({
        error: { message: 'Too many requests, please try again later', status: 429 }
      });
    }

    const record = inMemoryStore.get(key);
    if (!record || record.resetAt < now) {
      inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: { message: 'Too many requests, please try again later', status: 429 }
      });
    }
    record.count++;
    next();
  };
};
