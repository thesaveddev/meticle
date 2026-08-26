import logger from '../../shared/utils/logger';
import { query } from '../../shared/database';
import { publishDomainEvent } from '../events/events.outbox';

/**
 * Payload shape for `medication.administration_missed`. Kept deny-list narrow
 * (no clinical advice, no diagnosis) — consumers use this for triage, draft
 * tasks, and follow-up nudges only. Blueprint §13.1 steps 2–7 build on top.
 */
export interface MedicationAdministrationMissedPayload {
  id: string;
  record_id: string;
  item_id: string;
  person_id: string;
  person_name: string;
  medication_name: string;
  medication_dosage: string | null;
  scheduled_time: string;
  administered_time: string | null;
  reason: string | null;
  notes: string | null;
  location_id: string | null;
  is_prn: boolean;
  logged_by_user_id: string;
  recorded_at: string;
  /** True when the prior status was not 'missed' (i.e. this is a transition into missed). */
  is_transition: boolean;
}

/**
 * Build and publish a `medication.administration_missed` domain event.
 *
 * Looks up the medication item, record, person, and location in a single
 * query so controllers only need to hand us the administration row. The
 * publisher uses `query()` (ALS-scoped inside a request, superuser pool
 * otherwise) and writes the outbox row through `publishDomainEvent`, which
 * commits in the same ALS transaction when called from inside a request.
 *
 * The caller is responsible for `.catch`-handling the returned promise —
 * outbox writes are best-effort relative to the controller's response; if
 * they fail the audit log on `emedication_audit_log` is still the durable
 * record.
 */
export async function publishAdministrationMissedEvent(args: {
  organizationId: string;
  administration: {
    id: string;
    emedication_item_id: string;
    scheduled_time: string;
    administered_time?: string | null;
    notes?: string | null;
    prn_reason?: string | null;
  };
  loggedByUserId: string;
  isTransition: boolean;
}): Promise<{ id: string }> {
  const lookup = await query(
    `SELECT
       mi.id               AS item_id,
       mi.name             AS medication_name,
       mi.dosage           AS medication_dosage,
       mi.is_prn           AS is_prn,
       er.id               AS record_id,
       er.person_id        AS person_id,
       COALESCE(p.first_name || ' ' || p.last_name, 'Unknown person') AS person_name,
       p.location_id       AS location_id
     FROM emedication_items mi
     JOIN emedication_records er ON er.id = mi.emedication_record_id
     LEFT JOIN people p ON p.id = er.person_id
     WHERE mi.id = $1`,
    [args.administration.emedication_item_id]
  );

  const row = lookup.rows[0];
  if (!row) {
    logger.warn(
      { administrationId: args.administration.id, itemId: args.administration.emedication_item_id },
      'Skipping medication.administration_missed publish — item/record/join row missing'
    );
    return { id: '' };
  }

  const payload: MedicationAdministrationMissedPayload = {
    id: args.administration.id,
    record_id: row.record_id,
    item_id: row.item_id,
    person_id: row.person_id,
    person_name: row.person_name,
    medication_name: row.medication_name,
    medication_dosage: row.medication_dosage ?? null,
    scheduled_time: args.administration.scheduled_time,
    administered_time: args.administration.administered_time ?? null,
    reason: args.administration.prn_reason ?? null,
    notes: args.administration.notes ?? null,
    location_id: row.location_id ?? null,
    is_prn: !!row.is_prn,
    logged_by_user_id: args.loggedByUserId,
    recorded_at: new Date().toISOString(),
    is_transition: args.isTransition,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'medication.administration_missed',
    aggregateType: 'emedication_administration',
    aggregateId: args.administration.id,
    correlationId: args.administration.id,
    payload: payload as unknown as Record<string, unknown>,
  });
}

// ── medication.administration_late ──

export interface MedicationAdministrationLatePayload {
  administration_id: string;
  item_id: string;
  person_id: string;
  person_name: string;
  medication_name: string;
  scheduled_time: string;
  location_id: string | null;
  late_minutes: number;
}

/**
 * Publish `medication.administration_late` for an administration that is past
 * its scheduled time and still pending. Called by the scheduled cron/worker.
 */
export async function publishAdministrationLateEvent(args: {
  organizationId: string;
  administrationId: string;
  itemId: string;
  personId: string;
  personName: string;
  medicationName: string;
  scheduledTime: string;
  locationId: string | null;
  lateMinutes: number;
}): Promise<{ id: string }> {
  const payload: MedicationAdministrationLatePayload = {
    administration_id: args.administrationId,
    item_id: args.itemId,
    person_id: args.personId,
    person_name: args.personName,
    medication_name: args.medicationName,
    scheduled_time: args.scheduledTime,
    location_id: args.locationId,
    late_minutes: args.lateMinutes,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'medication.administration_late',
    aggregateType: 'emedication_administration',
    aggregateId: args.administrationId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

// ── medication.stock_low ──

export interface MedicationStockLowPayload {
  stock_id: string;
  medication_name: string;
  dosage: string | null;
  unit: string | null;
  quantity: number;
  reorder_level: number;
  person_id: string | null;
  person_name: string | null;
  location_id: string | null;
  location_name: string | null;
}

/**
 * Publish `medication.stock_low` when stock quantity falls to or below the
 * reorder level. Called after stock deduction or delivery consumption.
 */
export async function publishStockLowEvent(args: {
  organizationId: string;
  stockId: string;
  medicationName: string;
  dosage: string | null;
  unit: string | null;
  quantity: number;
  reorderLevel: number;
  personId: string | null;
  personName: string | null;
  locationId: string | null;
  locationName: string | null;
}): Promise<{ id: string }> {
  const payload: MedicationStockLowPayload = {
    stock_id: args.stockId,
    medication_name: args.medicationName,
    dosage: args.dosage,
    unit: args.unit,
    quantity: args.quantity,
    reorder_level: args.reorderLevel,
    person_id: args.personId,
    person_name: args.personName,
    location_id: args.locationId,
    location_name: args.locationName,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'medication.stock_low',
    aggregateType: 'emedication_stock',
    aggregateId: args.stockId,
    payload: payload as unknown as Record<string, unknown>,
  });
}