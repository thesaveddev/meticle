import { createHmac, timingSafeEqual } from 'crypto';
import { query } from '../database';
import { EMAIL_BRAND } from './email.template';
import logger from './logger';

/**
 * The way out of an email that is not a transaction.
 *
 * A password reset, a receipt, an invoice and the statutory DBS retention notice
 * are messages the recipient is entitled to; there is nothing to unsubscribe
 * from, and offering one would be a lie. A digest, a shift reminder, a survey
 * invite or a winback note is different: PECR requires a way to stop it that does
 * not depend on remembering a password, and a bulk sender has to let a mail
 * client do it with one POST (RFC 8058).
 *
 * Three decisions are deliberate:
 *
 *  * **The token is signed, not stored.** It carries the address and the scope and
 *    an HMAC over both, so a link keeps working after the user row is gone — which
 *    is exactly when a leaver is most likely to use it — and there is no table of
 *    live tokens to expire. A tampered token is refused rather than honoured for
 *    whatever address it names.
 *  * **The opt-out is keyed on the address.** Email is the one identity the
 *    recipient is guaranteed to still have; a user id would not survive the account
 *    being deleted, and the address is what the sender actually has when it enqueues.
 *  * **Silence is never the failure mode.** If the signing secret is missing, the
 *    message still goes out without a link rather than failing to send — but the
 *    absence is logged, because a marketing email without an unsubscribe is a
 *    compliance defect and should be visible on the first one, not discovered later.
 */

export type EmailUnsubscribeScope = 'marketing' | 'notifications';

export const EMAIL_UNSUBSCRIBE_SCOPES: readonly EmailUnsubscribeScope[] = ['marketing', 'notifications'];

const SCOPE_LABELS: Record<EmailUnsubscribeScope, string> = {
  marketing: 'product and billing update emails',
  notifications: 'notification, reminder and survey emails',
};

export function scopeLabel(scope: EmailUnsubscribeScope): string {
  return SCOPE_LABELS[scope];
}

function signingSecret(): string | null {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** The canonical address a token is about: trimmed and lowercased. */
function normaliseEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * A token for one address and one scope.
 *
 * Returns null rather than throwing when there is no secret: a mail that cannot
 * carry a working link is still better sent than lost, and the caller logs why.
 */
export function unsubscribeToken(email: string, scope: EmailUnsubscribeScope): string | null {
  const address = normaliseEmail(email);
  const secret = signingSecret();
  if (!address || !secret) {
    logger.error({ scope }, 'Email unsubscribe: no EMAIL_UNSUBSCRIBE_SECRET or JWT_SECRET — messages are going out without an unsubscribe link');
    return null;
  }
  const payload = `${scope}:${address}`;
  return `${scope}.${Buffer.from(address, 'utf8').toString('base64url')}.${sign(payload, secret)}`;
}

export interface UnsubscribeToken {
  email: string;
  scope: EmailUnsubscribeScope;
}

/** The address and scope a token names, or null when it is malformed or forged. */
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribeToken | null {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [scope, encoded, signature] = parts;
  if (!EMAIL_UNSUBSCRIBE_SCOPES.includes(scope as EmailUnsubscribeScope)) return null;
  let address: string;
  try {
    address = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  address = normaliseEmail(address);
  if (!address || !address.includes('@')) return null;
  const secret = signingSecret();
  if (!secret) return null;
  const expected = Buffer.from(sign(`${scope}:${address}`, secret), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { email: address, scope: scope as EmailUnsubscribeScope };
}

function frontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://meticlecare.com' : 'http://localhost:3000')
  ).replace(/\/+$/, '');
}

/**
 * Where the API answers, for the one endpoint that has to be reachable from
 * outside the browser.
 *
 * Explicit when the API is on its own hostname, and otherwise the app's own
 * origin under `/api` — which is where the web client already reaches it and
 * what nginx proxies to the service (it strips the prefix).
 */
export function apiBaseUrl(): string {
  const configured = process.env.PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${frontendBaseUrl()}/api`;
}

/** The page a recipient lands on: it states what will stop, then does it on confirm. */
export function unsubscribePageUrl(token: string): string {
  return `${frontendBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Where a mail client's own unsubscribe button sends its POST.
 *
 * RFC 8058 requires the URL in `List-Unsubscribe` to act on a POST by itself, and
 * that cannot be the page: the page is a static bundle, so the web server answers
 * a POST with the app shell and a 200 while nothing is recorded — the client tells
 * the recipient they are unsubscribed and the mail keeps arriving. The header
 * therefore points at the API, which is the only thing that can record the
 * opt-out.
 *
 * A GET of this URL describes the link and changes nothing, deliberately: a
 * scanner or a link preview follows URLs, and one that unsubscribed on fetch
 * would take people off the list who never asked.
 */
export function unsubscribeOneClickUrl(token: string): string {
  return `${apiBaseUrl()}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * The line at the bottom of a message, appended to whatever the template built.
 *
 * Appended rather than threaded through each builder: the shared footer is used by
 * every email including the transactional ones, and a template-by-template change
 * is exactly how one of them ends up without a link.
 */
export function appendUnsubscribeFooter(html: string, url: string, scope: EmailUnsubscribeScope): string {
  const why = scope === 'marketing'
    ? 'You are receiving this because you started a MeticleCare trial or subscription.'
    : 'You are receiving this because you have a MeticleCare account or were invited to share feedback.';
  const block = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td align="center" style="padding:20px 16px 0;font-size:12px;color:${EMAIL_BRAND.footerMuted};line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">\n${why}<br>\n<a href="${url.replace(/"/g, '&quot;')}" style="color:${EMAIL_BRAND.footerMuted};text-decoration:underline">Unsubscribe from ${SCOPE_LABELS[scope]}</a>\n</td></tr></table>`;
  if (!html.includes('</body>')) return `${html}${block}`;
  return html.replace('</body>', `${block}\n</body>`);
}

/**
 * The headers a mail client's own unsubscribe button needs.
 *
 * `List-Unsubscribe-Post` is what makes it one-click: the client POSTs to the URL
 * named in `List-Unsubscribe` and expects a 2xx without the recipient confirming
 * anything. The `mailto:` half gives a client that only understands email replies
 * a route that still works, even though it needs a human at this end.
 */
export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${oneClickUrl}>, <mailto:unsubscribe@meticlecare.com?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** True when this address has asked not to receive this kind of email. */
export async function isEmailOptedOut(email: string, scope: EmailUnsubscribeScope): Promise<boolean> {
  const address = normaliseEmail(email);
  if (!address) return false;
  const result = await query(
    'SELECT 1 FROM email_opt_outs WHERE lower(email) = $1 AND scope = $2 LIMIT 1',
    [address, scope],
  );
  return result.rows.length > 0;
}

/** Record the opt-out. Repeating it is the same opt-out, not an error. */
export async function recordEmailOptOut(input: {
  email: string;
  scope: EmailUnsubscribeScope;
  userId?: string | null;
  source?: 'link' | 'one-click' | 'admin';
}): Promise<void> {
  const address = normaliseEmail(input.email);
  if (!address) return;
  await query(
    `INSERT INTO email_opt_outs (email, scope, user_id, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email), scope) DO UPDATE SET email = EXCLUDED.email`,
    [address, input.scope, input.userId || null, input.source || 'link'],
  );
}
