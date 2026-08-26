import { query } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { publishAdministrationLateEvent, publishStockLowEvent } from '../emedication/medication.events';
import { publishIncidentActionOverdueEvent } from '../incidents/incidents.events';
import { publishShiftUnfilledEvent } from '../scheduling/scheduling.events';
import { publishTrainingExpiringEvent } from '../training/training.events';
import { publishDbsExpiringEvent } from '../compliance/compliance.events';
import { publishPolicyReviewDueEvent } from '../policies/policies.events';
import { publishCarePlanReviewDueEvent } from '../people/care-plan.events';
import { publishFluidIntakeBelowTargetEvent } from '../health/health.events';

/**
 * Batch publisher that scans all organisations for actionable conditions and
 * publishes domain events. Designed to run on a schedule (e.g. every 5–15 min)
 * from the event worker. Each publisher is idempotent: the event outbox and
 * consumer deduplication handle re-published events.
 */
export async function publishBatchEvents(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const orgs = await query(`SELECT id FROM organizations WHERE status = 'active'`);

  for (const org of orgs.rows) {
    const orgId = org.id;

    try {
      counts['medication.administration_late'] =
        (counts['medication.administration_late'] || 0) +
        await checkLateMeds(orgId);

      counts['medication.stock_low'] =
        (counts['medication.stock_low'] || 0) +
        await checkStockLow(orgId);

      counts['incident.action_overdue'] =
        (counts['incident.action_overdue'] || 0) +
        await checkOverdueActions(orgId);

      counts['shift.unfilled'] =
        (counts['shift.unfilled'] || 0) +
        await checkUnfilledShifts(orgId);

      counts['training.expiring'] =
        (counts['training.expiring'] || 0) +
        await checkExpiringTraining(orgId);

      counts['dbs.expiring'] =
        (counts['dbs.expiring'] || 0) +
        await checkExpiringDbs(orgId);

      counts['policy.review_due'] =
        (counts['policy.review_due'] || 0) +
        await checkPolicyReviews(orgId);

      counts['care_plan.review_due'] =
        (counts['care_plan.review_due'] || 0) +
        await checkCarePlanReviews(orgId);

      counts['fluid.intake_below_target'] =
        (counts['fluid.intake_below_target'] || 0) +
        await checkFluidIntake(orgId);
    } catch (err: any) {
      logger.error({ orgId, err: err?.message || err }, 'Batch event publisher failed for org');
    }
  }

  logger.info({ counts }, 'Batch event publisher completed');
  return counts;
}

async function checkLateMeds(orgId: string): Promise<number> {
  const result = await query(
    `SELECT a.id AS administration_id, a.emedication_item_id AS item_id,
            a.scheduled_time, mi.name AS medication_name,
            r.person_id, COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS person_name,
            p.location_id, l.name AS location_name,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.scheduled_time))::int / 60 AS late_minutes
     FROM emedication_administrations a
     JOIN emedication_items mi ON a.emedication_item_id = mi.id
     JOIN emedication_records r ON mi.emedication_record_id = r.id
     JOIN people p ON r.person_id = p.id
     LEFT JOIN locations l ON p.location_id = l.id
     WHERE r.organization_id = $1
       AND r.status = 'active'
       AND mi.is_active = TRUE
       AND a.status = 'pending'
       AND a.scheduled_time < CURRENT_TIMESTAMP - interval '30 minutes'
       AND a.scheduled_time > CURRENT_TIMESTAMP - interval '4 hours'
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishAdministrationLateEvent({
      organizationId: orgId,
      administrationId: row.administration_id,
      itemId: row.item_id,
      personId: row.person_id,
      personName: row.person_name,
      medicationName: row.medication_name,
      scheduledTime: row.scheduled_time?.toISOString?.() || String(row.scheduled_time),
      locationId: row.location_id,
      lateMinutes: row.late_minutes,
    }).catch(err => logger.error({ err }, 'Failed to publish medication.administration_late'));
    count++;
  }
  return count;
}

async function checkStockLow(orgId: string): Promise<number> {
  const result = await query(
    `SELECT s.id AS stock_id, s.medication_name, s.dosage, s.unit,
            s.quantity, s.reorder_level, s.person_id,
            COALESCE(p.first_name || ' ' || p.last_name, NULL) AS person_name,
            l.id AS location_id, l.name AS location_name
     FROM emedication_stock s
     LEFT JOIN people p ON s.person_id = p.id
     LEFT JOIN locations l ON p.location_id = l.id
     WHERE s.organization_id = $1
       AND s.status = 'active'
       AND s.quantity IS NOT NULL
       AND s.quantity <= s.reorder_level
       AND s.reorder_level > 0
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishStockLowEvent({
      organizationId: orgId,
      stockId: row.stock_id,
      medicationName: row.medication_name,
      dosage: row.dosage,
      unit: row.unit,
      quantity: row.quantity,
      reorderLevel: row.reorder_level,
      personId: row.person_id,
      personName: row.person_name,
      locationId: row.location_id,
      locationName: row.location_name,
    }).catch(err => logger.error({ err }, 'Failed to publish medication.stock_low'));
    count++;
  }
  return count;
}

