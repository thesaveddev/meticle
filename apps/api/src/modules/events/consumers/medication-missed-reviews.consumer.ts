import { query } from '../../../shared/database';
import logger from '../../../shared/utils/logger';
import { TaskRepository } from '../../tasks/tasks.repository';
import { NotificationsController } from '../../notifications/notifications.controller';
import { DomainEvent, EventConsumer } from '../events.consumers';
import type { MedicationAdministrationMissedPayload } from '../../emedication/medication.events';

/**
 * §13.1 Missed Medication Workflow — first stage.
 *
 * Drains `medication.administration_missed` events by:
 *   1. Drafting a high-priority `tasks` row for the on-duty manager to review
 *      the missed administration and decide on follow-up (re-dose, contact
 *      GP, escalation per local protocol).
 *   2. Notifying the first ORG_ADMIN we find via NotificationsController (which
 *      fans out to active manager_delegations, so the right person is paged
 *      even if the named admin is off-shift).
 *
 * Does NOT:
 *   - Make clinical decisions, recommend doses, or change care plans.
 *   - Re-publish a duplicate task when the same missed-admin event has already
 *     been processed (idempotency check via tasks.title).
 *   - Email family members or external parties (family-portal is
 *     consent-gated; ownership stays with the org manager's review).
 *
 * Re-raises on infrastructure failures (DB down) so the outbox retry path
 * kicks in — the upper bound is 3 attempts across 5-second poll intervals.
 */
export const MedicationMissedReviewsConsumer: EventConsumer = {
  name: 'medication-missed-reviews',

  async handle(event: DomainEvent) {
    const payload = event.payload as unknown as MedicationAdministrationMissedPayload;
    const orgId = event.organizationId;

    if (!payload?.id || !payload.person_id) {
      logger.warn(
        { eventId: event.id, payload },
        'medication-missed-reviews: payload missing required fields; skipping'
      );
      return;
    }

    // Idempotency: skip if a task has already been drafted for this
    // administration (handles retry after partial-success and the rare
    // re-emission path in updateAdministration).
    const dedupeRow = await query(
      `SELECT id FROM tasks
       WHERE organization_id = $1
         AND title = $2
       LIMIT 1`,
      [orgId, buildTaskTitle(payload)]
    );
    if (dedupeRow.rows.length > 0) {
      logger.debug(
        { orgId, eventId: event.id, administrationId: payload.id },
        'medication-missed-reviews: task already drafted for this administration; skipping'
      );
      return;
    }

    // Draft the review task. Unassigned so any on-duty manager can pick it up
    // — assignee resolution against the actual rota is a future iteration.
    const description = buildTaskDescription(payload);
    await TaskRepository.create(orgId, {
      title: buildTaskTitle(payload),
      description,
      assigned_to: null,
      person_id: payload.person_id,
      priority: 'high',
      status: 'pending',
      // Same-day review by default; orgs can bulk-sweep via the standard
      // tasks filter and bump the due date on review.
      due_date: nextDayIsoDate(),
      created_by: null,
    });

    // Pick a notification seed user. We always prefer an ORG_ADMIN (the role
    // with the broadest notify-permissions); NotificationsController.createNotification
    // then propagates to every active delegate of that admin automatically.
    const adminRow = await query(
      `SELECT id FROM users
       WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [orgId]
    );

    if (adminRow.rows.length === 0) {
      logger.warn(
        { orgId, eventId: event.id, administrationId: payload.id },
        'medication-missed-reviews: no active ORG_ADMIN — task drafted, no notification sent'
      );
      return;
    }

    try {
      await NotificationsController.createNotification(
        adminRow.rows[0].id,
        'Missed medication needs review',
        `${payload.person_name} missed ${payload.medication_name} scheduled for ${payload.scheduled_time}. A task has been queued for on-duty manager review.`,
        'general'
      );
    } catch (err) {
      // Task is durably created; notification best-effort.
      logger.warn(
        { err: (err as Error)?.message, orgId, eventId: event.id },
        'medication-missed-reviews: notification fan-out failed (task still drafted)'
      );
    }
  },
};

function buildTaskTitle(payload: MedicationAdministrationMissedPayload): string {
  return `Review missed ${payload.medication_name} for ${payload.person_name}`;
}

function buildTaskDescription(payload: MedicationAdministrationMissedPayload): string {
  const whenLine = `Scheduled: ${payload.scheduled_time}`;
  const reasonLine = payload.reason ? `Reason recorded: ${payload.reason}` : 'No reason recorded.';
  const notesLine = payload.notes ? `Notes: ${payload.notes}` : '';
  const prnLine = payload.is_prn ? 'This was a PRN dose.' : '';
  const recordedLine = `Recorded by user ${payload.logged_by_user_id} at ${payload.recorded_at}.`;
  return [
    'A medication administration was logged as missed.',
    whenLine,
    reasonLine,
    notesLine,
    prnLine,
    recordedLine,
    'Review and decide on follow-up per local protocol (do not auto-administer; contact prescriber if clinically indicated).',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Tomorrow's date as YYYY-MM-DD in server local time — task due "by end of next day". */
function nextDayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
