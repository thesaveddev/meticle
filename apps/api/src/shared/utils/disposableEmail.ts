import dns from 'node:dns/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import disposableDomains from 'disposable-email-domains';

// Well-known temporary/throwaway email providers missing from the
// `disposable-email-domains` package snapshot (verified 2026-08-01).
const EXTRA_DOMAINS = [
  'tempmail.com',
  'tempmail.net',
  'tempmail.live',
  'tempmail.email',
  'tempmail.info',
  'temp-mail.io',
  'temp-mail.plus',
  'tmpmail.com',
  'tmpmail.top',
  'tempmailo.org',
  'mailtemp.net',
  'mailtemp.org',
  'throwaway.email',
  'throwaway.co.za',
  'mailinator.io',
  'mailinator4.com',
  'mailinator5.com',
  'mailinator6.com',
  'mailinator7.com',
  'mailinator8.com',
  'mailinator9.com',
  'mailinator10.com',
  '10minutemail.org',
  '10minutemail.info',
  'dondim.com',
  'figjs.com',
  'muyemail.com',
  'omail.pro',
  'ror15.com',
  'toshijo.com',
  'thanksno.com',
  'ukhks.com',
  'uppit.com',
  'xobmail.com',
  'zdbk.net',
  'temporarymail.com',
  'maildax.com',
  'mailowz.com',
  'bumpme.org',
  'kuku.co',
  'dzinefail.com',
  'ht.cx',
  'junk.to',
  'netzid.de',
  'nube.com',
  'tmailor.com',
  'tfbnw.net',
] as const;

const domainSet = new Set<string>([...(disposableDomains as string[]), ...EXTRA_DOMAINS]);

const kRefreshUrl = 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt';

let _lastRefresh: Date | null = null;

/**
 * Fetch the maintained disposable-email-domains list (updated every 24h) and
 * merge into the in-memory domain set. Runs at startup and every 24h
 * thereafter. Fails open — on any error the existing set is unchanged.
 */
export async function refreshDisposableEmailBlocklist(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(kRefreshUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const text = await res.text();
    const added: string[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().toLowerCase();
      if (!line || line.startsWith('#')) continue;
      if (!domainSet.has(line)) added.push(line);
      domainSet.add(line);
    }
    _lastRefresh = new Date();
    // eslint-disable-next-line no-console
    console.log(`[disposableEmail] refreshed blocklist: ${added.length} new domains (total ${domainSet.size})`);
  } catch {
    // fail open — keep existing set
  }
}

export function blocklistLastRefresh(): Date | null { return _lastRefresh; }
export function blocklistSize(): number { return domainSet.size; }

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return domainSet.has(domain);
}

/** Registrable parent of an MX host (last two labels). */
function registrableDomain(host: string): string {
  const parts = host.split('.');
  return parts.slice(-2).join('.');
}

export function mxHostIsDisposable(host: string): boolean {
  const clean = host.replace(/\.$/, '').toLowerCase();
  if (!clean) return false;
  return domainSet.has(registrableDomain(clean));
}

/**
 * Some temp-mail providers rotate random domains (e.g. 10minutemail) that are
 * too new to appear in any static blocklist. These domains still route mail
 * through the provider's own MX host (e.g. prd-smtp.10minutemail.com), whose
 * parent domain IS in the blocklist. Check the domain's MX records for that
 * fingerprint. Fails open if DNS is unavailable so real signups aren't blocked.
 */
export const _resolveMx = dns.resolveMx.bind(dns) as typeof dns.resolveMx;

export async function isDisposableEmailByMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  try {
    const mxs = await Promise.race([
      _resolveMx(domain),
      sleep(3000).then(() => {
        throw new Error('dns-timeout');
      }),
    ]);
    for (const mx of mxs) {
      if (mxHostIsDisposable(mx.exchange)) return true;
    }
  } catch {
    // fail open
  }
  return false;
}
