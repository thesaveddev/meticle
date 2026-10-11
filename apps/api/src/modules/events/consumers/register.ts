import { registerConsumer } from '../events.consumers';
import { IncidentTriageConsumer } from './incident-triage.consumer';
import { MedicationMissedReviewsConsumer } from './medication-missed-reviews.consumer';
import { MissionControlAlertConsumer } from './mission-control-alert.consumer';
import { MicaAssignmentNotificationConsumer } from './mica-assignment-notification.consumer';
import { MedicationStockLowNotificationConsumer } from './medication-stock-low-notification.consumer';

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
  registerConsumer('shift.understaffed', MissionControlAlertConsumer);
  registerConsumer('staffing.coverage_low', MissionControlAlertConsumer);
  registerConsumer('staffing.coverage_recovered', MissionControlAlertConsumer);
  registerConsumer('training.expiring', MissionControlAlertConsumer);
  registerConsumer('dbs.expiring', MissionControlAlertConsumer);
  registerConsumer('policy.review_due', MissionControlAlertConsumer);
  registerConsumer('care_plan.review_due', MissionControlAlertConsumer);
  registerConsumer('fluid.intake_below_target', MissionControlAlertConsumer);
  registerConsumer('nutrition.appetite_decline', MissionControlAlertConsumer);
  registerConsumer('nutrition.refused_meal', MissionControlAlertConsumer);

  // Mica voice-created writes: the assignee learns about them the same way
  // they learn about every other assignment — through their notification bell.
  // Reorder warnings reach the managers who can action them through the bell
  // icon — Mission Control aggregates them, this puts one in each inbox.
  registerConsumer('medication.stock_low', MedicationStockLowNotificationConsumer);

  registerConsumer('mica.task_confirmed', MicaAssignmentNotificationConsumer);
  registerConsumer('mica.appointment_confirmed', MicaAssignmentNotificationConsumer);
}