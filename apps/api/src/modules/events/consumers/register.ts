import { registerConsumer } from '../events.consumers';
import { IncidentTriageConsumer } from './incident-triage.consumer';
import { MedicationMissedReviewsConsumer } from './medication-missed-reviews.consumer';
import { MissionControlAlertConsumer } from './mission-control-alert.consumer';
import { MicaAssignmentNotificationConsumer } from './mica-assignment-notification.consumer';
import { MedicationStockLowNotificationConsumer } from './medication-stock-low-notification.consumer';
import { ShiftHandoverNotificationConsumer } from './shift-handover-notification.consumer';
import { ShiftHandoverDueNotificationConsumer } from './shift-handover-due-notification.consumer';
import { RoomCheckOverdueNotificationConsumer } from './room-check-overdue-notification.consumer';

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
  // A shift that ended with no handover is a compliance gap as well as an
  // unfinished note, so Mission Control keeps the manager-facing copy while the
  // consumer below tells the staff whose handover it is.
  registerConsumer('shift.handover_due', MissionControlAlertConsumer);
  // The manager-facing copy of a room nobody checked today; the consumer below
  // tells the staff who can record it.
  registerConsumer('room_check.overdue', MissionControlAlertConsumer);
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

  // The worker who handed over has gone off shift by the time their handover is
  // read, so the acknowledgement is the only thing that tells them it landed.
  registerConsumer('shift.handover_acknowledged', ShiftHandoverNotificationConsumer);

  // And the other direction: a shift that ended with no handover recorded tells the
  // staff on it, because the handover is theirs to write and nobody else is looking.
  registerConsumer('shift.handover_due', ShiftHandoverDueNotificationConsumer);

  // A room with no check today tells the staff rostered at that location, who are
  // the people standing next to it.
  registerConsumer('room_check.overdue', RoomCheckOverdueNotificationConsumer);
}