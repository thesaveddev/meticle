import { createHmac, timingSafeEqual } from 'crypto'
import { getDb } from '../db/database'

/**
 * The way out of an outbound marketing email.
 *
 * This tool emails care providers who never asked to hear from us: the address
 * came off a public register, not a signup form. Under PECR every such message
 * has to carry an unsubscribe facility that works without a reply, and the
 * recipient's objection has to be honoured from the moment it is made — so the
 * link is not optional decoration on these templates, it is the condition on
 * which sending them at all is lawful.
 *
 * Two decisions are deliberate:
 *
 *  * **The link is signed, per lead.** An unsigned `/u/:id` lets anybody stop
 *    mail to anybody by counting upwards, and a lead id is not a secret. The
 *    signature is an HMAC over the id, so the only links that exist are the ones
 *    this tool minted.
 *  * **The opt-out is the lead row.** There is no separate suppression table: the
 *    address lives in `leads`, so `leads.unsubscribed_at` is the one place every
 *    sender already looks. A suppression list that a campaign forgets to consult
 *    is the classic way this goes wrong.
 *
 * If no secret is configured the link is still sent, unsigned, and the route
 * accepts it. A marketing email with no way out is a compliance defect; an
 * unsigned way out is merely a nuisance someone could cause for us. Refusing to
 * send would be this module making a business decision it was not asked to make,
 * and it would fail silently at campaign time — so the condition is logged
 * loudly instead.
 */

function secret(): string | null {
  return process.env.MARKETING_UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || null
}

let warnedAboutMissingSecret = false

function signature(leadId: number): string | null {
  const key = secret()
  if (!key) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true
      console.error(
        'Marketing email: no MARKETING_UNSUBSCRIBE_SECRET or JWT_SECRET — unsubscribe links go out unsigned and will be accepted unsigned.',
      )
    }
    return null
  }
  return createHmac('sha256', key).update(String(leadId)).digest('base64url')
}

function baseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL || process.env.TRACKING_BASE_URL
  if (configured) return configured.replace(/\/+$/, '')
  return `http://localhost:${process.env.PORT || '3005'}`
}

/** The URL that stops the mail: a page for a person, a 2xx for a mail client. */
export function unsubscribeUrl(leadId: number | string): string {
  const id = Number(leadId)
  const sig = signature(id)
  return `${baseUrl()}/u/${id}${sig ? `?sig=${encodeURIComponent(sig)}` : ''}`
}

/** True when the signature is the one this deployment would have minted. */
export function verifyUnsubscribeSignature(leadId: number | string, sig: string | null | undefined): boolean {
  const expected = signature(Number(leadId))
  // No secret: nothing to verify against, and the unsigned link is the only one
  // that exists. Already logged by `signature`.
  if (!expected) return true
  const given = String(sig || '')
  if (!given) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(given, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** True when this lead has already asked us to stop. */
export function isUnsubscribed(leadId: number | string): boolean {
  const row = getDb()
    .prepare('SELECT unsubscribed_at FROM leads WHERE id = ?')
    .get(Number(leadId)) as { unsubscribed_at?: string | null } | undefined
  return Boolean(row?.unsubscribed_at)
}

/**
 * Record the opt-out, and stop the follow-up sequence with it.
 *
 * The business status is left alone on purpose: "lost" and "unsubscribed" are
 * different facts about a lead, and overwriting one with the other would hide
 * what happened. `next_followup` is cleared because a scheduled follow-up to
 * somebody who has just opted out is exactly the message that must not go.
 */
export function recordUnsubscribe(leadId: number | string): void {
  const id = Number(leadId)
  const db = getDb()
  db.prepare(
    `UPDATE leads SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')),
       next_followup = NULL, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(id)
  db.prepare(
    `INSERT INTO email_logs (lead_id, template_name, subject, status) VALUES (?, 'unsubscribe', 'Unsubscribed', 'unsubscribed')`,
  ).run(id)
}

const FOOTER_COLOR = '#7A8798'

/**
 * The line appended to every outbound message.
 *
 * Appended centrally by the sender rather than written into each template: a
 * template-by-template change is how one of them ends up without a link, and the
 * template that loses it is the one nobody re-reads.
 *
 * The provider name is passed in rather than written as a `{{placeholder}}`,
 * because the footer is added *after* the template is rendered — a placeholder
 * here would reach the recipient as the literal text `{{provider_name}}`.
 */
export function appendUnsubscribeFooter(html: string, url: string, providerName?: string | null): string {
  const safeUrl = url.replace(/"/g, '&quot;')
  const safeName = String(providerName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const who = safeName ? `<strong>${safeName}</strong>` : 'this provider'
  const block =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin-top:24px">` +
    `<tr><td style="border-top:1px solid #E6E1D7;padding-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${FOOTER_COLOR}">` +
    `You are receiving this because Meticle Care contacted ${who} at its published address about compliance software. ` +
    `<a href="${safeUrl}" style="color:${FOOTER_COLOR};text-decoration:underline">Unsubscribe</a> and we will not email you again.` +
    `</td></tr></table>`
  return html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : `${html}${block}`
}

/**
 * The headers a mail client's own unsubscribe button needs (RFC 8058).
 *
 * The URL has to accept a POST and act on it, which is why it is the same route
 * the footer links to: that route both renders the page and records the opt-out,
 * so a client's POST and a person's click land in the same place.
 */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
