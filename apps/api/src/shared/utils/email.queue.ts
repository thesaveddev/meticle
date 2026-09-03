import { query } from '../database';
import { getTransporter } from './email.service';
import logger from './logger';

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000; // 5 seconds
let processorInterval: ReturnType<typeof setInterval> | null = null;

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export class EmailQueue {
  static enqueue(to: string, subject: string, htmlBody: string, fromEmail?: string, attachments?: EmailAttachment[]) {
    // Persist the attachment bytes in the queue row. Storing only the filename
    // silently produced empty attachments when the worker later tried to send
    // the message.
    const attachmentMeta = attachments?.map(a => ({
      filename: a.filename,
      content: a.content.toString('base64'),
      contentType: a.contentType || 'application/pdf',
    })) || [];
    return query(
      `INSERT INTO email_queue (to_email, subject, html_body, from_email, attachments) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [to, subject, htmlBody, fromEmail || null, JSON.stringify(attachmentMeta)]
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
        const from = email.from_email || process.env.SMTP_FROM || 'noreply@meticlecare.com';
        const attachments = email.attachments?.length > 0
          ? email.attachments.map((a: any) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.contentType || 'application/pdf' }))
          : [];
        await transporter.sendMail({ from, to: email.to_email, subject: email.subject, html: email.html_body, attachments });
        logger.info({ queueId: email.id, to: email.to_email }, 'Email sent via queue');
        await query(
          `UPDATE email_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP, sending_at = NULL, error_message = NULL WHERE id = $1`,
          [email.id]
        );
      } catch (err: any) {
        const retryable = err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'EENVELOPE' || (err.responseCode >= 400 && err.responseCode < 500);
        const nextStatus = (email.retry_count + 1) >= email.max_retries ? 'failed' : 'pending';
        logger.error({ err: err.message, code: err.code, command: err.command, smtpCode: err.responseCode, queueId: email.id, retryCount: email.retry_count + 1, nextStatus }, 'Email queue send failed');
        await query(
          `UPDATE email_queue SET status = $1, sending_at = NULL, error_message = $2 WHERE id = $3`,
          [nextStatus, `${err.code ? err.code + ': ' : ''}${err.message || 'Unknown error'}`, email.id]
        );
      }
    }
    return batch.rows.length;
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
