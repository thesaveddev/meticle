import crypto from 'crypto';
import logger from '../../shared/utils/logger';

/**
 * The Twilio REST call, dependency-free: one `fetch` POST of form-encoded
 * fields, so the product does not carry the Twilio SDK for a single endpoint.
 *
 * Delivery receipts arrive later through `POST /sms/status`, signed with the
 * same auth token — see `verifyTwilioSignature`. The queue only marks a row
 * `sent` here; `delivered`/`undelivered` is the webhook's verdict.
 */

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TwilioError';
    this.status = status;
    // 5xx and network failures may succeed on retry; 4xx (bad number,
    // unverified trial sender, unknown SID) will fail the same way again.
    this.code = status >= 500 ? 'ETWILIO_SERVER' : 'ETWILIO_REJECTED';
  }
}

export async function sendViaTwilio(
  creds: TwilioCredentials,
  args: { to: string; body: string; statusCallbackUrl?: string },
): Promise<{ sid: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const form = new URLSearchParams({ To: args.to, From: creds.fromNumber, Body: args.body });
  if (args.statusCallbackUrl) form.set('StatusCallback', args.statusCallbackUrl);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (err: any) {
    throw new TwilioError(`Twilio request failed: ${err?.message || 'network error'}`, 0);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn({ status: res.status, detail: detail.slice(0, 500) }, 'Twilio rejected an SMS send');
    throw new TwilioError(`Twilio rejected the message (HTTP ${res.status})`, res.status);
  }
  const data = (await res.json()) as { sid?: string };
  if (!data?.sid) throw new TwilioError('Twilio answered without a message SID', res.status);
  return { sid: data.sid };
}

/**
 * Twilio signs a callback as base64(HMAC-SHA1(authToken, url + sorted
 * key+value concatenation)). The URL must be byte-identical to the one Twilio
 * called — including the `?org=` query the queue appends — which is why the
 * verifier takes the URL we configured rather than reconstructing it from the
 * request (a proxy's hostname is not Twilio's hostname).
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
