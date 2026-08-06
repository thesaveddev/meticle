import { Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { getStripe, getOrCreateCustomer, getOrCreatePrice } from '../../shared/services/stripe.service';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { buildEmailHtml } from '../../shared/utils/email.template';
import { logWarn } from '../../shared/utils/logger';

export class BillingController {
  static async getSubscription(req: Request, res: Response) {
    const userOrgId = req.user!.organizationId!;
    const orgId = req.params.id || userOrgId;
    if (orgId !== userOrgId) throw new AppError(403, 'Access denied');
    const result = await pool.query(
      `SELECT plan, COALESCE(subscription_status, 'trial') as subscription_status, trial_ends_at, COALESCE(stripe_customer_id, '') as stripe_customer_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Organization not found');
    const org = result.rows[0];
    const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
      : 0;

    const stripe = getStripe();
    let stripeSubscription: any = null;
    let stripeUnavailable = false;
    if (stripe && org.stripe_customer_id) {
      let subs: Stripe.ApiList<Stripe.Subscription>;
      try {
        subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 1, status: 'all' });
      } catch (err: any) {
        logWarn('stripe subscription lookup')(err);
        stripeUnavailable = true;
        res.json({
          plan: org.plan,
          subscriptionStatus: org.subscription_status,
          trialEndsAt: org.trial_ends_at,
          daysRemaining,
          stripeCustomerId: org.stripe_customer_id,
          stripeSubscription: null,
          stripeUnavailable,
        });
        return;
      }
      if (subs.data.length > 0) {
        const sub = subs.data[0];
        stripeSubscription = {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };

        // Reconcile Stripe status into DB — handles missed webhooks
        const stripeMapped = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'canceled' ? 'canceled' : sub.status === 'incomplete' ? 'trial' : null;
        if (stripeMapped && stripeMapped !== org.subscription_status) {
          await pool.query(
            `UPDATE organizations SET subscription_status = $1 WHERE id = $2`,
            [stripeMapped, orgId]
          );
          org.subscription_status = stripeMapped;
        }
      } else {
        // No Stripe subscription found but DB thinks it's active — mark expired
        if (org.subscription_status === 'active' || org.subscription_status === 'past_due') {
          await pool.query(
            `UPDATE organizations SET subscription_status = 'canceled' WHERE id = $1`,
            [orgId]
          );
          org.subscription_status = 'canceled';
        }
      }
    }

    res.json({
      plan: org.plan,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      daysRemaining,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscription,
      stripeUnavailable,
    });
  }

  static async updatePlan(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userEmail = ((req.user as any).email as string) || orgId;
    const { plan } = req.body;
    const validPlans = ['starter', 'professional'];
    if (!validPlans.includes(plan)) throw new AppError(400, 'Invalid plan');

    const stripe = getStripe();
    if (stripe) {
      const customerId = await getOrCreateCustomer(orgId, userEmail, orgId);
      if (customerId) {
        const price = await getOrCreatePrice(plan);
        if (price) {
          const existingSubs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
          if (existingSubs.data.length > 0) {
            await stripe.subscriptions.update(existingSubs.data[0].id, {
              items: [{ id: existingSubs.data[0].items.data[0].id, price }],
              proration_behavior: 'none',
            });
          } else {
            await stripe.subscriptions.create({
              customer: customerId,
              items: [{ price }],
              metadata: { organizationId: orgId, plan } as any,
              trial_period_days: 30,
            });
          }
        }
      }
    }

    await pool.query('UPDATE organizations SET plan = $1 WHERE id = $2', [plan, orgId]);

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_PLAN',
      entity_type: 'organization',
      entity_id: orgId,
      new_data: { plan },
      ip_address: req.ip,
    }).catch(logWarn('audit update plan'));

    res.json({ message: 'Plan updated', plan });
  }

  static async getInvoices(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query(
      `SELECT * FROM invoices WHERE organization_id = $1 ORDER BY issued_at DESC NULLS LAST, created_at DESC`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async getPaymentMethods(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query(
      `SELECT * FROM payment_methods WHERE organization_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async createSetupIntent(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userEmail = ((req.user as any).email as string) || orgId;
    const stripe = getStripe();
    if (!stripe) {
      res.json({ clientSecret: null, ephemeral: true });
      return;
    }
    const customerId = await getOrCreateCustomer(orgId, userEmail, orgId);
    if (!customerId) {
      res.json({ clientSecret: null, ephemeral: true });
      return;
    }
    const intent = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ['card'] });
    res.json({ clientSecret: intent.client_secret });
  }

  static async addPaymentMethod(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    let { payment_method_id, card_last_four, card_brand, cardholder_name, expiry_month, expiry_year } = req.body;

    const stripe = getStripe();
    let stripeFingerprint: string | null = null;

    if (stripe && payment_method_id) {
      const org = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
      if (org.rows[0]?.stripe_customer_id) {
        await stripe.paymentMethods.attach(payment_method_id, { customer: org.rows[0].stripe_customer_id });
      }
      try {
        const pm = await stripe.paymentMethods.retrieve(payment_method_id);
        if (pm.card) {
          card_last_four = pm.card.last4 || card_last_four;
          card_brand = pm.card.brand || card_brand;
          expiry_month = pm.card.exp_month || expiry_month;
          expiry_year = pm.card.exp_year || expiry_year;
          stripeFingerprint = pm.card.fingerprint || null;
        }
      } catch { /* use provided values */ }
    }

    // Check for duplicate card by fingerprint or last4+brand+expiry
    if (stripeFingerprint) {
      const dup = await pool.query(
        'SELECT id FROM payment_methods WHERE organization_id = $1 AND stripe_fingerprint = $2',
        [orgId, stripeFingerprint]
      );
      if (dup.rows.length > 0) throw new AppError(409, 'This card has already been added');
    } else if (card_last_four && card_brand) {
      const dup = await pool.query(
        'SELECT id FROM payment_methods WHERE organization_id = $1 AND card_last_four = $2 AND card_brand = $3 AND expiry_month = $4 AND expiry_year = $5',
        [orgId, card_last_four, card_brand, expiry_month || 0, expiry_year || 0]
      );
      if (dup.rows.length > 0) throw new AppError(409, 'This card has already been added');
    }

    const existing = await pool.query(
      'SELECT id FROM payment_methods WHERE organization_id = $1', [orgId]
    );
    const isDefault = existing.rows.length === 0;
    const result = await pool.query(
      `INSERT INTO payment_methods (organization_id, card_last_four, card_brand, cardholder_name, expiry_month, expiry_year, is_default, stripe_payment_method_id, stripe_fingerprint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [orgId, card_last_four || '', card_brand || '', cardholder_name || null, expiry_month || 0, expiry_year || 0, isDefault, payment_method_id || null, stripeFingerprint]
    );
    res.status(201).json(result.rows[0]);
  }

  static async setDefaultPaymentMethod(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const pm = await pool.query('SELECT organization_id FROM payment_methods WHERE id = $1', [id]);
    if (pm.rows.length === 0) throw new AppError(404, 'Payment method not found');
    if (pm.rows[0].organization_id !== orgId) throw new AppError(403, 'Access denied');
    await pool.query('UPDATE payment_methods SET is_default = FALSE WHERE organization_id = $1', [orgId]);
    await pool.query('UPDATE payment_methods SET is_default = TRUE WHERE id = $1', [id]);
    const updated = await pool.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  }

  static async deletePaymentMethod(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;

    const pm = await pool.query('SELECT organization_id, stripe_payment_method_id, is_default FROM payment_methods WHERE id = $1', [id]);
    if (pm.rows.length === 0) throw new AppError(404, 'Payment method not found');
    if (pm.rows[0].organization_id !== orgId) throw new AppError(403, 'Access denied');

    // Block removal of default card — user must set another card as default first
    if (pm.rows[0]?.is_default) {
      throw new AppError(400, 'Set another card as default before removing this one');
    }

    const stripe = getStripe();
    if (stripe && pm.rows[0]?.stripe_payment_method_id) {
      try {
        await stripe.paymentMethods.detach(pm.rows[0].stripe_payment_method_id);
      } catch { /* already detached */ }
    }

    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    // If the deleted card was default and it was the last one, nothing to promote
    res.json({ message: 'Deleted' });
  }

  static async handleWebhook(req: Request, res: Response) {
    const stripe = getStripe();
    if (!stripe) {
      res.status(200).json({ received: true });
      return;
    }
    const sig = req.headers['stripe-signature'] as string;
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!whSecret) {
      res.status(500).json({ message: 'Stripe webhook secret not configured' });
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
    } catch {
      res.status(400).json({ message: 'Invalid signature' });
      return;
    }

    const notifyAdmins = async (orgId: string, title: string, msg: string, sendEmail?: { subject: string; html: string }) => {
      const admins = await pool.query(
        "SELECT id, email, COALESCE(first_name, '') as first_name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN'",
        [orgId]
      );
      for (const admin of admins.rows) {
        NotificationsController.createNotification(admin.id, title, msg, 'billing').catch(logWarn('billing notification'));
        if (sendEmail) {
          EmailService.sendQueued(admin.email, sendEmail.subject, sendEmail.html).catch(logWarn('billing email'));
        }
      }
    };

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const orgId = invoice.metadata?.orgId || customer.metadata?.orgId;
        if (orgId && invoice.id) {
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgId, invoice.id]
          );
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1`,
              [existing.rows[0].id]
            );
          } else {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, paid_at)
               VALUES ($1, $2, $3, $4, $5, 'paid', $6, to_timestamp($7), NOW())`,
              [orgId, `STRIPE-${invoice.number || Date.now()}`, `Stripe invoice ${invoice.id}`, (invoice.amount_paid || 0) / 100, invoice.currency?.toUpperCase() || 'GBP', invoice.id, invoice.created]
            );
          }
          // Payment succeeded after failures — reset tracking and reactivate
          await pool.query(
            `UPDATE organizations SET failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL, subscription_status = 'active' WHERE id = $1 AND subscription_status = 'past_due'`,
            [orgId]
          );
        }
        break;
      }
      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedCustomer = await stripe.customers.retrieve(failedInvoice.customer as string) as Stripe.Customer;
        const orgIdFailed = failedInvoice.metadata?.orgId || failedCustomer.metadata?.orgId;
        if (orgIdFailed) {
          // Track failure
          await pool.query(
            `UPDATE organizations SET
              failed_payment_count = COALESCE(failed_payment_count, 0) + 1,
              last_payment_failed_at = NOW(),
              first_payment_failed_at = COALESCE(first_payment_failed_at, NOW())
            WHERE id = $1`,
            [orgIdFailed]
          );

          const orgRow = await pool.query(
            'SELECT failed_payment_count, first_payment_failed_at FROM organizations WHERE id = $1',
            [orgIdFailed]
          );
          const attemptCount = failedInvoice.attempt_count || 0;
          const firstFailedAt = orgRow.rows[0]?.first_payment_failed_at;
          const daysSinceFirstFailure = firstFailedAt
            ? Math.floor((Date.now() - new Date(firstFailedAt).getTime()) / 86400000)
            : 0;

          const amount = (failedInvoice.amount_due || 0) / 100;
          const currency = (failedInvoice.currency || 'gbp').toUpperCase();
          const payErr = (failedInvoice as any).last_payment_error?.payment_method_details?.card;
          const lastFour = payErr?.last4;
          const brand = payErr?.brand;
          const cardInfo = lastFour ? `${brand || 'Card'} ending in ${lastFour}` : 'your card';

          // Next retry time from Stripe's Smart Retries
          const nextAttempt = failedInvoice.next_payment_attempt
            ? new Date(failedInvoice.next_payment_attempt * 1000)
            : null;
          const disableDate = firstFailedAt
            ? new Date(new Date(firstFailedAt).getTime() + 3 * 86400000)
            : null;

          // In-app notification
          notifyAdmins(
            orgIdFailed,
            'Payment Failed',
            `Payment for ${amount} ${currency} failed using ${cardInfo}. We'll retry automatically. Update your payment method to avoid service interruption.`
          );

          // Email notification with retry schedule + disable warning
          if (daysSinceFirstFailure < 3) {
            const nextRetryStr = nextAttempt
              ? nextAttempt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'soon';
            const disableStr = disableDate
              ? disableDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'within 3 days';

            const emailHtml = buildEmailHtml(
              'Payment Failed - Meticle',
              'Payment Failed',
              `<p>We attempted to charge <strong>${currency} ${amount.toFixed(2)}</strong> to <strong>${cardInfo}</strong> for your Meticle subscription but the payment was declined.</p>
<p><strong>Next retry:</strong> ${nextRetryStr}</p>
<p><strong>Account will be disabled:</strong> ${disableStr}</p>
<p>To avoid service interruption, please update your billing method or contact your bank.</p>`,
              { label: 'Update Billing Method', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing` }
            );
            notifyAdmins(
              orgIdFailed,
              'Payment Failed',
              `Payment for ${amount} ${currency} failed using ${cardInfo}. We'll retry automatically.`,
              { subject: `Payment Failed — ${currency} ${amount.toFixed(2)} — Meticle`, html: emailHtml }
            );
          }

          // After 5 failed attempts or 3 days since first failure, suspend the account
          if (attemptCount >= 5 || daysSinceFirstFailure >= 3) {
            await pool.query(
              `UPDATE organizations SET subscription_status = 'past_due' WHERE id = $1`,
              [orgIdFailed]
            );
            const suspendHtml = buildEmailHtml(
              'Subscription Suspended - Meticle',
              'Subscription Suspended',
              `<p>After repeated failed payment attempts, your Meticle subscription has been <strong>suspended</strong>.</p>
<p>All staff access has been restricted to billing and learning resources only.</p>
<p>Please update your billing information immediately to restore full access.</p>`,
              { label: 'Restore Access', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing` }
            );
            notifyAdmins(
              orgIdFailed,
              'Subscription Suspended',
              'Your subscription has been suspended due to repeated payment failures. Please update your billing information to restore access.',
              { subject: 'Subscription Suspended — Meticle', html: suspendHtml }
            );
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const orgIdSub = sub.metadata?.organizationId;
        if (orgIdSub) {
          const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled';
          await pool.query(
            `UPDATE organizations SET subscription_status = $1 WHERE id = $2`,
            [status, orgIdSub]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        const orgIdDel = deletedSub.metadata?.organizationId;
        if (orgIdDel) {
          await pool.query(
            `UPDATE organizations SET subscription_status = 'canceled' WHERE id = $1`,
            [orgIdDel]
          );
        }
        break;
      }
    }

    res.json({ received: true });
  }

  static async retryPayment(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const stripe = getStripe();
    if (!stripe) throw new AppError(400, 'Stripe not configured');

    const org = await pool.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [orgId]
    );
    const customerId = org.rows[0]?.stripe_customer_id;
    if (!customerId) throw new AppError(400, 'No Stripe customer found');

    // Find the latest open/unpaid invoice
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: 'open',
      limit: 1,
    });

    if (invoices.data.length === 0) throw new AppError(400, 'No unpaid invoices found');

    const invoice = invoices.data[0];
    try {
      const paid = await stripe.invoices.pay(invoice.id);
      // Sync DB immediately — don't wait for webhook
      await pool.query(
        `UPDATE organizations SET subscription_status = 'active', failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL WHERE id = $1`,
        [orgId]
      );
      res.json({ message: 'Payment successful', status: paid.status });
    } catch (err: any) {
      throw new AppError(402, err.message || 'Payment failed');
    }
  }

  static async getAddons(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query('SELECT addons FROM organizations WHERE id = $1', [orgId]);
    res.json({ addons: result.rows[0]?.addons || [] });
  }

  static async updateAddons(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { addons } = req.body;
    if (!Array.isArray(addons)) throw new AppError(400, 'addons must be an array');
    await pool.query('UPDATE organizations SET addons = $1 WHERE id = $2', [JSON.stringify(addons), orgId]);
    res.json({ addons });
  }

  static async seedInvoices(req: Request, res: Response) {
    if (process.env.FEATURE_SEED_INVOICES !== 'true') {
      throw new AppError(404, 'Not found');
    }
    const orgId = req.user!.organizationId!;
    const org = await pool.query('SELECT plan FROM organizations WHERE id = $1', [orgId]);
    if (org.rows.length === 0) throw new AppError(404, 'Organization not found');
    const plan = org.rows[0].plan || 'starter';
    const amounts: Record<string, number> = { starter: 99, professional: 299 };

    const existing = await pool.query(
      'SELECT COUNT(*) FROM invoices WHERE organization_id = $1', [orgId]
    );
    if (parseInt(existing.rows[0].count) > 0) {
      res.json({ message: 'Invoices already exist' });
      return;
    }

    const invoices = [
      { num: 'INV-001', desc: 'Trial period', amount: 0, status: 'paid', issued: '2026-06-15', paid: '2026-06-15' },
      { num: 'INV-002', desc: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan - Monthly`, amount: amounts[plan] || 99, status: 'upcoming', issued: '2026-07-15', paid: null },
      { num: 'INV-003', desc: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan - Monthly`, amount: amounts[plan] || 99, status: 'upcoming', issued: '2026-08-15', paid: null },
    ];

    for (const inv of invoices) {
      await pool.query(
        `INSERT INTO invoices (organization_id, invoice_number, description, amount, status, issued_at, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orgId, inv.num, inv.desc, inv.amount, inv.status, inv.issued, inv.paid ? inv.paid + 'T00:00:00Z' : null]
      );
    }
    res.json({ message: 'Invoices seeded' });
  }
}
