import pool from '../database';
import { EmailService } from './email.service';

const TRIAL_REMINDER_DAYS = [7, 3, 1];

export async function checkTrialExpirations() {
  const result = await pool.query(
    `SELECT o.id, o.name as org_name, u.email, COALESCE(sp.first_name, u.email) as name,
            o.trial_ends_at,
            (SELECT COUNT(*) FROM payment_methods WHERE organization_id = o.id) as card_count,
            (SELECT COALESCE(bool_or(sent_at IS NOT NULL), false) FROM trial_reminders WHERE organization_id = o.id AND reminder_days = EXTRACT(DAY FROM (o.trial_ends_at - CURRENT_DATE)) AND sent_at IS NOT NULL) as already_reminded
     FROM organizations o
     JOIN users u ON u.organization_id = o.id AND u.role = 'ORG_ADMIN' AND u.status = 'active'
     LEFT JOIN staff_profiles sp ON u.id = sp.user_id
     WHERE o.subscription_status = 'trial'
       AND o.trial_ends_at IS NOT NULL
       AND o.trial_ends_at > CURRENT_DATE - INTERVAL '1 day'`
  );

  for (const org of result.rows) {
    if (!org.email) continue;

    const hasCard = org.card_count > 0;
    const trialEnd = new Date(org.trial_ends_at);
    const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);

    // Send milestone reminders
    if (TRIAL_REMINDER_DAYS.includes(daysLeft)) {
      const existing = await pool.query(
        'SELECT id FROM trial_reminders WHERE organization_id = $1 AND reminder_days = $2',
        [org.id, daysLeft]
      );
      if (existing.rows.length > 0) continue;

      await pool.query(
        'INSERT INTO trial_reminders (organization_id, reminder_days) VALUES ($1, $2)',
        [org.id, daysLeft]
      );

      EmailService.sendTrialExpiringEmail(org.email, org.name, org.org_name, daysLeft, hasCard)
        .catch(() => {});
    }

    // The day after expiry — send expired notice and transition status
    if (daysLeft < 0) {
      const existing = await pool.query(
        'SELECT id FROM trial_reminders WHERE organization_id = $1 AND reminder_days = -1',
        [org.id]
      );
      if (existing.rows.length > 0) continue;

      await pool.query(
        'INSERT INTO trial_reminders (organization_id, reminder_days) VALUES ($1, $2)',
        [org.id, -1]
      );

      await pool.query(
        `UPDATE organizations SET subscription_status = 'expired' WHERE id = $1 AND subscription_status = 'trial'`,
        [org.id]
      );

      EmailService.sendTrialExpiredEmail(org.email, org.name, org.org_name, hasCard)
        .catch(() => {});
    }
  }
}