async function checkOverdueActions(orgId: string): Promise<number> {
  const result = await query(
    `SELECT ia.id AS action_id, ia.incident_id, i.title AS incident_title,
            ia.action, ia.assigned_to, ia.due_date, i.severity,
            COALESCE(sp.first_name || ' ' || sp.last_name, NULL) AS assigned_name
     FROM incident_actions ia
     JOIN incidents i ON ia.incident_id = i.id
     LEFT JOIN staff_profiles sp ON ia.assigned_to = sp.user_id
     WHERE i.organization_id = $1
       AND ia.completed_at IS NULL
       AND ia.status != 'cancelled'
       AND ia.due_date IS NOT NULL
       AND ia.due_date < CURRENT_DATE
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishIncidentActionOverdueEvent({
      organizationId: orgId,
      actionId: row.action_id,
      incidentId: row.incident_id,
      incidentTitle: row.incident_title,
      action: row.action,
      assignedTo: row.assigned_to,
      assignedName: row.assigned_name,
      dueDate: row.due_date?.toISOString?.()?.split('T')[0] || row.due_date,
      severity: row.severity,
    }).catch(err => logger.error({ err }, 'Failed to publish incident.action_overdue'));
    count++;
  }
  return count;
}

async function checkUnfilledShifts(orgId: string): Promise<number> {
  const result = await query(
    `SELECT s.id AS shift_id, s.location_id, l.name AS location_name,
            s.start_time, s.end_time, s.shift_type,
            EXTRACT(EPOCH FROM (s.start_time - CURRENT_TIMESTAMP))::int / 3600 AS hours_until_start
     FROM shifts s
     JOIN locations l ON s.location_id = l.id
     WHERE l.organization_id = $1
       AND s.staff_id IS NULL
       AND s.status NOT IN ('cancelled', 'completed')
       AND s.start_time > CURRENT_TIMESTAMP
       AND s.start_time < CURRENT_TIMESTAMP + interval '8 hours'
     LIMIT 30`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishShiftUnfilledEvent({
      organizationId: orgId,
      shiftId: row.shift_id,
      locationId: row.location_id,
      locationName: row.location_name,
      startTime: row.start_time?.toISOString?.() || String(row.start_time),
      endTime: row.end_time?.toISOString?.() || String(row.end_time),
      shiftType: row.shift_type || 'day',
      hoursUntilStart: row.hours_until_start,
    }).catch(err => logger.error({ err }, 'Failed to publish shift.unfilled'));
    count++;
  }
  return count;
}

async function checkExpiringTraining(orgId: string): Promise<number> {
  const result = await query(
    `SELECT tr.id AS record_id, tr.module_id, tm.name AS module_name,
            tr.staff_id, COALESCE(sp.first_name || ' ' || sp.last_name, 'Staff') AS staff_name,
            tr.expires_at,
            (tr.expires_at::date - CURRENT_DATE)::int AS days_remaining
     FROM training_records tr
     JOIN training_modules tm ON tr.module_id = tm.id
     JOIN staff_profiles sp ON tr.staff_id = sp.id
     WHERE tm.organization_id = $1
       AND tr.status = 'completed'
       AND tr.expires_at IS NOT NULL
       AND tr.expires_at <= CURRENT_DATE + interval '30 days'
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishTrainingExpiringEvent({
      organizationId: orgId,
      recordId: row.record_id,
      moduleId: row.module_id,
      moduleName: row.module_name,
      staffId: row.staff_id,
      staffName: row.staff_name,
      expiresAt: row.expires_at?.toISOString?.()?.split('T')[0] || String(row.expires_at),
      daysRemaining: row.days_remaining,
    }).catch(err => logger.error({ err }, 'Failed to publish training.expiring'));
    count++;
  }
  return count;
}

