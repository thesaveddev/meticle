import { query, transaction } from '../database';
import { randomUUID } from 'crypto';
import { getTransporter, domainOf, senderDomain } from './email.service';
import logger from './logger';

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000; // 5 seconds
let processorInterval: ReturnType<typeof setInterval> | null = null;

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailQueueOptions {
  requestDsn?: boolean;
  organizationId?: string;
  relatedEntityType?: 'homecare_invoice';
  relatedEntityId?: string;
  createdBy?: string;
}

export interface QueuedMail {
  from_email?: string | null;
  to_email: string;
  subject: string;
  html_body: string;
  attachments?: { filename: string; content: string; contentType?: string }[] | null;
  dsn_requested?: boolean | null;
  dsn_id?: string | null;
}

/**
 * The options handed to nodemailer for one queued message.
 *
 * `envelope.from` is the SMTP `MAIL FROM` — the return path, distinct from the
 * visible `From:` header. It was previously unset, which left nodemailer to
 * derive it from the authenticated SMTP credentials, so the envelope sender was
 * whatever `SMTP_USER` happened to be. If that is not on the organisational
 * domain, DMARC's SPF alignment fails and DKIM alone carries the policy; and
 * because the value depended on a credential rather than on the code, nothing
 * in the repository described what was actually being asserted.
 *
 * Setting it equal to the visible sender makes alignment structural rather
 * than incidental: the two addresses share a domain by construction, and there
 * is no credential that can quietly change it. Bounces return to the mailbox
 * for that category — billing mail bounces to the billing address — which is
 * where the team that cares about them is already looking.
 *
 * This is what the application asks for. A provider may still rewrite the
 * return path in transit, and only the received `Return-Path` proves what went
 * out on the wire.
 */
export function buildMailOptions(mail: QueuedMail) {
  const from = resolveSender(mail.from_email);
  const attachments = mail.attachments?.length
    ? mail.attachments.map(a => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType || 'application/pdf' }))
    : [];
  return {
    from,
    // `to` is required alongside `from`. Supplying an `envelope` object makes it
    // authoritative for the whole SMTP envelope rather than a partial override:
    // with only `from` set, nodemailer has no recipient and rejects the message
    // with EENVELOPE "No recipients defined" before it reaches the server.
    // Verified against MXRocket — `envelope: { from }` alone fails, and
    // `envelope: { from, to }` is accepted with the sender as intended.
    envelope: { from, to: mail.to_email },
    to: mail.to_email,
    subject: mail.subject,
    html: mail.html_body,
    attachments,
    ...(mail.dsn_requested && mail.dsn_id ? {
      dsn: { id: mail.dsn_id, return: 'headers' as const, notify: ['success', 'failure', 'delay'] as const, recipient: mail.to_email },
    } : {}),
  };
}

const DEFAULT_SENDER = 'noreply@meticlecare.com';

/**
 * The address a message is sent from, and its envelope sender.
 *
 * A queued row always carries the category sender chosen at enqueue time, so
 * the fallback below is close to dead code — which is exactly why it is worth
 * making safe. `SMTP_FROM` is a free-form secret, and an earlier configuration
 * of this application had it pointing at an unrelated domain left over from a
 * previous vendor relationship. An off-domain value here means every message
 * that took this path asserted a domain the organisation does not control:
 * DMARC alignment fails, and the header discloses an unrelated third party to
 * every recipient.
 *
 * So the value is honoured only when it is on the organisational domain, and
 * an off-domain one is refused loudly rather than used quietly.
 */
export function resolveSender(rowSender?: string | null): string {
  if (rowSender) return rowSender;
  const configured = process.env.SMTP_FROM;
  if (!configured) return DEFAULT_SENDER;
  if (domainOf(configured) === senderDomain()) return configured;
  logger.error(
    { configured, expectedDomain: senderDomain() },
    'Email: SMTP_FROM is not on the organisational domain — refusing it, using the aligned default. Mail sent via this fallback would fail DMARC alignment and disclose an unrelated domain.',
  );
  return DEFAULT_SENDER;
}

