import { getRedisClient } from '../redis';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryConn = new Map<string, RateLimitEntry>();
const inMemoryEvt = new Map<string, RateLimitEntry>();

const CONNECTION_WINDOW_MS = 60_000;
const EVENT_WINDOW_MS = 60_000;

// Configurable via env so ops can tune per deployment without code changes.
const CONNECTION_MAX = parseInt(process.env.SOCKET_CONNECTION_LIMIT || '100', 10);
const EVENT_MAX = parseInt(process.env.SOCKET_EVENT_LIMIT || '300', 10);

// Periodic cleanup to prevent memory leaks (unref'd so it never keeps the process alive)
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryConn) {
    if (now > entry.resetAt) inMemoryConn.delete(key);
  }
  for (const [key, entry] of inMemoryEvt) {
    if (now > entry.resetAt) inMemoryEvt.delete(key);
  }
}, 120_000);
cleanup.unref();

type RedisResult = 'ok' | 'reject' | null;

async function redisCheck(key: string, max: number, windowMs: number): Promise<RedisResult> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const multi = client.multi();
    multi.incr(key);
    multi.pTTL(key);
    const [count, ttl] = await multi.exec() as [number, number];
    if (ttl < 0) await client.pExpire(key, windowMs);
    return count > max ? 'reject' : 'ok';
  } catch {
    return null;
  }
}

function inMemoryCheck(store: Map<string, RateLimitEntry>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

export async function checkConnectionLimit(key: string): Promise<boolean> {
  const redisResult = await redisCheck(`sio:conn:${key}`, CONNECTION_MAX, CONNECTION_WINDOW_MS);
  if (redisResult === 'reject') return true;
  if (redisResult === 'ok') return false;
  return inMemoryCheck(inMemoryConn, key, CONNECTION_MAX, CONNECTION_WINDOW_MS);
}

export async function checkEventLimit(userId: string): Promise<boolean> {
  const redisResult = await redisCheck(`sio:evt:${userId}`, EVENT_MAX, EVENT_WINDOW_MS);
  if (redisResult === 'reject') return true;
  if (redisResult === 'ok') return false;
  return inMemoryCheck(inMemoryEvt, userId, EVENT_MAX, EVENT_WINDOW_MS);
}
