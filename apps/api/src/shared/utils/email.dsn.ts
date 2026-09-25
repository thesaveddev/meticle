import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import { migratePool } from '../database';

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export const emailDsnPayloadSchema = z.object({
  event_id: z.string().trim().min(1).max(255),
  dsn_id: z.string().uuid(),
  status: z.enum(['delivered', 'delayed', 'bounced']),
  recipient: z.string().trim().email().max(255),
  diagnostic: z.string().trim().max(2000).optional(),
});

export type EmailDsnPayload = z.infer<typeof emailDsnPayloadSchema>;

export function verifyEmailDsnSignature(
  rawBody: Buffer,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!timestamp || !signature || !secret || !/^\d{10}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) return false;

  const suppliedSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const supplied = Buffer.from(suppliedSignature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function signEmailDsnPayload(rawBody: Buffer, timestamp: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex')}`;
}

export async function processEmailDsnWebhook(rawBody: unknown, timestamp: string | undefined, signature: string | undefined) {
  const secret = process.env.EMAIL_DSN_WEBHOOK_SECRET;
  if (!secret) throw new AppError(503, 'SMTP DSN callback is not configured');
  if (!Buffer.isBuffer(rawBody)) throw new AppError(400, 'Expected an unmodified JSON request body');
  if (!verifyEmailDsnSignature(rawBody, timestamp, signature, secret)) {
    throw new AppError(401, 'Invalid SMTP DSN callback signature');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody.toString('utf8')); }
  catch { throw new AppError(400, 'Invalid SMTP DSN callback JSON'); }
  const payload = emailDsnPayloadSchema.safeParse(parsed);
  if (!payload.success) throw new AppError(400, 'Invalid SMTP DSN callback payload');
  return applyEmailDsn(payload.data);
}

export async function applyEmailDsn(payload: EmailDsnPayload) {
  const client = await migratePool.connect();
  try {
    await client.query('BEGIN');
    const queueResult = await client.query(
      `SELECT id, to_email, dsn_requested, last_dsn_status, organization_id, created_by FROM email_queue WHERE dsn_id = $1 FOR UPDATE`,
      [payload.dsn_id],
    );
    const queued = queueResult.rows[0];
    if (!queued || !queued.dsn_requested || queued.to_email.toLowerCase() !== payload.recipient.toLowerCase()) {
      await client.query('ROLLBACK');
      return { matched: false, duplicate: false, invoiceUpdated: false };
    }

    await client.query(
      `SELECT set_config('app.current_org_id', COALESCE($1::text, ''), true),
              set_config('app.current_user_id', COALESCE($2::text, ''), true)`,
      [queued.organization_id || null, queued.created_by || null],
    );

    const inserted = await client.query(
      `INSERT INTO email_dsn_events (event_id, dsn_id, queue_id, status, recipient, diagnostic)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [payload.event_id, payload.dsn_id, queued.id, payload.status, payload.recipient, payload.diagnostic || null],
    );
    if (!inserted.rows.length) {
      await client.query('COMMIT');
      return { matched: true, duplicate: true, invoiceUpdated: false };
    }

    // A delivery or bounce report is terminal for this queue item. A late,
    // contradictory DSN must not overwrite the first terminal result.
    if (queued.last_dsn_status === 'delivered' || queued.last_dsn_status === 'bounced') {
      await client.query('COMMIT');
      return { matched: true, duplicate: false, invoiceUpdated: false };
    }

    await client.query(
      `UPDATE email_queue SET
         last_dsn_status = $1::varchar,
         last_dsn_diagnostic = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE last_dsn_diagnostic END,
         delivered_at = CASE WHEN $1::text = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
         bounced_at = CASE WHEN $1::text = 'bounced' THEN COALESCE(bounced_at, NOW()) ELSE bounced_at END,
         status = CASE WHEN $1::text = 'bounced' THEN 'failed' ELSE status END,
         error_message = CASE WHEN $1::text = 'bounced' THEN COALESCE($2::text, 'SMTP delivery failure reported by DSN') ELSE error_message END
       WHERE id = $3`,
      [payload.status, payload.diagnostic || null, queued.id],
    );

    const invoiceResult = await client.query(
      `UPDATE homecare_client_billing_invoices SET
         delivery_status = CASE
           WHEN delivery_status IN ('delivered','bounced') THEN delivery_status
           ELSE $1::varchar
         END,
         delivery_diagnostic = CASE WHEN $1::text IN ('delayed','bounced') THEN $2::text ELSE delivery_diagnostic END,
         delivery_delayed_at = CASE WHEN $1::text = 'delayed' THEN NOW() ELSE delivery_delayed_at END,
         delivered_at = CASE WHEN $1::text = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
         bounced_at = CASE WHEN $1::text = 'bounced' THEN COALESCE(bounced_at, NOW()) ELSE bounced_at END,
         sent_at = CASE WHEN $1::text = 'delivered' THEN COALESCE(sent_at, NOW()) ELSE sent_at END,
         status = CASE WHEN $1::text = 'delivered' AND status = 'approved' THEN 'sent' ELSE status END,
         updated_at = NOW()
       WHERE delivery_queue_id = $3::uuid AND status <> 'void'
         AND delivery_status <> 'delivered'
       RETURNING id, organization_id, status, delivery_status`,
      [payload.status, payload.diagnostic || null, queued.id],
    );

    const invoice = invoiceResult.rows[0];
    if (invoice) {
      await client.query(
        `INSERT INTO homecare_client_billing_invoice_events (organization_id, invoice_id, event_type, details)
         VALUES ($1,$2,$3,jsonb_build_object('source','smtp_dsn','dsn_event_id',$4::text,'recipient',$5::text,'diagnostic',$6::text))`,
        [invoice.organization_id, invoice.id, payload.status, payload.event_id, payload.recipient, payload.diagnostic || null],
      );
    }

    await client.query('COMMIT');
    return { matched: true, duplicate: false, invoiceUpdated: Boolean(invoice) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
