import { migrateQuery } from '../database';
import { getStripe } from '../services/stripe.service';
import logger, { logWarn } from './logger';
import { NotificationsController } from '../../modules/notifications/notifications.controller';
import { EmailService } from './email.service';

/**
 * Map Stripe subscription status to our internal status.
 * Stripe canonical: active, trialing, past_due, unpaid, canceled, incomplete, incomplete_expired
 */
function mapStripeStatus(stripeStatus: string): string | null {
  switch (stripeStatus) {
    case 'active': return 'active';
    case 'trialing': return 'trial';
    case 'past_due':
    case 'unpaid': return 'past_due';
    case 'canceled':
    case 'incomplete_expired': return 'canceled';
    case 'incomplete': return 'trial'; // Setup intent not yet completed — treat as trial
    default: return null;
  }
}

/**
 * Run the Stripe subscription status sync job.
 *
 * This job:
 * 1. Finds all orgs with a stripe_customer_id
 * 2. Queries Stripe for their current subscription status
 * 3. Updates the database to match Stripe's canonical state
 * 4. Sends notification emails when status changes
 *
 * Runs every hour (configured in index.ts). This is the source of truth for
 * subscription status — webhooks may be missed, but this job self-heals.
 *
 * Orgs without a stripe_customer_id are skipped (they're on local trial only).
 */
export async function syncStripeSubscriptionStatus(): Promise<{ synced: number; changed: number; errors: number }> {
  const stripe = getStripe();
  if (!stripe) {
    logger.debug('Stripe not configured — skipping subscription sync');
    return { synced: 0, changed: 0, errors: 0 };
  }

  // Get ALL orgs with a Stripe customer ID — not just active ones.
  // A previously canceled org might have been reactivated on Stripe.
  const orgs = await migrateQuery(
    `SELECT id, name, subscription_status, stripe_customer_id, current_period_end, trial_ends_at, grace_period_days
     FROM organizations
     WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> ''`
  );

  let synced = 0;
  let changed = 0;
  let errors = 0;

  for (const org of orgs.rows) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: org.stripe_customer_id,
        limit: 1,
        status: 'all',
      });

      const sub = subs.data[0];

      if (!sub) {
        // Stripe customer exists but no subscription — mark as canceled if not already
        if (org.subscription_status !== 'canceled' && org.subscription_status !== 'expired') {
          await migrateQuery(
            `UPDATE organizations SET subscription_status = 'canceled', grace_period_ends_at = NULL WHERE id = $1`,
            [org.id]
          );
          logger.info({ orgId: org.id, orgName: org.name, prevStatus: org.subscription_status },
            'Stripe sync: marked org as canceled (no subscription found)');
          changed++;
          await notifyStatusChange(org, org.subscription_status, 'canceled');
        }
        synced++;
        continue;
      }

      const newStatus = mapStripeStatus(sub.status);
      if (!newStatus) {
        logger.warn({ orgId: org.id, stripeStatus: sub.status }, 'Stripe sync: unknown status');
        errors++;
        continue;
      }

      const periodEnd = (sub as any).current_period_end
        ? new Date((sub as any).current_period_end * 1000).toISOString()
        : null;
      const gracePeriodEndsAt = ['active', 'past_due'].includes(newStatus) && periodEnd
        ? new Date(new Date(periodEnd).getTime() + (Math.max(0, Math.min(30, Number(org.grace_period_days ?? 7))) * 24 * 60 * 60 * 1000)).toISOString()
        : null;
      const trialEnd = (sub as any).trial_end
        ? new Date((sub as any).trial_end * 1000).toISOString()
        : null;

      // Only update if something actually changed
      const statusChanged = newStatus !== org.subscription_status;
      const periodEndChanged = periodEnd && periodEnd !== org.current_period_end;
      const trialEndChanged = trialEnd && trialEnd !== org.trial_ends_at;

      if (statusChanged || periodEndChanged || trialEndChanged) {
        await migrateQuery(
          `UPDATE organizations SET
             subscription_status = COALESCE($1, subscription_status),
             current_period_end = COALESCE($2, current_period_end),
             trial_ends_at = COALESCE($3, trial_ends_at),
             grace_period_ends_at = CASE WHEN $1 IN ('active', 'past_due') AND $2 IS NOT NULL THEN $5 ELSE NULL END
           WHERE id = $4`,
          [
            statusChanged ? newStatus : null,
            periodEndChanged ? periodEnd : null,
            trialEndChanged ? trialEnd : null,
            org.id,
            gracePeriodEndsAt,
          ]
        );

        if (statusChanged) {
          logger.info({
            orgId: org.id,
            orgName: org.name,
            prevStatus: org.subscription_status,
            newStatus,
            stripeStatus: sub.status,
          }, 'Stripe sync: status changed');
          await notifyStatusChange(org, org.subscription_status, newStatus);
          changed++;
        }
      }

      synced++;
    } catch (err: any) {
      logger.error({ orgId: org.id, error: err.message }, 'Stripe sync: failed to check org');
      errors++;
    }
  }

  if (synced > 0 || changed > 0 || errors > 0) {
    logger.info({ synced, changed, errors }, 'Stripe subscription sync completed');
  }

  return { synced, changed, errors };
}

/**
 * Notify org admins when their subscription status changes.
 * Only sends emails for meaningful transitions (not every small update).
 */
