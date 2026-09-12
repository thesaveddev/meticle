import { query } from '../../shared/database';
import { EmailService } from '../../shared/utils/email.service';
import logger from '../../shared/utils/logger';
import { isWebPushConfigured, sendPushToUser } from '../notifications/push.service';

/**
 * Creates one reminder ledger row per assigned visit when the travel buffer
 * window opens, then queues email and push independently. The unique visit/type
 * key makes retries idempotent. SMS remains a later adapter until a provider,
 * sender identity and consent policy are approved.
 */
export async function runHomecareVisitReminders(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await query(`
    SELECT v.id, v.organization_id, v.label, v.scheduled_start,
           pe.first_name || ' ' || pe.last_name AS person_name,
           u.id AS carer_user_id,
           u.email AS carer_email,
           COALESCE(vp.travel_buffer_minutes, 15) AS travel_buffer_minutes
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    JOIN staff_profiles sp ON sp.id = v.assigned_staff_id
    JOIN users u ON u.id = sp.user_id
    LEFT JOIN homecare_visit_plans vp ON vp.id = v.visit_plan_id
    WHERE v.status = 'scheduled'
      AND v.assigned_staff_id IS NOT NULL
      AND v.scheduled_start > $1
      AND v.scheduled_start <= $1 + (COALESCE(vp.travel_buffer_minutes, 15) || ' minutes')::interval
      AND v.scheduled_start > $1
  `, [now]);

  let sent = 0;
  let failed = 0;
  for (const visit of due.rows) {
    await query(`
      INSERT INTO homecare_visit_reminders (organization_id, visit_id, reminder_type, status, attempt_count)
      VALUES ($1, $2, 'travel_buffer', 'pending', 0)
      ON CONFLICT (visit_id, reminder_type) DO NOTHING
    `, [visit.organization_id, visit.id]);
    const reminder = await query(`
      SELECT id, status, attempt_count, push_status, push_attempt_count
      FROM homecare_visit_reminders
      WHERE visit_id = $1 AND reminder_type = 'travel_buffer'
    `, [visit.id]);
    const row = reminder.rows[0];
    if (!row) continue;

    if (['pending', 'failed'].includes(row.status) && Number(row.attempt_count || 0) < 3) {
      try {
        await EmailService.sendHomecareVisitReminderEmail(visit.carer_email, 'carer', visit.person_name, visit.label, visit.scheduled_start);
        await query(`UPDATE homecare_visit_reminders SET status = 'sent', attempt_count = attempt_count + 1, sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [row.id]);
        sent++;
      } catch (error: any) {
        await query(`UPDATE homecare_visit_reminders SET status = 'failed', attempt_count = attempt_count + 1, last_error = $2, updated_at = NOW() WHERE id = $1`, [row.id, String(error?.message || 'Email failed').slice(0, 1000)]);
        failed++;
        logger.warn({ visitId: visit.id, error: error?.message }, 'Homecare visit reminder email failed');
      }
    }

    if (['pending', 'failed'].includes(row.push_status) && Number(row.push_attempt_count || 0) < 3) {
      if (!isWebPushConfigured()) {
        await query(`UPDATE homecare_visit_reminders SET push_status = 'skipped', updated_at = NOW() WHERE id = $1`, [row.id]);
      } else {
        try {
          const pushResult = await sendPushToUser(visit.carer_user_id, {
            type: 'homecare_visit',
            visitId: visit.id,
            title: `Upcoming visit — ${visit.label}`,
            body: `${visit.person_name} · starts at ${new Date(visit.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
            url: '/homecare',
          });
          const pushStatus = pushResult.sent > 0 ? 'sent' : pushResult.skipped > 0 ? 'skipped' : 'failed';
          await query(`UPDATE homecare_visit_reminders SET push_status = $2, push_attempt_count = push_attempt_count + 1, push_sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE push_sent_at END, push_last_error = $3, updated_at = NOW() WHERE id = $1`, [row.id, pushStatus, pushResult.failed > 0 ? `${pushResult.failed} subscription(s) failed` : pushResult.skipped > 0 ? 'No active browser subscription' : 'No push subscription accepted the notification']);
        } catch (error: any) {
          await query(`UPDATE homecare_visit_reminders SET push_status = 'failed', push_attempt_count = push_attempt_count + 1, push_last_error = $2, updated_at = NOW() WHERE id = $1`, [row.id, String(error?.message || 'Push failed').slice(0, 1000)]);
          logger.warn({ visitId: visit.id, error: error?.message }, 'Homecare visit push reminder failed');
        }
      }
    }
  }
  return { sent, failed };
}

/**
 * Checks for overdue calls (past scheduled_end but still not completed)
 * and unassigned calls (no carer assigned) and notifies managers.
 */
