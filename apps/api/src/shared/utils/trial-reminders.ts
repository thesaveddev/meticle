import { migrateQuery } from '../database';
import { EmailService } from './email.service';
import { getStripe } from '../services/stripe.service';

const SUBSCRIPTION_REMINDER_DAYS = [1, 3, 7];

export function selectReminderMilestone(daysLeft: number, milestones = SUBSCRIPTION_REMINDER_DAYS): number | null {
  if (daysLeft < 1) return null;
  return [...milestones].sort((a, b) => a - b).find(day => daysLeft <= day) ?? null;
}

export function isSubscriptionExpired(daysLeft: number): boolean {
  return daysLeft <= 0;
}

const EXPIRY_STATUSES = new Set(['trial', 'active', 'past_due']);
const WINBACK_STATUSES = new Set(['trial', 'active', 'past_due', 'canceled']);
const BILLING_RECIPIENT_ROLES = "('ORG_ADMIN', 'MANAGER')";

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
            (SELECT COUNT(*) FROM payment_methods WHERE organization_id = o.id) as card_count
     FROM organizations o
     WHERE o.subscription_status <> 'expired'`
  );

  let reminded = 0;
  let expired = 0;

  for (const org of result.rows) {
    const admins = await migrateQuery(
      `SELECT DISTINCT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
       FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE u.organization_id = $1 AND u.role IN ${BILLING_RECIPIENT_ROLES} AND u.status = 'active' AND u.email IS NOT NULL`,
      [org.id]
    );
    if (admins.rows.length === 0) continue;

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
      const milestone = selectReminderMilestone(daysLeft);
      if (milestone == null) continue;
      if (!(await alreadyNotified(milestone))) {
        for (const admin of admins.rows) {
          if (isTrial) {
            await EmailService.sendTrialExpiringEmail(admin.email, admin.name || admin.email, org.org_name, daysLeft, hasCard);
          } else {
            await EmailService.sendSubscriptionExpiringEmail(admin.email, admin.name || admin.email, org.org_name, daysLeft, hasCard);
          }
        }
        await markNotified(milestone);
        reminded++;
      }
    }

    // The expiry-day case is intentionally included. A 12-hour scheduler can
    // run on the exact end date, and it must not wait until the next day to
    // notify the organisation. The -1 marker makes this idempotent.
    if (isSubscriptionExpired(daysLeft) && WINBACK_STATUSES.has(status)) {
      if (await alreadyNotified(-1)) continue;

      for (const admin of admins.rows) {
        if (isTrial) {
          await EmailService.sendTrialExpiredEmail(admin.email, admin.name || admin.email, org.org_name, hasCard);
        } else {
          await EmailService.sendSubscriptionExpiredEmail(admin.email, admin.name || admin.email, org.org_name);
        }
      }
      await markNotified(-1);
      if (EXPIRY_STATUSES.has(status)) {
        await migrateQuery(`UPDATE organizations SET subscription_status = 'expired' WHERE id = $1`, [org.id]);
      }
      expired++;
    }
  }

  return { reminded, expired };
}

// ── Winback campaign — post-expiry follow-up sequence ──
// Sends a series of emails after trial/subscription expiry to re-engage users.
// Milestones: day 3, 7, 14, 30, and final (day 89 — day before data deletion).
const WINBACK_MILESTONES = [
  { daysAfterExpiry: 3, type: 'day_3', subject: 'We miss you' },
  { daysAfterExpiry: 7, type: 'day_7', subject: 'Your data is waiting' },
  { daysAfterExpiry: 14, type: 'day_14', subject: 'Data retention notice' },
  { daysAfterExpiry: 30, type: 'day_30', subject: 'Final reminder' },
  { daysAfterExpiry: 89, type: 'final', subject: 'Data deletion tomorrow' },
];

async function sendWinbackEmail(emailType: string, email: string, name: string, orgName: string) {
  switch (emailType) {
    case 'day_3': return EmailService.sendWinbackDay3Email(email, name, orgName);
    case 'day_7': return EmailService.sendWinbackDay7Email(email, name, orgName);
    case 'day_14': return EmailService.sendWinbackDay14Email(email, name, orgName);
    case 'day_30': return EmailService.sendWinbackDay30Email(email, name, orgName);
    case 'final': return EmailService.sendWinbackFinalEmail(email, name, orgName);
  }
}

export async function runWinbackCampaign() {
  // Find all expired organizations whose data hasn't been deleted yet
  const orgs = await migrateQuery(
    `SELECT o.id, o.name as org_name, o.subscription_status, o.trial_ends_at, o.current_period_end,
            o.data_retention_days, o.data_deleted_at,
            (SELECT COUNT(*) FROM payment_methods WHERE organization_id = o.id) as card_count
     FROM organizations o
     WHERE o.subscription_status = 'expired'
       AND o.data_deleted_at IS NULL`
  );

  let sent = 0;
  let deleted = 0;

  for (const org of orgs.rows) {
    // Determine when the subscription expired
    const expiredAt = org.trial_ends_at || org.current_period_end;
    if (!expiredAt) continue;

    const daysSinceExpiry = Math.floor((Date.now() - new Date(expiredAt).getTime()) / 86400000);
    const retentionDays = org.data_retention_days || 90;

    // Check if retention period has elapsed — mark for deletion
    if (daysSinceExpiry >= retentionDays) {
      // Send final warning first if not already sent
      const hasFinal = await migrateQuery(
        'SELECT id FROM winback_emails WHERE organization_id = $1 AND email_type = $2',
        [org.id, 'final']
      );
      if (hasFinal.rows.length === 0) {
        const admins = await migrateQuery(
          `SELECT DISTINCT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
           FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
           WHERE u.organization_id = $1 AND u.role IN ${BILLING_RECIPIENT_ROLES} AND u.status = 'active'`,
          [org.id]
        );
        for (const admin of admins.rows) {
          if (admin.email) {
            await sendWinbackEmail('final', admin.email, admin.name || admin.email, org.org_name);
            await migrateQuery(
              'INSERT INTO winback_emails (organization_id, email_type, recipient_email, recipient_name) VALUES ($1, $2, $3, $4)',
              [org.id, 'final', admin.email, admin.name]
            );
          }
        }
      }

      // Mark data for deletion (actual cleanup handled by a separate job)
      await migrateQuery(
        `UPDATE organizations SET data_deleted_at = NOW() WHERE id = $1 AND data_deleted_at IS NULL`,
        [org.id]
      );
      deleted++;
      continue;
    }

    // Check which winback milestone is due
    for (const milestone of WINBACK_MILESTONES) {
      if (daysSinceExpiry < milestone.daysAfterExpiry) break;

      // Check if already sent
      const existing = await migrateQuery(
        'SELECT id FROM winback_emails WHERE organization_id = $1 AND email_type = $2',
        [org.id, milestone.type]
      );
      if (existing.rows.length > 0) continue;

      // Get billing recipients
      const admins = await migrateQuery(
        `SELECT DISTINCT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
         FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
         WHERE u.organization_id = $1 AND u.role IN ${BILLING_RECIPIENT_ROLES} AND u.status = 'active'`,
        [org.id]
      );

      for (const admin of admins.rows) {
        if (admin.email) {
          await sendWinbackEmail(milestone.type, admin.email, admin.name || admin.email, org.org_name);
          await migrateQuery(
            'INSERT INTO winback_emails (organization_id, email_type, recipient_email, recipient_name) VALUES ($1, $2, $3, $4)',
            [org.id, milestone.type, admin.email, admin.name]
          );
          sent++;
        }
      }
      break; // Only send one milestone per org per run
    }
  }

  return { sent, deleted };
}

const INVOICE_REMINDER_DAYS = [1, 3, 7];

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
    const milestone = selectReminderMilestone(daysUntilDue, INVOICE_REMINDER_DAYS);
    if (milestone == null) continue;

    // Dedupe: check if we already sent this reminder for this invoice
    const key = `inv_reminder_${inv.id}_${milestone}`;
    const existing = await migrateQuery(
      'SELECT id FROM trial_reminders WHERE organization_id = $1 AND kind = $2 AND reminder_days = $3',
      [inv.organization_id, key, milestone]
    );
    if (existing.rows.length > 0) continue;

    // Get billing recipients for this org
    const admins = await migrateQuery(
      `SELECT DISTINCT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
       FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id
       WHERE u.organization_id = $1 AND u.role IN ${BILLING_RECIPIENT_ROLES} AND u.status = 'active'`,
      [inv.organization_id]
    );

    for (const admin of admins.rows) {
      if (!admin.email) continue;
      await EmailService.sendInvoiceReminderEmail(admin.email, admin.name || admin.email, inv.org_name, {
        amount: inv.amount,
        currency: inv.currency,
        dueDate: inv.due_date,
        daysUntilDue: milestone,
      });
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
