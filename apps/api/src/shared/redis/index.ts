import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client?.isOpen) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    client = createClient({ url });
    client.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));
    await client.connect();
    return client;
  } catch {
    logger.warn('Redis unavailable, falling back to in-memory');
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.disconnect();
  client = null;
}

export async function isRedisAvailable(): Promise<boolean> {
  const c = await getRedisClient();
  return c !== null && c.isOpen;
}