export async function runHomecareOverdueAlerts(now = new Date()): Promise<{ sent: number; failed: number }> {
  // Find overdue calls — scheduled_end has passed but status is still scheduled/en_route
  const overdue = await query(`
    SELECT v.id, v.organization_id, v.label, v.visit_type, v.scheduled_start, v.scheduled_end,
           pe.first_name || ' ' || pe.last_name AS person_name
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    WHERE v.status IN ('scheduled', 'en_route')
      AND v.scheduled_end < $1
      AND v.exception_type IS NULL
  `, [now]);

  let sent = 0;
  let failed = 0;

  for (const visit of overdue.rows) {
    const overdueMinutes = Math.round((now.getTime() - new Date(visit.scheduled_end).getTime()) / 60000);
    // Only alert once per 30 minutes to avoid spam
    const recentAlert = await query(
      `SELECT id FROM homecare_visit_reminders WHERE visit_id = $1 AND reminder_type = 'overdue_alert' AND created_at > NOW() - INTERVAL '30 minutes'`,
      [visit.id]
    );
    if (recentAlert.rows.length > 0) continue;

    await query(
      `INSERT INTO homecare_visit_reminders (organization_id, visit_id, reminder_type, status, attempt_count)
       VALUES ($1, $2, 'overdue_alert', 'pending', 0) ON CONFLICT (visit_id, reminder_type) DO NOTHING`,
      [visit.organization_id, visit.id]
    );

    try {
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [visit.organization_id]
      );
      for (const m of managers.rows) {
        await EmailService.sendOverdueCallEmail(m.email, m.name, visit.person_name, visit.label || visit.visit_type, visit.scheduled_start, overdueMinutes);
        await sendPushToUser(m.id, { type: 'overdue_call', title: `Overdue call — ${visit.person_name}`, body: `${visit.label || visit.visit_type} is ${overdueMinutes} min overdue`, url: '/homecare' }, 'homecare');
      }
      await query(`UPDATE homecare_visit_reminders SET status = 'sent', attempt_count = attempt_count + 1, sent_at = NOW(), updated_at = NOW() WHERE visit_id = $1 AND reminder_type = 'overdue_alert'`, [visit.id]);
      sent++;
    } catch (error: any) {
      await query(`UPDATE homecare_visit_reminders SET status = 'failed', attempt_count = attempt_count + 1, last_error = $2, updated_at = NOW() WHERE visit_id = $1 AND reminder_type = 'overdue_alert'`, [visit.id, String(error?.message || 'Failed').slice(0, 1000)]);
      failed++;
    }
  }

  // Find unassigned calls — scheduled within next 2 hours but no carer
  const unassigned = await query(`
    SELECT v.id, v.organization_id, v.label, v.visit_type, v.scheduled_start,
           pe.first_name || ' ' || pe.last_name AS person_name
    FROM homecare_visits v
    JOIN people pe ON pe.id = v.person_id
    WHERE v.status = 'scheduled'
      AND v.assigned_staff_id IS NULL
      AND v.scheduled_start > $1
      AND v.scheduled_start <= $1 + INTERVAL '2 hours'
  `, [now]);

  for (const visit of unassigned.rows) {
    const recentAlert = await query(
      `SELECT id FROM homecare_visit_reminders WHERE visit_id = $1 AND reminder_type = 'unassigned_alert' AND created_at > NOW() - INTERVAL '30 minutes'`,
      [visit.id]
    );
    if (recentAlert.rows.length > 0) continue;

    await query(
      `INSERT INTO homecare_visit_reminders (organization_id, visit_id, reminder_type, status, attempt_count)
       VALUES ($1, $2, 'unassigned_alert', 'pending', 0) ON CONFLICT (visit_id, reminder_type) DO NOTHING`,
      [visit.organization_id, visit.id]
    );

    try {
      const managers = await query(
        `SELECT u.id, u.email, COALESCE(sp.first_name, u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON sp.user_id = u.id
         WHERE u.organization_id = $1 AND u.role IN ('ORG_ADMIN', 'MANAGER')`,
        [visit.organization_id]
      );
      for (const m of managers.rows) {
        await EmailService.sendUnassignedCallAlertEmail(m.email, m.name, visit.person_name, visit.label || visit.visit_type, visit.scheduled_start);
        await sendPushToUser(m.id, { type: 'unassigned_call', title: `Unassigned call — ${visit.person_name}`, body: `${visit.label || visit.visit_type} has no carer assigned`, url: '/call-assignment' }, 'homecare');
      }
      await query(`UPDATE homecare_visit_reminders SET status = 'sent', attempt_count = attempt_count + 1, sent_at = NOW(), updated_at = NOW() WHERE visit_id = $1 AND reminder_type = 'unassigned_alert'`, [visit.id]);
      sent++;
    } catch (error: any) {
      await query(`UPDATE homecare_visit_reminders SET status = 'failed', attempt_count = attempt_count + 1, last_error = $2, updated_at = NOW() WHERE visit_id = $1 AND reminder_type = 'unassigned_alert'`, [visit.id, String(error?.message || 'Failed').slice(0, 1000)]);
      failed++;
    }
  }

  return { sent, failed };
}

