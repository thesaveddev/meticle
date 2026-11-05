import { query, transaction } from '../../shared/database';
import { apiBaseUrl } from '../../shared/utils/emailUnsubscribe';
import { getSmsSecrets } from './sms.service';
import { sendViaTwilio, TwilioError, type TwilioCredentials } from './sms.twilio';
import logger from '../../shared/utils/logger';

/**
 * The SMS outbox: `sms_queue` rows move pending → sending → sent, and the
 * Twilio status webhook moves sent → delivered/undelivered. Retry mirrors
 * `email_queue` — claim with SKIP LOCKED, count the attempt when the row is
 * claimed, and only retry what might succeed on a second try.
 *
 * Two deliberate differences from email:
 *
 *  * A row whose organisation has no usable Twilio account is left pending,
 *    not failed: the configuration may arrive after the event that queued the
 *    message (a manager sets up SMS on Monday; the weekend's cover requests
 *    are still worth sending). The failure that ends a row is Twilio refusing
 *    it, not the absence of credentials.
 *  * The sender is injectable. Production passes the Twilio REST call; tests
 *    pass a fake. The seam is one function rather than a mock of `fetch`
 *    because the queue should not know what a transport is.
 */

const BATCH_SIZE = 25;
const POLL_INTERVAL = 30_000;

export type SmsSender = (
  creds: TwilioCredentials,
  args: { to: string; body: string; statusCallbackUrl?: string },
) => Promise<{ sid: string }>;

let sender: SmsSender = (creds, args) => sendViaTwilio(creds, args);

/** Tests replace the transport; production never calls this. */
export function setSmsSender(next: SmsSender) {
  sender = next;
}

export function smsStatusCallbackUrl(orgId: string): string {
  return `${apiBaseUrl()}/sms/status?org=${orgId}`;
}

export interface SmsEnqueueOptions {
  createdBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export class SmsQueue {
  static async enqueue(
    organizationId: string,
    args: { to: string; body: string } & SmsEnqueueOptions,
  ) {
    const dup = await query(
      `SELECT id FROM sms_queue WHERE organization_id = $1 AND to_phone = $2 AND body = $3 AND status IN ('pending', 'sending') LIMIT 1`,
      [organizationId, args.to, args.body],
    );
    if (dup.rows.length > 0) {
      logger.info({ to: args.to, existingId: dup.rows[0].id }, 'SMS dedup — skipping duplicate');
      return null;
    }
    const res = await query(
      `INSERT INTO sms_queue (organization_id, to_phone, body, related_entity_type, related_entity_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [organizationId, args.to, args.body, args.relatedEntityType || null, args.relatedEntityId || null, args.createdBy || null],
    );
    return res.rows[0];
  }

  static async processBatch() {
    const batch = await query(
      `UPDATE sms_queue SET status = 'sending', retry_count = retry_count + 1, error_message = NULL
       WHERE id IN (
         SELECT id FROM sms_queue
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [BATCH_SIZE],
    );
    for (const row of batch.rows) {
      try {
        const cfg = await getSmsSecrets(row.organization_id);
        if (!cfg.enabled || !cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
          // Configuration may still arrive; leave the row for the next pass.
          await query(`UPDATE sms_queue SET status = 'pending', retry_count = retry_count - 1 WHERE id = $1`, [row.id]);
          logger.warn({ queueId: row.id, orgId: row.organization_id }, 'SMS skipped — Twilio account not configured');
          continue;
        }
        const { sid } = await sender(
          { accountSid: cfg.accountSid, authToken: cfg.authToken, fromNumber: cfg.fromNumber },
          { to: row.to_phone, body: row.body, statusCallbackUrl: smsStatusCallbackUrl(row.organization_id) },
        );
        await query(
          `UPDATE sms_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP, provider_sid = $2, error_message = NULL WHERE id = $1`,
          [row.id, sid],
        );
        logger.info({ queueId: row.id, to: row.to_phone, sid }, 'SMS accepted by Twilio');
      } catch (err: any) {
        const permanent = err instanceof TwilioError && err.code === 'ETWILIO_REJECTED';
        const attemptsUsed = row.retry_count + 1;
        const nextStatus = permanent || attemptsUsed >= row.max_retries ? 'failed' : 'pending';
        const message = `${err.code ? err.code + ': ' : ''}${err.message || 'Unknown error'}`.slice(0, 2000);
        await query(`UPDATE sms_queue SET status = $1, error_message = $2 WHERE id = $3`, [nextStatus, message, row.id]);
        logger.error({ err: err.message, queueId: row.id, nextStatus }, 'SMS queue send failed');
      }
    }
    return batch.rows.length;
  }

  /**
   * A delivery receipt for a sent row. Unknown SIDs and receipts for rows that
   * already reached a terminal state are acknowledged and ignored — Twilio
   * retries webhooks, so the second delivery of the same receipt must be a
   * no-op rather than an error.
   */
  static async recordDelivery(providerSid: string, twilioStatus: string, errorMessage?: string) {
    const status = twilioStatus === 'delivered' ? 'delivered' : ['failed', 'undelivered'].includes(twilioStatus) ? 'undelivered' : null;
    if (!status) return null;
    const res = await query(
      `UPDATE sms_queue SET status = $1, delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
         error_message = COALESCE($2, error_message)
       WHERE provider_sid = $3 AND status = 'sent' RETURNING id`,
      [status, errorMessage ? String(errorMessage).slice(0, 2000) : null, providerSid],
    );
    return res.rows[0]?.id || null;
  }
}

let processorInterval: NodeJS.Timeout | null = null;

export function startSmsProcessor() {
  if (processorInterval) return;
  logger.info({ pollIntervalMs: POLL_INTERVAL }, 'SMS queue processor started');
  processorInterval = setInterval(async () => {
    try {
      const sent = await SmsQueue.processBatch();
      if (sent > 0) logger.info({ sent }, 'SMS queue batch processed');
    } catch (err) {
      logger.error(err, 'SMS queue processor error');
    }
  }, POLL_INTERVAL);
}

export function stopSmsProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    logger.info('SMS queue processor stopped');
  }
}
