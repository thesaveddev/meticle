import { migrateQuery } from '../database';
import { EmailService } from './email.service';
import { getStripe } from '../services/stripe.service';

const SUBSCRIPTION_REMINDER_DAYS = [7, 3, 1];

const EXPIRY_STATUSES = new Set(['trial', 'active', 'past_due']);
const WINBACK_STATUSES = new Set(['trial', 'active', 'past_due', 'canceled']);

/**
 * Reconcile live Stripe state into the DB before the reminder pass. Webhooks can
 * be missed (server down, misconfigured endpoint) — this makes the job
 * self-healing so current_period_end / status stay accurate for both
 * enforcement (auth middleware) and reminder emails.
 */
async function reconcileStripeSubscriptions() {
  const stripe = getStripe();
  if (!stripe) return;
  const orgs = await migrateQuery(
    `SELECT id, stripe_customer_id FROM organizations
     WHERE stripe_customer_id IS NOT NULL
       AND subscription_status IN ('trial', 'active', 'past_due')`
  );
  for (const org of orgs.rows) {
    try {
      const subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 1, status: 'all' });
      const sub = subs.data[0];
      if (!sub) {
        // Customer exists but no subscription — the plan lapsed on Stripe's side.
        await migrateQuery(`UPDATE organizations SET subscription_status = 'canceled' WHERE id = $1`, [org.id]);
        continue;
      }
      const mapped =
        sub.status === 'active' ? 'active' :
        sub.status === 'trialing' ? 'trial' :
        sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' :
        sub.status === 'canceled' ? 'canceled' : null;
      const periodEnd = (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null;
      const trialEnd = (sub as any).trial_end ? new Date((sub as any).trial_end * 1000).toISOString() : null;
      await migrateQuery(
        `UPDATE organizations SET
           subscription_status = COALESCE($1, subscription_status),
           current_period_end = COALESCE($2, current_period_end),
           trial_ends_at = COALESCE($3, trial_ends_at)
         WHERE id = $4`,
        [mapped, periodEnd, trialEnd, org.id]
      );
    } catch {
      /* best-effort — a failed Stripe lookup must not break the reminder pass */
    }
  }
}

export async function checkSubscriptionExpirations() {
  // Background job — no RLS session context, so every query uses migrateQuery
  // (superuser pool) to avoid the FORCE-RLS tables (users, trial_reminders)
  // silently filtering all rows to zero.
  await reconcileStripeSubscriptions();

  const result = await migrateQuery(
    `SELECT o.id, o.name as org_name, o.subscription_status, o.trial_ends_at, o.current_period_end,
            u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name,
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

    // 7 / 3 / 1-day renewal reminders (canceled/expired orgs don't get nudged).
    // Send the closest milestone that's due and not yet sent — this fires even if
    // the job was down on the exact day, and each milestone is deduped so a single
    // run can never spam multiple reminders.
    if (daysLeft >= 1 && EXPIRY_STATUSES.has(status)) {
      const milestone = SUBSCRIPTION_REMINDER_DAYS.find(d => daysLeft <= d) ?? 1;
      if (!(await alreadyNotified(milestone))) {
        await markNotified(milestone);
        if (isTrial) {
          EmailService.sendTrialExpiringEmail(org.email, org.name, org.org_name, daysLeft, hasCard).catch(() => {});
        } else {
          EmailService.sendSubscriptionExpiringEmail(org.email, org.name, org.org_name, daysLeft, hasCard).catch(() => {});
        }
        reminded++;
      }
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

const INVOICE_REMINDER_DAYS = [7, 3, 1];

/**
 * Send reminder emails for open invoices approaching their due date.
 * Runs alongside the subscription expiry check.
 */
export async function checkInvoiceReminders() {
  const result = await migrateQuery(
    `SELECT i.id, i.organization_id, i.amount, i.currency, i.description, i.due_date,
            o.name as org_name
     FROM invoices i
     JOIN organizations o ON o.id = i.organization_id
     WHERE i.status = 'open' AND i.due_date IS NOT NULL AND i.due_date >= CURRENT_DATE`
  );

  let reminded = 0;

  for (const inv of result.rows) {
    const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
    if (daysUntilDue < 0) continue;

    // Find the closest reminder milestone (7, 3, or 1 day before due)
    const milestone = INVOICE_REMINDER_DAYS.find(d => daysUntilDue <= d);
    if (!milestone) continue;

    // Dedupe: check if we already sent this reminder for this invoice
    const key = `inv_reminder_${inv.id}_${milestone}`;
    const existing = await migrateQuery(
      'SELECT id FROM trial_reminders WHERE organization_id = $1 AND kind = $2 AND reminder_days = $3',
      [inv.organization_id, key, milestone]
    );
    if (existing.rows.length > 0) continue;

    // Get admin emails for this org
    const admins = await migrateQuery(
      "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
      [inv.organization_id]
    );

    for (const admin of admins.rows) {
      if (!admin.email) continue;
      EmailService.sendInvoiceReminderEmail(admin.email, admin.name || admin.email, inv.org_name, {
        amount: inv.amount,
        currency: inv.currency,
        dueDate: inv.due_date,
        daysUntilDue: milestone,
      }).catch(() => {});
    }

    // Mark as reminded
    await migrateQuery(
      'INSERT INTO trial_reminders (organization_id, kind, reminder_days) VALUES ($1, $2, $3)',
      [inv.organization_id, key, milestone]
    );
    reminded++;
  }

  return { reminded };
}
