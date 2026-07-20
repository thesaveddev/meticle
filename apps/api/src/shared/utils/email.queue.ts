import { query } from '../database';
import { getTransporter } from './email.service';
import logger from './logger';

const BATCH_SIZE = 10;
const POLL_INTERVAL = 5000; // 5 seconds
let processorInterval: ReturnType<typeof setInterval> | null = null;

export class EmailQueue {
  static enqueue(to: string, subject: string, htmlBody: string) {
    return query(
      `INSERT INTO email_queue (to_email, subject, html_body) VALUES ($1, $2, $3) RETURNING *`,
      [to, subject, htmlBody]
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
          const from = process.env.SMTP_FROM || 'noreply@caredesk.com';
          await transporter.sendMail({ from, to: email.to_email, subject: email.subject, html: email.html_body });
        } else {
          logger.info({ to: email.to_email, subject: email.subject, bodyLength: email.html_body.length }, 'Email (queued)');
        }
        await query(
          `UPDATE email_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [email.id]
        );
      } catch (err: any) {
        logger.error({ err: err.message, to: email.to_email, subject: email.subject }, 'Email queue send failed');
        await query(
          `UPDATE email_queue SET status = 'failed', error_message = $1 WHERE id = $2`,
          [err.message || 'Unknown error', email.id]
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
