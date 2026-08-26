import { registerConsumer } from '../events.consumers';
import { IncidentTriageConsumer } from './incident-triage.consumer';
import { MedicationMissedReviewsConsumer } from './medication-missed-reviews.consumer';
import { MissionControlAlertConsumer } from './mission-control-alert.consumer';

/**
 * Register the production event consumers the outbox worker should deliver to.
 * Called once at application startup (src/index.ts). Tests register consumers
 * per-test instead and never run this.
 */
export function registerProductionConsumers(): void {
  registerConsumer('incident.created', IncidentTriageConsumer);
  registerConsumer('medication.administration_missed', MedicationMissedReviewsConsumer);

  // Mission Control alerting for all actionable domain events
  registerConsumer('medication.administration_missed', MissionControlAlertConsumer);
  registerConsumer('medication.administration_late', MissionControlAlertConsumer);
  registerConsumer('medication.stock_low', MissionControlAlertConsumer);
  registerConsumer('incident.action_overdue', MissionControlAlertConsumer);
  registerConsumer('shift.unfilled', MissionControlAlertConsumer);
  registerConsumer('training.expiring', MissionControlAlertConsumer);
  registerConsumer('dbs.expiring', MissionControlAlertConsumer);
  registerConsumer('policy.review_due', MissionControlAlertConsumer);
  registerConsumer('care_plan.review_due', MissionControlAlertConsumer);
  registerConsumer('fluid.intake_below_target', MissionControlAlertConsumer);
  registerConsumer('nutrition.appetite_decline', MissionControlAlertConsumer);
  registerConsumer('nutrition.refused_meal', MissionControlAlertConsumer);
}