async function checkExpiringDbs(orgId: string): Promise<number> {
  const result = await query(
    `SELECT d.id AS document_id, d.type AS dbs_type, d.expiry_date,
            sp.id AS staff_id,
            COALESCE(sp.first_name || ' ' || sp.last_name, 'Staff') AS staff_name,
            (d.expiry_date::date - CURRENT_DATE)::int AS days_remaining
     FROM documents d
     JOIN staff_profiles sp ON d.staff_id = sp.id
     JOIN users u ON sp.user_id = u.id
     WHERE u.organization_id = $1
       AND u.status = 'active'
       AND d.type IN ('DBS', 'ENHANCED_DBS')
       AND d.status NOT IN ('expired', 'rejected')
       AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= CURRENT_DATE + interval '30 days'
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishDbsExpiringEvent({
      organizationId: orgId,
      documentId: row.document_id,
      staffId: row.staff_id,
      staffName: row.staff_name,
      dbsType: row.dbs_type,
      expiryDate: row.expiry_date?.toISOString?.()?.split('T')[0] || String(row.expiry_date),
      daysRemaining: row.days_remaining,
    }).catch(err => logger.error({ err }, 'Failed to publish dbs.expiring'));
    count++;
  }
  return count;
}

async function checkPolicyReviews(orgId: string): Promise<number> {
  const result = await query(
    `SELECT id, title, category, review_due_at,
            (CURRENT_DATE - review_due_at::date)::int AS days_overdue
     FROM policies
     WHERE organization_id = $1
       AND status = 'published'
       AND review_due_at IS NOT NULL
       AND review_due_at <= CURRENT_DATE
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishPolicyReviewDueEvent({
      organizationId: orgId,
      policyId: row.id,
      title: row.title,
      category: row.category,
      reviewDueAt: row.review_due_at?.toISOString?.()?.split('T')[0] || row.review_due_at,
      daysOverdue: row.days_overdue,
    }).catch(err => logger.error({ err }, 'Failed to publish policy.review_due'));
    count++;
  }
  return count;
}

async function checkCarePlanReviews(orgId: string): Promise<number> {
  const result = await query(
    `SELECT cp.id AS care_plan_id, cp.person_id, cp.title, cp.category, cp.review_date,
            COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS person_name,
            (CURRENT_DATE - cp.review_date::date)::int AS days_overdue
     FROM care_plans cp
     JOIN people p ON cp.person_id = p.id
     WHERE p.organization_id = $1
       AND cp.status = 'active'
       AND cp.review_date IS NOT NULL
       AND cp.review_date <= CURRENT_DATE
     LIMIT 50`,
    [orgId]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishCarePlanReviewDueEvent({
      organizationId: orgId,
      carePlanId: row.care_plan_id,
      personId: row.person_id,
      personName: row.person_name,
      title: row.title,
      category: row.category,
      reviewDate: row.review_date?.toISOString?.()?.split('T')[0] || row.review_date,
      daysOverdue: row.days_overdue,
    }).catch(err => logger.error({ err }, 'Failed to publish care_plan.review_due'));
    count++;
  }
  return count;
}

async function checkFluidIntake(orgId: string): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT fi.person_id, COALESCE(SUM(fi.amount_ml), 0)::int AS total_ml,
            COALESCE(p.fluid_daily_target, 2000)::int AS target_ml,
            COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS person_name
     FROM fluid_intake fi
     JOIN people p ON p.id = fi.person_id
     WHERE p.organization_id = $1
       AND fi.recorded_date = $2
     GROUP BY fi.person_id, p.fluid_daily_target, p.first_name, p.last_name
     HAVING COALESCE(SUM(fi.amount_ml), 0) < COALESCE(p.fluid_daily_target, 2000) * 0.7`,
    [orgId, todayStr]
  );

  let count = 0;
  for (const row of result.rows) {
    await publishFluidIntakeBelowTargetEvent({
      organizationId: orgId,
      personId: row.person_id,
      personName: row.person_name,
      recordedDate: todayStr,
      actualMl: row.total_ml,
      targetMl: row.target_ml,
    }).catch(err => logger.error({ err }, 'Failed to publish fluid.intake_below_target'));
    count++;
  }
  return count;
}