async function notifyStatusChange(
  org: { id: string; name: string; subscription_status: string },
  oldStatus: string | null,
  newStatus: string
) {
  // Only notify on these transitions
  const shouldNotify =
    (oldStatus === 'canceled' && newStatus === 'active') ||  // Reactivated
    (oldStatus === 'canceled' && newStatus === 'trial') ||   // Re-trialed
    (oldStatus === 'active' && newStatus === 'canceled') ||  // Canceled
    (oldStatus === 'trial' && newStatus === 'canceled') ||   // Trial expired
    (oldStatus === 'active' && newStatus === 'past_due') ||  // Payment failing
    (oldStatus === 'past_due' && newStatus === 'active');    // Payment recovered

  if (!shouldNotify) return;

  const admins = await migrateQuery(
    `SELECT u.id, u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name
     FROM users u
     LEFT JOIN staff_profiles sp ON u.id = sp.user_id
     WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'`,
    [org.id]
  );

  for (const admin of admins.rows) {
    if (!admin.email) continue;

    // In-app notification
    const title = getNotificationTitle(oldStatus, newStatus);
    const message = getNotificationMessage(org.name, oldStatus, newStatus);
    NotificationsController.createNotification(admin.id, title, message, 'billing')
      .catch(logWarn('stripe sync notification'));

    // Email notification for important transitions
    if (
      (oldStatus === 'canceled' && newStatus === 'active') ||
      (oldStatus === 'active' && newStatus === 'canceled') ||
      (oldStatus === 'trial' && newStatus === 'canceled')
    ) {
      const subject = getEmailSubject(oldStatus, newStatus);
      const html = getEmailHtml(admin.name, org.name, oldStatus, newStatus);
      EmailService.sendQueued(admin.email, subject, html, 'billing')
        .catch(logWarn('stripe sync email'));
    }
  }
}

function getNotificationTitle(oldStatus: string | null, newStatus: string): string {
  if (oldStatus === 'canceled' && newStatus === 'active') return 'Subscription Reactivated';
  if (oldStatus === 'active' && newStatus === 'canceled') return 'Subscription Canceled';
  if (oldStatus === 'trial' && newStatus === 'canceled') return 'Trial Ended';
  if (oldStatus === 'active' && newStatus === 'past_due') return 'Payment Issue Detected';
  if (oldStatus === 'past_due' && newStatus === 'active') return 'Payment Recovered';
  return 'Subscription Updated';
}

function getNotificationMessage(orgName: string, oldStatus: string | null, newStatus: string): string {
  if (oldStatus === 'canceled' && newStatus === 'active') {
    return `${orgName}'s subscription has been reactivated. Full access restored.`;
  }
  if (oldStatus === 'active' && newStatus === 'canceled') {
    return `${orgName}'s subscription has been canceled. Please update billing to restore access.`;
  }
  if (oldStatus === 'trial' && newStatus === 'canceled') {
    return `${orgName}'s trial has ended. Please add a payment method to continue.`;
  }
  if (oldStatus === 'active' && newStatus === 'past_due') {
    return `A payment issue was detected for ${orgName}. Please update your payment method.`;
  }
  if (oldStatus === 'past_due' && newStatus === 'active') {
    return `Payment for ${orgName} has been recovered. Subscription is active again.`;
  }
  return `${orgName}'s subscription status has been updated to ${newStatus}.`;
}

function getEmailSubject(oldStatus: string | null, newStatus: string): string {
  if (oldStatus === 'canceled' && newStatus === 'active') return 'Your Meticle subscription is active again';
  if (oldStatus === 'active' && newStatus === 'canceled') return 'Your Meticle subscription has been canceled';
  if (oldStatus === 'trial' && newStatus === 'canceled') return 'Your Meticle trial has ended';
  return 'Meticle subscription update';
}

function getEmailHtml(name: string, orgName: string, oldStatus: string | null, newStatus: string): string {
  if (oldStatus === 'canceled' && newStatus === 'active') {
    return `
      <p>Hi ${name},</p>
      <p><strong>${orgName}</strong>'s Meticle subscription is now <strong>active</strong>.</p>
      <p>Full access has been restored. You can continue managing your care home as usual.</p>
      <p>If you have any questions, reply to this email.</p>
      <p>The Meticle Team</p>`;
  }
  if (oldStatus === 'active' && newStatus === 'canceled') {
    return `
      <p>Hi ${name},</p>
      <p><strong>${orgName}</strong>'s Meticle subscription has been <strong>canceled</strong>.</p>
      <p>Your data will be retained for 30 days. To restore access, visit the Billing page and renew your subscription.</p>
      <p><a href="${process.env.FRONTEND_URL || 'https://meticlecare.com'}/billing" style="display:inline-block;padding:12px 24px;background:#0F4C81;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Renew Subscription</a></p>
      <p>The Meticle Team</p>`;
  }
  if (oldStatus === 'trial' && newStatus === 'canceled') {
    return `
      <p>Hi ${name},</p>
      <p>Your Meticle trial for <strong>${orgName}</strong> has ended. The paid-subscription grace period does not apply to trial accounts.</p>
      <p>To keep using Meticle, please add a payment method and choose a plan on the Billing page.</p>
      <p><a href="${process.env.FRONTEND_URL || 'https://meticlecare.com'}/billing" style="display:inline-block;padding:12px 24px;background:#0F4C81;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Add Payment Method</a></p>
      <p>The Meticle Team</p>`;
  }
  return `
    <p>Hi ${name},</p>
    <p>Your Meticle subscription for <strong>${orgName}</strong> has been updated.</p>
    <p>Status: <strong>${newStatus}</strong></p>
    <p>If you have questions, reply to this email.</p>
    <p>The Meticle Team</p>`;
}