export class EmailQueue {
  static async enqueue(to: string, subject: string, htmlBody: string, fromEmail?: string, attachments?: EmailAttachment[], options: EmailQueueOptions = {}) {
    // Invoice resends each need a distinct correlation ID for independent DSN reports.
    if (!options.relatedEntityId) {
      const dup = await query(
        `SELECT id FROM email_queue WHERE to_email = $1 AND subject = $2 AND status IN ('pending', 'sending') LIMIT 1`,
        [to, subject]
      );
      if (dup.rows.length > 0) {
        logger.info({ to, subject, existingId: dup.rows[0].id }, 'Email dedup — skipping duplicate');
        return null;
      }
    }
    const attachmentMeta = attachments?.map(a => ({
      filename: a.filename,
      content: a.content.toString('base64'),
      contentType: a.contentType || 'application/pdf',
    })) || [];
    const dsnId = options.requestDsn ? randomUUID() : null;
    const insert = (client: any) => client.query(
      `INSERT INTO email_queue
         (to_email, subject, html_body, from_email, attachments, dsn_id, dsn_requested,
          organization_id, related_entity_type, related_entity_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [to, subject, htmlBody, fromEmail || null, JSON.stringify(attachmentMeta), dsnId, Boolean(options.requestDsn),
        options.organizationId || null, options.relatedEntityType || null, options.relatedEntityId || null, options.createdBy || null]
    );

    if (options.relatedEntityType === 'homecare_invoice' && options.organizationId && options.relatedEntityId && options.createdBy) {
      return transaction(async client => {
        const queued = await insert(client);
        const linked = await client.query(
          `UPDATE homecare_client_billing_invoices SET delivery_status = 'queued', delivery_queue_id = $1,
             delivery_diagnostic = NULL, updated_at = NOW()
           WHERE id = $2 AND organization_id = $3 AND recipient_email = $4
             AND person_id IS NOT NULL AND status IN ('approved','sent','viewed')
           RETURNING id`,
          [queued.rows[0].id, options.relatedEntityId, options.organizationId, to]
        );
        if (!linked.rows[0]) throw new Error('Invoice is no longer eligible for delivery to this recipient');
        await client.query(
          `INSERT INTO homecare_client_billing_invoice_events (organization_id, invoice_id, actor_id, event_type, details)
           VALUES ($1,$2,$3,'queued',jsonb_build_object('queue_id',$4::text,'recipient_email',$5::text,'dsn_requested',$6::boolean))`,
          [options.organizationId, options.relatedEntityId, options.createdBy, queued.rows[0].id, to, Boolean(options.requestDsn)]
        );
        return queued;
      });
    }

    return query(
      `INSERT INTO email_queue
         (to_email, subject, html_body, from_email, attachments, dsn_id, dsn_requested,
          organization_id, related_entity_type, related_entity_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [to, subject, htmlBody, fromEmail || null, JSON.stringify(attachmentMeta), dsnId, Boolean(options.requestDsn),
        options.organizationId || null, options.relatedEntityType || null, options.relatedEntityId || null, options.createdBy || null]
    );
  }

  static async processBatch() {
    // Get pending emails ordered by creation date
    const transporter = getTransporter();
    if (!transporter) {
      // Do not claim rows or increment retry counters when SMTP is unavailable.
      // They remain pending until configuration is restored.
      logger.warn('No SMTP transporter — leaving queued emails pending');
      return 0;
    }

    const batch = await query(
      `UPDATE email_queue SET status = 'sending', sending_at = CURRENT_TIMESTAMP, retry_count = retry_count + 1, error_message = NULL
       WHERE id IN (
         SELECT id FROM email_queue
         WHERE (status = 'pending' OR (status = 'sending' AND (sending_at IS NULL OR sending_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')))
           AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [BATCH_SIZE]
    );
    for (const email of batch.rows) {
      try {
        const info = await transporter.sendMail(buildMailOptions(email));
        const acceptedRecipients = (info.accepted || []).map((recipient: string | { address?: string }) =>
          (typeof recipient === 'string' ? recipient : recipient.address || '').toLowerCase(),
        );
        if (!acceptedRecipients.includes(String(email.to_email).toLowerCase())) {
          const rejection = new Error(`SMTP did not accept recipient ${email.to_email}`) as NodeJS.ErrnoException & { responseCode?: number };
          rejection.code = 'EENVELOPE';
          rejection.responseCode = 550;
          throw rejection;
        }
        logger.info({ queueId: email.id, to: email.to_email, dsnRequested: Boolean(email.dsn_requested) }, 'Email accepted by SMTP server');
        await transaction(async client => {
          await client.query(
            `UPDATE email_queue SET
               status = CASE WHEN last_dsn_status = 'bounced' THEN 'failed' ELSE 'sent' END,
               sent_at = CURRENT_TIMESTAMP, sending_at = NULL, provider_message_id = $2,
               error_message = CASE WHEN last_dsn_status = 'bounced' THEN error_message ELSE NULL END
             WHERE id = $1`,
            [email.id, info.messageId || null]
          );
          if (email.related_entity_type === 'homecare_invoice' && email.related_entity_id && email.organization_id) {
            await client.query(
              `SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`,
              [email.organization_id, email.created_by || '']
            );
            const accepted = await client.query(
              `UPDATE homecare_client_billing_invoices SET delivery_status = 'accepted', delivery_accepted_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND organization_id = $2 AND delivery_queue_id = $3
               AND delivery_status = 'queued' RETURNING id`,
              [email.related_entity_id, email.organization_id, email.id]
            );
            if (accepted.rows[0]) await client.query(
              `INSERT INTO homecare_client_billing_invoice_events (organization_id, invoice_id, actor_id, event_type, details)
               VALUES ($1,$2,$3,'accepted',jsonb_build_object('queue_id',$4::text,'smtp_message_id',$5::text))`,
              [email.organization_id, email.related_entity_id, email.created_by || null, email.id, info.messageId || null]
            );
          }
        });
      } catch (err: any) {
        // 5xx SMTP responses and protocol errors are permanent — do not retry
        const isPermanent = err.responseCode >= 500 || err.code === 'EPROTOCOL' || err.code === 'ESOCKET' || /554/.test(err.message || '');
        const isTransient = err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'EENVELOPE' || (err.responseCode >= 400 && err.responseCode < 500);
        const nextStatus = isPermanent ? 'failed' : ((email.retry_count + 1) >= email.max_retries ? 'failed' : 'pending');
        logger.error({ err: err.message, code: err.code, command: err.command, smtpCode: err.responseCode, queueId: email.id, retryCount: email.retry_count + 1, nextStatus, isPermanent }, 'Email queue send failed');
        const errorMessage = `${err.code ? err.code + ': ' : ''}${err.message || 'Unknown error'}`;
        await transaction(async client => {
          await client.query(
            `UPDATE email_queue SET status = $1, sending_at = NULL, retry_count = $2, error_message = $3 WHERE id = $4`,
            [nextStatus, isPermanent ? email.max_retries : email.retry_count + 1, errorMessage, email.id]
          );
          if (nextStatus === 'failed' && email.related_entity_type === 'homecare_invoice' && email.related_entity_id && email.organization_id) {
            await client.query(
              `SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`,
              [email.organization_id, email.created_by || '']
            );
            const failed = await client.query(
              `UPDATE homecare_client_billing_invoices SET delivery_status = 'failed', delivery_diagnostic = $1, updated_at = NOW()
               WHERE id = $2 AND organization_id = $3 AND delivery_queue_id = $4
                 AND delivery_status NOT IN ('delivered','bounced') RETURNING id`,
              [errorMessage.slice(0, 2000), email.related_entity_id, email.organization_id, email.id]
            );
            if (failed.rows[0]) await client.query(
              `INSERT INTO homecare_client_billing_invoice_events (organization_id, invoice_id, actor_id, event_type, details)
               VALUES ($1,$2,$3,'failed',jsonb_build_object('queue_id',$4::text,'diagnostic',$5::text))`,
              [email.organization_id, email.related_entity_id, email.created_by || null, email.id, errorMessage.slice(0, 2000)]
            );
          }
        });
      }
    }
    return batch.rows.length;
  }

  static async cleanupFailedOlderThan(days = 3) {
    const result = await query(
      `DELETE FROM email_queue
       WHERE status = 'failed'
         AND related_entity_type IS DISTINCT FROM 'homecare_invoice'
         AND created_at < CURRENT_TIMESTAMP - ($1::int * INTERVAL '1 day')
       RETURNING id`,
      [days]
    );
    if (result.rowCount) logger.info({ deleted: result.rowCount, days }, 'Old failed emails purged');
    return result.rowCount || 0;
  }

  static startProcessor() {
    if (processorInterval) return;
    logger.info({ pollIntervalMs: POLL_INTERVAL }, 'Email queue processor started');
    processorInterval = setInterval(async () => {
      try {
        const sent = await EmailQueue.processBatch();
        if (sent > 0) logger.info({ sent }, 'Email queue batch processed');
      } catch (err) {
        logger.error(err, 'Email queue processor error');
      }
    }, POLL_INTERVAL);
  }

  static stopProcessor() {
    if (processorInterval) {
      clearInterval(processorInterval);
      processorInterval = null;
      logger.info('Email queue processor stopped');
    }
  }
}
