import logger from '../../shared/utils/logger';

export interface DomainEvent {
  id: string;
  organizationId: string;
  eventName: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  eventTimestamp: string;
  published: boolean;
  status: string;
  publishAttempts: number;
  lastError?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export interface EventConsumer {
  name: string;
  handle(event: DomainEvent): Promise<void>;
}

// Registry keyed by event name, then consumer name (registering the same name
// again replaces the handler rather than duplicating it — keeps tests isolated).
const registry = new Map<string, Map<string, EventConsumer>>();

export function registerConsumer(eventName: string, consumer: EventConsumer): void {
  const byName = registry.get(eventName) || new Map<string, EventConsumer>();
  byName.set(consumer.name, consumer);
  registry.set(eventName, byName);
  logger.info({ eventName, consumer: consumer.name }, 'Event consumer registered');
}

export function getConsumers(eventName: string): EventConsumer[] {
  return [...(registry.get(eventName) || new Map<string, EventConsumer>()).values()];
}

/** Test hook — clears all registered consumers. */
export function resetConsumers(): void {
  registry.clear();
}
