import { migrateQuery } from '../database';
import { EmailService } from './email.service';

const SUBSCRIPTION_REMINDER_DAYS = [7, 3, 1];

const EXPIRY_STATUSES = new Set(['trial', 'active', 'past_due']);
const WINBACK_STATUSES = new Set(['trial', 'active', 'past_due', 'canceled']);

export async function checkSubscriptionExpirations() {
  // Background job — no RLS session context, so every query uses migrateQuery
  // (superuser pool) to avoid the FORCE-RLS tables (users, trial_reminders)
  // silently filtering all rows to zero.
  const result = await migrateQuery(
    `SELECT o.id, o.name as org_name, o.subscription_status, o.trial_ends_at, o.current_period_end,
            u.email, COALESCE(sp.first_name, u.email) as name,
            (SELECT COUNT(*) FROM payment_methods WHERE organization_id = o.id) as card_count
     FROM organizations o
     JOIN users u ON u.organization_id = o.id AND u.role = 'ORG_ADMIN' AND u.status = 'active'
     LEFT JOIN staff_profiles sp ON u.id = sp.user_id
     WHERE o.subscription_status <> 'expired'`
  );

  let reminded = 0;
  let expired = 0;

  for (const org of result.rows) {
    if (!org.email) continue;

    const status = org.subscription_status || 'trial';
    const isTrial = status === 'trial';
    const expiryAt = isTrial ? org.trial_ends_at : org.current_period_end;
    if (!expiryAt) continue;

    const hasCard = org.card_count > 0;
    const kind = isTrial ? 'trial' : 'subscription';
    const daysLeft = Math.ceil((new Date(expiryAt).getTime() - Date.now()) / 86400000);

    const alreadyNotified = async (reminderDays: number) => {
      const existing = await migrateQuery(
        'SELECT id FROM trial_reminders WHERE organization_id = $1 AND kind = $2 AND reminder_days = $3',
        [org.id, kind, reminderDays]
      );
      return existing.rows.length > 0;
    };
    const markNotified = async (reminderDays: number) => {
      await migrateQuery(
        'INSERT INTO trial_reminders (organization_id, kind, reminder_days) VALUES ($1, $2, $3)',
        [org.id, kind, reminderDays]
      );
    };

    // 7 / 3 / 1-day renewal reminders (canceled/expired orgs don't get nudged)
    if (daysLeft >= 1 && EXPIRY_STATUSES.has(status) && SUBSCRIPTION_REMINDER_DAYS.includes(daysLeft)) {
      if (await alreadyNotified(daysLeft)) continue;

      await markNotified(daysLeft);
      if (isTrial) {
        EmailService.sendTrialExpiringEmail(org.email, org.name, org.org_name, daysLeft, hasCard).catch(() => {});
      } else {
        EmailService.sendSubscriptionExpiringEmail(org.email, org.name, org.org_name, daysLeft, hasCard).catch(() => {});
      }
      reminded++;
    }

    // Period end passed — win-back email + transition to expired (backstop for webhooks)
    if (daysLeft < 0 && WINBACK_STATUSES.has(status)) {
      if (await alreadyNotified(-1)) continue;

      await markNotified(-1);
      if (EXPIRY_STATUSES.has(status)) {
        await migrateQuery(`UPDATE organizations SET subscription_status = 'expired' WHERE id = $1`, [org.id]);
      }
      if (isTrial) {
        EmailService.sendTrialExpiredEmail(org.email, org.name, org.org_name, hasCard).catch(() => {});
      } else {
        EmailService.sendSubscriptionExpiredEmail(org.email, org.name, org.org_name).catch(() => {});
      }
      expired++;
    }
  }

  return { reminded, expired };
}
