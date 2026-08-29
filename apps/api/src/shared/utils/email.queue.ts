import { query } from '../database';
import { getTransporter } from './email.service';
import logger from './logger';

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000; // 5 seconds
let processorInterval: ReturnType<typeof setInterval> | null = null;

export class EmailQueue {
  static enqueue(to: string, subject: string, htmlBody: string, fromEmail?: string) {
    return query(
      `INSERT INTO email_queue (to_email, subject, html_body, from_email) VALUES ($1, $2, $3, $4) RETURNING *`,
      [to, subject, htmlBody, fromEmail || null]
    );
  }

  static async processBatch() {
    // Get pending emails ordered by creation date
    const batch = await query(
      `UPDATE email_queue SET status = 'sending', retry_count = retry_count + 1
       WHERE id IN (
         SELECT id FROM email_queue
         WHERE status = 'pending' AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [BATCH_SIZE]
    );

    const transporter = getTransporter();

    for (const email of batch.rows) {
      try {
        if (transporter) {
          const from = email.from_email || process.env.SMTP_FROM || 'noreply@meticlecare.com';
          await transporter.sendMail({ from, to: email.to_email, subject: email.subject, html: email.html_body });
          logger.info({ queueId: email.id, to: email.to_email }, 'Email sent via queue');
        } else {
          logger.warn({ queueId: email.id }, 'No transporter — email queued but not sent');
          await query(
            `UPDATE email_queue SET status = 'pending' WHERE id = $1`,
            [email.id]
          );
          continue;
        }
        await query(
          `UPDATE email_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [email.id]
        );
      } catch (err: any) {
        const retryable = err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'EENVELOPE' || (err.responseCode >= 400 && err.responseCode < 500);
        const nextStatus = (email.retry_count + 1) >= email.max_retries ? 'failed' : 'pending';
        logger.error({ err: err.message, code: err.code, command: err.command, smtpCode: err.responseCode, queueId: email.id, retryCount: email.retry_count + 1, nextStatus }, 'Email queue send failed');
        await query(
          `UPDATE email_queue SET status = $1, error_message = $2 WHERE id = $3`,
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
