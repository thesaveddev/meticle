import { registerConsumer } from '../events.consumers';
import { IncidentTriageConsumer } from './incident-triage.consumer';

/**
 * Register the production event consumers the outbox worker should deliver to.
 * Called once at application startup (src/index.ts). Tests register consumers
 * per-test instead and never run this.
 */
export function registerProductionConsumers(): void {
  registerConsumer('incident.created', IncidentTriageConsumer);
}
