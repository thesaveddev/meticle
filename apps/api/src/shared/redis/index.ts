import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

let client: RedisClientType | null = null;
/**
 * Remember that Redis is down so a dead REDIS_URL degrades to a *logged* refusal
 * instead of a per-request TCP retry storm: every route in the request path
 * (token blacklist on both JWT middlewares, every rate limit, socket auth)
 * calls getRedisClient(), so an unthrottled reconnect loop would re-attempt a
 * TCP handshake on each request. Cleanup re-enables real retries periodically,
 * so a Redis recovery is picked up without restarting the process.
 */
let redisDownUntil = 0;

/**
 * How long a single connect attempt may take before we give up. connectTimeout
 * alone is not enough: the OS's own TCP timeout on a silently dropping host
 * (VPN, firewalled cloud node) can exceed any sane budget, and node-redis
 * queues operations sent while offline (`disableOfflineQueue: false` is the
 * default) forever — an authenticated route would hang on its rate-limit lookup
 * for that entire lifetime.
 */
const CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 3_000;
/** Cooldown before we try Redis again after a failed attempt. */
const RETRY_BACKOFF_MS = 30_000;

/**
 * Returns the shared Redis client, or null when Redis is unavailable — callers
 * then use their in-memory fallback. Always resolves quickly: a connection
 * attempt is bounded by CONNECT_TIMEOUT_MS, and once an attempt has failed no
 * new TCP dial is made for RETRY_BACKOFF_MS (null is returned immediately
 * instead, so authenticated routes stay fast on the fallback path).
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client?.isOpen) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const now = Date.now();
  if (now < redisDownUntil) return null;
  try {
    client = createClient({
      url,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        // Default reconnectStrategy retries forever with exponential backoff;
        // false stops after the first failure so the timeout actually delivers
        // a rejected promise instead of a permanently pending one.
        reconnectStrategy: false as const,
      },
    });
    client.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));
    // Belt and braces: the socket timeout governs the TCP handshake, but the
    // default offline queue (disableOfflineQueue is false) would swallow the
    // result of connect if the command is issued after a state change — keep
    // an absolute guard so getRedisClient can never exceed the budget.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Redis connect timed out after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS);
      client!.connect()
        .then(() => { clearTimeout(timer); resolve(); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
    return client;
  } catch (err) {
    redisDownUntil = now + RETRY_BACKOFF_MS;
    await teardownFailedClient();
    logger.warn({ err: (err as Error).message }, 'Redis unavailable, falling back to in-memory');
    return null;
  }
}

/**
 * Never reuse a failed client object: node-redis keeps it in an error state
 * after a failed connect and a fresh attempt must create a new one (otherwise
 * the next getRedisClient call would see `client` non-null and skip the try).
 */
async function teardownFailedClient(): Promise<void> {
  const failed = client;
  client = null;
  if (failed?.isOpen) await failed.disconnect().catch(() => undefined);
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.disconnect();
  client = null;
}

export async function isRedisAvailable(): Promise<boolean> {
  const c = await getRedisClient();
  return c !== null && c.isOpen;
}

/** Test hook: force the failed-connect cooldown to a known value (tests only —
 * not part of the runtime surface). */
export function _setCooldownForTest(untilMs: number): void {
  redisDownUntil = untilMs;
}
