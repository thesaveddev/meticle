interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const connectionLimits = new Map<string, RateLimitEntry>();
const eventLimits = new Map<string, RateLimitEntry>();

const CONNECTION_WINDOW_MS = 60_000;
const CONNECTION_MAX = 20;
const EVENT_WINDOW_MS = 60_000;
const EVENT_MAX = 120;

function isRateLimited(store: Map<string, RateLimitEntry>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  if (entry.count > max) return true;
  return false;
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of connectionLimits) {
    if (now > entry.resetAt) connectionLimits.delete(key);
  }
  for (const [key, entry] of eventLimits) {
    if (now > entry.resetAt) eventLimits.delete(key);
  }
}, 120_000);

export function checkConnectionLimit(ip: string): boolean {
  return isRateLimited(connectionLimits, ip, CONNECTION_MAX, CONNECTION_WINDOW_MS);
}

export function checkEventLimit(userId: string): boolean {
  return isRateLimited(eventLimits, userId, EVENT_MAX, EVENT_WINDOW_MS);
}
