import logger from '../../shared/utils/logger';
import { processOutbox, cleanupOutbox, OutboxProcessStats } from './events.outbox';
import { publishBatchEvents } from './events.batch-publisher';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const BATCH_PUBLISHER_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

let pollTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let batchTimer: ReturnType<typeof setInterval> | null = null;

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

    // Batch publisher: scans all orgs for actionable conditions every 5 min
    // and publishes domain events for the outbox worker to deliver
    batchTimer = setInterval(async () => {
      try {
        const counts = await publishBatchEvents();
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (total > 0) {
          logger.info({ ...counts, total }, 'Batch event publisher run complete');
        }
      } catch (err) {
        logger.error(err, 'Batch event publisher error');
      }
    }, BATCH_PUBLISHER_INTERVAL_MS);

    // Run immediately on startup
    publishBatchEvents().catch(err => logger.error(err, 'Initial batch publish failed'));

    logger.info({ pollIntervalMs, batchIntervalMs: BATCH_PUBLISHER_INTERVAL_MS }, 'Event outbox worker started');
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
    if (batchTimer) {
      clearInterval(batchTimer);
      batchTimer = null;
    }
    logger.info('Event outbox worker stopped');
  },

  /** One synchronous drain pass — used by tests and the POST /events/publish endpoint. */
  runOnce(): Promise<OutboxProcessStats> {
    return processOutbox();
  },
};
