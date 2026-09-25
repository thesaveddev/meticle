import dns from 'dns';
import net from 'net';

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

/**
 * True for any address that would let a preview request reach the API host's
 * own network: loopback, RFC1918, link-local, carrier-grade NAT, and the IPv6
 * equivalents. Checked against the resolved address rather than the hostname
 * so a public name pointing at 127.0.0.1 is still refused.
 */
function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // IPv4-mapped addresses (::ffff:127.0.0.1) reach the same hosts as IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Not a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https links can be previewed');
  }
  const addresses = await dns.promises.lookup(parsed.hostname, { all: true });
  if (!addresses.length) throw new Error('Host could not be resolved');
  if (addresses.some(entry => isPrivateAddress(entry.address))) {
    throw new Error('Links to private network addresses cannot be previewed');
  }
  return parsed;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function metaContent(html: string, property: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i'
  );
  const match = html.match(pattern);
  const raw = (match?.[1] ?? match?.[2] ?? '').trim();
  return raw ? decodeEntities(raw).slice(0, 500) : '';
}

function titleTag(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).trim().slice(0, 300) : '';
}

/**
 * Fetches a public web page and returns its Open Graph metadata for display
 * beside a chat message. Every hop is re-validated so a redirect cannot walk
 * the request from the public internet into a private address, and the body is
 * read with a hard byte cap so a large page cannot exhaust memory.
 *
 * Returns null rather than throwing for anything unusable: a missing preview is
 * cosmetic, and the caller renders the plain link either way.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = await assertPublicUrl(currentUrl);
    } catch {
      return null;
    }

    let response: Response;
    try {
      response = await fetch(parsed, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'MeticleCare/1.0 (link preview)', Accept: 'text/html,*/*;q=0.8' },
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      currentUrl = new URL(location, parsed).toString();
      continue;
    }
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    let html = '';
    try {
      const reader = response.body?.getReader();
      if (!reader) return null;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        if (html.length > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    } catch {
      return null;
    }
    if (!html.trim()) return null;

    const title = metaContent(html, 'og:title') || titleTag(html);
    if (!title) return null;

    const image = metaContent(html, 'og:image');
    let resolvedImage = '';
    if (image) {
      try {
        resolvedImage = new URL(image, parsed).toString();
      } catch {
        resolvedImage = '';
      }
    }

    return {
      url: parsed.toString(),
      title,
      description: metaContent(html, 'og:description') || metaContent(html, 'description'),
      image: resolvedImage,
    };
  }
  return null;
}
