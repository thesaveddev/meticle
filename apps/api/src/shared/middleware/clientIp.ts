import { Request } from 'express';

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+(?:%[0-9a-zA-Z._-]+)?$/;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  // A well-formed sender transmits one address. If a list arrives, only the
  // first entry could be the sender's value — and a client can write anything
  // there, so it still has to pass the shape check below before it is used.
  if (v.includes(',')) v = v.split(',')[0].trim();
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).trim();
  if (!v || v.length > 64) return null;
  if (IPV4.test(v)) {
    const octets = v.split('.').map(Number);
    if (octets.every((n) => n >= 0 && n <= 255)) return v;
    return null;
  }
  if (v.includes(':') && IPV6.test(v)) return v.toLowerCase();
  return null;
}

/**
 * The client address to key per-IP limits on.
 *
 * Cloudflare sets `CF-Connecting-IP` from the connecting socket, overwriting
 * any value the client sent, so it names the real device even when the
 * request passed through several proxies. `req.ip` cannot do that here: the
 * app trusts one proxy hop (`trust proxy, 1` in `index.ts`) but the request
 * has already passed through Cloudflare, the host reverse proxy and the web
 * container's nginx, so `req.ip` resolves to the same host-side address for
 * every user. Keying the login limit on it turned 10 attempts per IP per 15
 * minutes into 10 attempts per 15 minutes for the whole site — the eleventh
 * person to press "Sign in" was told to wait, no matter who they were.
 *
 * Anything that is not a plausible address is ignored and `req.ip` is used,
 * so a forged or malformed header can only ever fall back to the previous
 * behaviour, never to an unbounded set of buckets.
 */
export function getClientIp(req: Request): string {
  return clean(req.headers?.['cf-connecting-ip']) ?? req.ip ?? 'unknown';
}
