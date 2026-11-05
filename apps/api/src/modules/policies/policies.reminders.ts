import { migrateQuery, query } from '../../shared/database';
import logger from '../../shared/utils/logger';
import { runWithOrgContext } from '../events/events.org-context';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';

/**
 * The two promises the policy dialogs make that need a clock rather than a click.
 *
 * 1. Ask staff to read: "We'll send one gentle reminder two days before."
 *    Each read request files a task carrying the policy; the sweep finds the
 *    tasks due the day after tomorrow that have not been completed and have not
 *    been reminded about, nudges the assignee once, and stamps the task so
 *    tomorrow's run leaves it alone.
 *
 * 2. Set review date: "We'll remind you on {date}, a month before." The
 *    review date belongs to the managers, so the sweep tells every active
 *    manager and admin. The condition is an equality on the date — a policy is
 *    due in exactly thirty days on exactly one day — so there is nothing to
 *    stamp and no second run to guard against.
 *
 * Both run inside each organisation's own context, so CURRENT_DATE means the
 * provider's day rather than the server's.
 */

interface ReadReminderRow {
  task_id: string;
  user_id: string;
  email: string | null;
  name: string;
  policy_id: string;
  policy_title: string;
  read_by: string | null;
}

async function sweepReadReminders(orgId: string): Promise<number> {
  const result = await query(
    `SELECT t.id AS task_id, u.id AS user_id, u.email,
            COALESCE(sp.first_name || ' ' || sp.last_name, u.email) AS name,
            p.id AS policy_id, p.title AS policy_title,
            t.due_date::date AS read_by
       FROM tasks t
       JOIN staff_profiles sp ON sp.id = t.assigned_to
       JOIN users u ON u.id = sp.user_id
       JOIN policies p ON p.id = t.policy_id
      WHERE t.organization_id = $1
        AND t.policy_id IS NOT NULL
        AND t.reminder_sent_at IS NULL
        AND t.status <> 'completed'
        AND t.due_date IS NOT NULL
        AND t.due_date::date = (CURRENT_DATE + INTERVAL '2 days')::date`,
    [orgId]
  );
  let reminded = 0;
  for (const row of result.rows as ReadReminderRow[]) {
    try {
      const link = `/policies/${row.policy_id}`;
      await NotificationsController.createNotification(
        row.user_id,
        `Reminder — please read ${row.policy_title}`,
        `A gentle reminder: please read the “${row.policy_title}” policy${row.read_by ? ` by ${row.read_by}` : ''} and use Mark as read.`,
        'general',
        link,
      );
      if (row.email) {
        await EmailService.sendPolicyReadRequestEmail(
          row.email, row.name, { title: row.policy_title },
          'Your manager', row.read_by || undefined,
          'A gentle reminder: this is still waiting for your sign-off.',
          EmailService.policyUrl(row.policy_id),
          { reminder: true },
        );
      }
      await query('UPDATE tasks SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id = $1', [row.task_id]);
      reminded++;
    } catch (err: any) {
      logger.error({ err: err?.message, taskId: row.task_id }, 'Policy read reminder failed for task');
    }
  }
  return reminded;
}

async function sweepReviewReminders(orgId: string): Promise<number> {
  const due = await query(
    `SELECT id, title, review_due_at::date AS review_due
       FROM policies
      WHERE organization_id = $1
        AND status = 'published'
        AND review_due_at IS NOT NULL
        AND review_due_at::date = (CURRENT_DATE + INTERVAL '30 days')::date`,
    [orgId]
  );
  if (due.rows.length === 0) return 0;
  const managers = await query(
    `SELECT id, email FROM users
      WHERE organization_id = $1 AND status = 'active' AND role IN ('ORG_ADMIN', 'MANAGER')`,
    [orgId]
  );
  let reminded = 0;
  for (const policy of due.rows) {
    for (const manager of managers.rows) {
      try {
        await NotificationsController.createNotification(
          manager.id,
          `Review due soon — ${policy.title}`,
          `“${policy.title}” is due for review on ${policy.review_due} — a month from today. Read it through and set the next date.`,
          'general',
          `/policies/${policy.id}`,
        );
        reminded++;
      } catch { /* per-recipient notification non-critical */ }
    }
  }
  return reminded;
}

export async function runPolicyReminderSweeps(): Promise<{ readReminded: number; reviewReminded: number; orgs: number; failed: number }> {
  const orgs = await migrateQuery('SELECT id FROM organizations');
  let readReminded = 0;
  let reviewReminded = 0;
  let failed = 0;
  for (const org of orgs.rows) {
    try {
      const reads = await runWithOrgContext(org.id, () => sweepReadReminders(org.id));
      const reviews = await runWithOrgContext(org.id, () => sweepReviewReminders(org.id));
      readReminded += reads;
      reviewReminded += reviews;
    } catch (err: any) {
      failed++;
      logger.error({ err: err?.message, orgId: org.id }, 'Policy reminder sweep failed for organisation');
    }
  }
  return { readReminded, reviewReminded, orgs: orgs.rows.length, failed };
}
