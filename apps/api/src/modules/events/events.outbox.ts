import { query, transaction } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { AppError } from '../../shared/middleware/error.middleware';
import { getConsumers, DomainEvent } from './events.consumers';

export const MAX_PUBLISH_ATTEMPTS = 3;
const MAX_ERROR_LENGTH = 2000;

export interface PublishEventInput {
  organizationId: string;
  eventName: string;
  aggregateType?: string;
  aggregateId?: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

export interface OutboxProcessStats {
  processed: number;
  published: number;
  failed: number;
  noConsumers: number;
}

function mapRow(row: any): DomainEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventName: row.event_name,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    correlationId: row.correlation_id,
    eventTimestamp: row.event_timestamp,
    published: row.published,
    status: row.status,
    publishAttempts: row.publish_attempts,
    lastError: row.last_error,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function errorSummary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, MAX_ERROR_LENGTH);
}

/**
 * Record a business event in the outbox. When called from inside a request
 * (or a transaction), the insert joins that transaction automatically via the
 * ALS request-scoped client, so the event is only ever visible once the
 * business change it accompanies has committed.
 */
export async function publishDomainEvent(input: PublishEventInput): Promise<{ id: string }> {
  const result = await query(
    `INSERT INTO domain_events (organization_id, event_name, aggregate_type, aggregate_id, payload, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.organizationId,
      input.eventName,
      input.aggregateType || null,
      input.aggregateId || null,
      JSON.stringify(input.payload || {}),
      input.correlationId || null,
    ]
  );
  return result.rows[0];
}

export async function listPendingEvents(organizationId?: string): Promise<DomainEvent[]> {
  const result = await query(
    `SELECT * FROM domain_events
     WHERE ($1::uuid IS NULL OR organization_id = $1)
       AND published = FALSE
       AND status IN ('pending', 'failed')
     ORDER BY event_timestamp ASC`,
    [organizationId || null]
  );
  return result.rows.map(mapRow);
}

export async function getEventById(organizationId: string, id: string): Promise<DomainEvent | undefined> {
  const result = await query(`SELECT * FROM domain_events WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function getCorrelationChain(organizationId: string, correlationId: string): Promise<DomainEvent[]> {
  const result = await query(
    `SELECT * FROM domain_events
     WHERE correlation_id = $1 AND organization_id = $2
     ORDER BY event_timestamp ASC`,
    [correlationId, organizationId]
  );
  return result.rows.map(mapRow);
}

export async function retryEvent(organizationId: string, id: string): Promise<DomainEvent> {
  const result = await query(
    `UPDATE domain_events
     SET status = 'pending', published = FALSE, publish_attempts = 0, last_error = NULL, published_at = NULL
     WHERE id = $1 AND organization_id = $2
     RETURNING *`,
    [id, organizationId]
  );
  if (result.rows.length === 0) {
    throw new AppError(404, 'Event not found in this organization');
  }
  // Reset failed consumer attempts so the retry re-runs them cleanly.
  await query(
    `UPDATE event_consumers SET status = 'pending', attempts = 0, last_error = NULL, completed_at = NULL
     WHERE event_id = $1 AND status = 'failed'`,
    [id]
  );
  return mapRow(result.rows[0]);
}

/**
 * Deliver one batch of pending events to their registered consumers.
 *
 * Runs inside a transaction so the FOR UPDATE SKIP LOCKED claim is held until
 * the whole batch is processed (no other worker can double-deliver). A single
 * failing consumer is recorded per-row and never rolls back its siblings; the
 * event stays in the pending queue until every consumer succeeds, and is
 * terminal-failed after MAX_PUBLISH_ATTEMPTS so it leaves the queue.
 *
 * Consumers with no registered handler are marked published immediately —
 * the event was recorded durably, and a consumer registered later simply won't
 * see it (replay/publish is the caller's responsibility, as in classic outboxes).
 */
export async function processOutbox(organizationId?: string, batchSize = 50): Promise<OutboxProcessStats> {
  const stats: OutboxProcessStats = { processed: 0, published: 0, failed: 0, noConsumers: 0 };

  await transaction(async (client) => {
    const batch = await client.query(
      `SELECT * FROM domain_events
       WHERE ($1::uuid IS NULL OR organization_id = $1)
         AND published = FALSE
         AND status = 'pending'
         AND publish_attempts < $2
       ORDER BY event_timestamp ASC
       LIMIT $3
       FOR UPDATE SKIP LOCKED`,
      [organizationId || null, MAX_PUBLISH_ATTEMPTS, batchSize]
    );

    for (const row of batch.rows) {
      const event = mapRow(row);
      stats.processed++;
      const consumers = getConsumers(event.eventName);

      if (consumers.length === 0) {
        await client.query(
          `UPDATE domain_events SET status = 'published', published = TRUE, published_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [event.id]
        );
        stats.noConsumers++;
        stats.published++;
        continue;
      }

      let allSucceeded = true;
      for (const consumer of consumers) {
        await client.query(
          `INSERT INTO event_consumers (event_id, consumer_name, status)
           VALUES ($1, $2, 'processing')
           ON CONFLICT (event_id, consumer_name)
           DO UPDATE SET status = 'processing', last_error = NULL`,
          [event.id, consumer.name]
        );
        try {
          await consumer.handle(event);
          await client.query(
            `UPDATE event_consumers SET status = 'processed', completed_at = CURRENT_TIMESTAMP, attempts = attempts + 1
             WHERE event_id = $1 AND consumer_name = $2`,
            [event.id, consumer.name]
          );
        } catch (err: any) {
          allSucceeded = false;
          logger.error(
            { eventId: event.id, eventName: event.eventName, consumer: consumer.name, err: err?.message || err },
            'Event consumer failed'
          );
          await client.query(
            `UPDATE event_consumers SET status = 'failed', attempts = attempts + 1, last_error = $1
             WHERE event_id = $2 AND consumer_name = $3`,
            [errorSummary(err), event.id, consumer.name]
          );
        }
      }

      if (allSucceeded) {
        await client.query(
          `UPDATE domain_events SET status = 'published', published = TRUE, published_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [event.id]
        );
        stats.published++;
      } else {
        stats.failed++;
        const attempts = (event.publishAttempts || 0) + 1;
        if (attempts >= MAX_PUBLISH_ATTEMPTS) {
          await client.query(
            `UPDATE domain_events SET status = 'failed', published = TRUE, published_at = CURRENT_TIMESTAMP, publish_attempts = $1, last_error = $2
             WHERE id = $3`,
            [attempts, `Final after ${attempts} attempts`, event.id]
          );
        } else {
          await client.query(
            `UPDATE domain_events SET publish_attempts = $1, last_error = $2 WHERE id = $3`,
            [attempts, `Attempt ${attempts} failed`, event.id]
          );
        }
      }
    }
  });

  return stats;
}

/** Garbage-collect delivered events and processed consumer rows older than the retention windows. */
export async function cleanupOutbox(retentionDays = 90, consumerRetentionDays = 30): Promise<number> {
  const result = await query(
    `DELETE FROM domain_events
     WHERE published = TRUE
       AND created_at < CURRENT_TIMESTAMP - make_interval(days => $1)`,
    [retentionDays]
  );
  await query(
    `DELETE FROM event_consumers
     WHERE status = 'processed'
       AND completed_at < CURRENT_TIMESTAMP - make_interval(days => $1)`,
    [consumerRetentionDays]
  );
  return result.rowCount ?? 0;
}
