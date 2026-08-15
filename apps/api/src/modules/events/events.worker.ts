import logger from '../../shared/utils/logger';
import { processOutbox, cleanupOutbox, OutboxProcessStats } from './events.outbox';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

let pollTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * In-process background worker that drains the domain event outbox. Mirrors the
 * EmailQueue pattern (setInterval, no separate process) so deployment stays
 * single-container. Deliveries are safe to run from multiple instances anyway —
 * processOutbox claims rows with FOR UPDATE SKIP LOCKED inside a transaction.
 */
export const EventWorker = {
  start(pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS): void {
    if (pollTimer) return;

    pollTimer = setInterval(async () => {
      try {
        const stats: OutboxProcessStats = await processOutbox();
        if (stats.processed > 0) {
          logger.info({ ...stats }, 'Event outbox batch processed');
        }
      } catch (err) {
        logger.error(err, 'Event outbox worker error');
      }
    }, pollIntervalMs);

    cleanupTimer = setInterval(async () => {
      try {
        const deleted = await cleanupOutbox();
        if (deleted > 0) logger.info({ deleted }, 'Event outbox cleanup complete');
      } catch (err) {
        logger.error(err, 'Event outbox cleanup error');
      }
    }, CLEANUP_INTERVAL_MS);

    logger.info({ pollIntervalMs }, 'Event outbox worker started');
  },

  stop(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    logger.info('Event outbox worker stopped');
  },

  /** One synchronous drain pass — used by tests and the POST /events/publish endpoint. */
  runOnce(): Promise<OutboxProcessStats> {
    return processOutbox();
  },
};
