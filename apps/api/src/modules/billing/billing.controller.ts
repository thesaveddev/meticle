import { Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { getStripe, getOrCreateCustomer, getOrCreatePrice } from '../../shared/services/stripe.service';
import { selectDunningMilestone, HARD_DECLINES } from './dunning';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { buildEmailHtml } from '../../shared/utils/email.template';
import { logWarn } from '../../shared/utils/logger';
import { buildInvoiceHtml, generatePdf } from './billing.pdf';

export class BillingController {
  static async getSubscription(req: Request, res: Response) {
    const userOrgId = req.user!.organizationId!;
    const orgId = req.params.id || userOrgId;
    if (orgId !== userOrgId) throw new AppError(403, 'Access denied');
    const result = await pool.query(
      `SELECT plan, COALESCE(subscription_status, 'trial') as subscription_status, trial_ends_at, current_period_end, COALESCE(stripe_customer_id, '') as stripe_customer_id FROM organizations WHERE id = $1`,
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
          currentPeriodEnd: org.current_period_end,
          daysRemaining,
          stripeCustomerId: org.stripe_customer_id,
          stripeSubscription: null,
          hasUnpaidInvoice: false,
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

        // Reconcile Stripe status into DB — handles missed webhooks. Stripe's
        // canonical states: active, trialing, past_due, unpaid, canceled, incomplete.
        const stripeMapped =
          sub.status === 'active' ? 'active' :
          sub.status === 'trialing' ? 'trial' :
          sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' :
          sub.status === 'canceled' ? 'canceled' :
          sub.status === 'incomplete' ? 'trial' : null;

        // Persist status, period end and trial end so the DB matches Stripe —
        // otherwise a stale trial_ends_at locks an org out of an active trial.
        const subPeriodEnd = (sub as any).current_period_end;
        const subTrialEnd = (sub as any).trial_end;
        if (stripeMapped || subPeriodEnd || subTrialEnd) {
          await pool.query(
            `UPDATE organizations SET
               subscription_status = COALESCE($1, subscription_status),
               current_period_end = COALESCE($2, current_period_end),
               trial_ends_at = COALESCE($3, trial_ends_at)
             WHERE id = $4`,
            [stripeMapped, subPeriodEnd ? new Date(subPeriodEnd * 1000).toISOString() : null, subTrialEnd ? new Date(subTrialEnd * 1000).toISOString() : null, orgId]
          );
          if (stripeMapped) org.subscription_status = stripeMapped;
          if (subPeriodEnd) org.current_period_end = new Date(subPeriodEnd * 1000).toISOString();
          if (subTrialEnd) org.trial_ends_at = new Date(subTrialEnd * 1000).toISOString();
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

    // Expose whether there's an open (unpaid) invoice so the UI can offer a manual retry
    let hasUnpaidInvoice = false;
    if (stripe && org.stripe_customer_id) {
      try {
        const openInvoices = await stripe.invoices.list({ customer: org.stripe_customer_id, status: 'open', limit: 1 });
        hasUnpaidInvoice = openInvoices.data.length > 0;
      } catch { /* best-effort */ }
    }

    res.json({
      plan: org.plan,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      currentPeriodEnd: org.current_period_end,
      daysRemaining,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscription,
      hasUnpaidInvoice,
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
    if (!stripe && process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe is not configured for production billing');
    if (stripe) {
      try {
        const customerId = await getOrCreateCustomer(orgId, userEmail, 'Meticle organisation');
        if (customerId) {
          const price = await getOrCreatePrice(plan);
          if (price) {
            const existingSubs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
            let sub: Stripe.Subscription | null = null;
            if (existingSubs.data.length > 0) {
              await stripe.subscriptions.update(existingSubs.data[0].id, {
                items: [{ id: existingSubs.data[0].items.data[0].id, price }],
                proration_behavior: 'none',
              });
              sub = await stripe.subscriptions.retrieve(existingSubs.data[0].id);
            } else {
              sub = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price }],
                metadata: { organizationId: orgId, plan },
                trial_period_days: 30,
              });
            }
            // Persist the resulting Stripe state so an expired/inactive org is
            // reactivated the moment a plan is chosen (the trial restarts on the
            // newly created subscription when one didn't exist).
            if (sub) {
              const mapped =
                sub.status === 'active' ? 'active' :
                sub.status === 'trialing' ? 'trial' :
                sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' :
                sub.status === 'canceled' ? 'canceled' : null;
              await pool.query(
                `UPDATE organizations SET
                   subscription_status = COALESCE($1, subscription_status),
                   current_period_end = COALESCE($2, current_period_end),
                   trial_ends_at = COALESCE($3, trial_ends_at)
                 WHERE id = $4`,
                [mapped, (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null, (sub as any).trial_end ? new Date((sub as any).trial_end * 1000).toISOString() : null, orgId]
              );
            }
          }
        }
      } catch (err: any) {
        logWarn('stripe plan update')(err);
        if (process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe could not create or update the subscription');
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
    // Backfill from Stripe so invoices appear (and can be downloaded) even if a
    // webhook was missed or the org subscribed outside the app.
    const org = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
    const stripe = getStripe();
    if (stripe && org.rows[0]?.stripe_customer_id) {
      try {
        const stripeInvoices = await stripe.invoices.list({ customer: org.rows[0].stripe_customer_id, limit: 24 });
        for (const inv of stripeInvoices.data) {
          const amount = (inv.amount_paid || inv.amount_due || 0) / 100;
          const status = inv.status === 'paid' ? 'paid' : inv.status === 'open' ? 'open' : inv.status;
          const description = inv.lines?.data?.[0]?.description || inv.description || 'Meticle subscription';
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgId, inv.id]
          );
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE invoices SET status = $1, amount = $2, description = $3, issued_at = to_timestamp($4) WHERE id = $5`,
              [status, amount, description, inv.created, existing.rows[0].id]
            );
          } else {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, paid_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), CASE WHEN $6 = 'paid' THEN to_timestamp($8) ELSE NULL END)`,
              [orgId, inv.number || `STRIPE-${inv.id.slice(-8)}`, description, amount, inv.currency?.toUpperCase() || 'GBP', status, inv.id, inv.created]
            );
          }
        }
      } catch (err: any) {
        logWarn('stripe invoice backfill')(err);
      }
    }
    const result = await pool.query(
      `SELECT * FROM invoices WHERE organization_id = $1 ORDER BY issued_at DESC NULLS LAST, created_at DESC`,
      [orgId]
    );
    res.json(result.rows);
  }

  static async downloadInvoice(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const inv = await pool.query(
      `SELECT * FROM invoices WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );
    if (inv.rows.length === 0) throw new AppError(404, 'Invoice not found');
    const org = await pool.query(
      `SELECT name, primary_color FROM organizations WHERE id = $1`,
      [orgId]
    );
    const orgName = org.rows[0]?.name || 'Meticle customer';
    const primaryColor = org.rows[0]?.primary_color || '#0F4C81';
    const pdf = await generatePdf(buildInvoiceHtml(inv.rows[0], { name: orgName, primary_color: primaryColor }));
    const filename = `invoice-${(inv.rows[0].invoice_number || id).replace(/[^A-Za-z0-9-_]/g, '')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
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
      if (process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe is not configured for secure card collection');
      res.json({ clientSecret: null, ephemeral: true });
      return;
    }
    try {
      const customerId = await getOrCreateCustomer(orgId, userEmail, 'Meticle organisation');
      if (!customerId) {
        res.json({ clientSecret: null, ephemeral: true });
        return;
      }
      const intent = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ['card'] });
      res.json({ clientSecret: intent.client_secret });
    } catch (err: any) {
      logWarn('stripe setup intent')(err);
      if (process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe could not create a secure setup intent');
      res.json({ clientSecret: null, ephemeral: true });
    }
  }

  static async addPaymentMethod(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { payment_method_id, cardholder_name } = req.body;

    const stripe = getStripe();
    let card_last_four = '';
    let card_brand = '';
    let expiry_month = 0;
    let expiry_year = 0;
    let stripeFingerprint: string | null = null;

    if (!stripe) throw new AppError(503, 'Stripe is not configured for secure card collection');
    if (!payment_method_id) throw new AppError(400, 'A Stripe payment method is required');
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
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ message: 'Stripe webhook processing is not configured' });
        return;
      }
      res.status(200).json({ received: true });
      return;
    }
    const sig = req.headers['stripe-signature'] as string | undefined;
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig) {
      res.status(400).json({ message: 'Missing Stripe signature' });
      return;
    }
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

    // Stripe can deliver the same event multiple times — process each event exactly once
    // so receipts / dunning emails are never duplicated.
    const dupCheck = await pool.query('SELECT 1 FROM stripe_webhook_events WHERE event_id = $1', [event.id]);
    if (dupCheck.rows.length > 0) {
      res.json({ received: true, duplicate: true });
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
        const orgId = invoice.metadata?.organizationId || customer.metadata?.organizationId || invoice.metadata?.orgId || customer.metadata?.orgId;
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
            `UPDATE organizations SET failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL, dunning_email_milestones = '{}', subscription_status = 'active' WHERE id = $1 AND subscription_status = 'past_due'`,
            [orgId]
          );
          // Persist the period end for reminder/win-back jobs
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          if (periodEnd) {
            await pool.query(
              `UPDATE organizations SET current_period_end = to_timestamp($1) WHERE id = $2`,
              [periodEnd, orgId]
            );
          }
          // Send the customer a receipt — only for paid subscription invoices (amount > 0)
          if ((invoice as any).subscription && (invoice.amount_paid || 0) > 0) {
            const admins = await pool.query(
              "SELECT email, COALESCE(first_name, '') as name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'",
              [orgId]
            );
            const amount = (invoice.amount_paid || 0) / 100;
            const currency = (invoice.currency || 'gbp').toUpperCase();
            for (const admin of admins.rows) {
              EmailService.sendPaymentReceiptEmail(admin.email, admin.name || admin.email, invoice.metadata?.orgName || 'your organisation', {
                amount,
                currency,
                invoiceNumber: invoice.number || invoice.id,
                planName: invoice.lines?.data?.[0]?.description || 'Meticle subscription',
                nextBillingDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
                organizationId: orgId,
              }).catch(logWarn('payment receipt email'));
            }
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedCustomer = await stripe.customers.retrieve(failedInvoice.customer as string) as Stripe.Customer;
        const orgIdFailed = failedInvoice.metadata?.organizationId || failedCustomer.metadata?.organizationId || failedInvoice.metadata?.orgId || failedCustomer.metadata?.orgId;
        if (!orgIdFailed) break;
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
          'SELECT failed_payment_count, first_payment_failed_at, dunning_email_milestones FROM organizations WHERE id = $1',
          [orgIdFailed]
        );
        const attemptCount = failedInvoice.attempt_count || 0;
        const firstFailedAt = orgRow.rows[0]?.first_payment_failed_at;
        const daysSinceFirstFailure = firstFailedAt
          ? Math.floor((Date.now() - new Date(firstFailedAt).getTime()) / 86400000)
          : 0;
        const milestones: number[] = orgRow.rows[0]?.dunning_email_milestones || [];

        const amount = (failedInvoice.amount_due || 0) / 100;
        const currency = (failedInvoice.currency || 'gbp').toUpperCase();
        const payErr = (failedInvoice as any).last_payment_error?.payment_method_details?.card;
        const lastFour = payErr?.last4;
        const brand = payErr?.brand;
        const cardInfo = lastFour ? `${brand || 'Card'} ending in ${lastFour}` : 'your card';

        // Decline-code aware dunning (industry standard): hard declines mean the card
        // can never pay — skip the retry-and-wait tone and escalate immediately.
        const declineCode = (failedInvoice as any).last_payment_error?.decline_code;

        // Next retry time from Stripe's Smart Retries (auto-retries run silently first)
        const nextAttempt = failedInvoice.next_payment_attempt
          ? new Date(failedInvoice.next_payment_attempt * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;

        // Escalating dunning email sequence — one email per milestone day (0, 3, 7, 14)
        const dunning = selectDunningMilestone({ daysSinceFirstFailure, declineCode, sentMilestones: milestones });
        if (dunning) {
          await pool.query(
            `UPDATE organizations SET dunning_email_milestones = array_append(COALESCE(dunning_email_milestones, '{}'::int[]), $1) WHERE id = $2`,
            [dunning.milestoneDay, orgIdFailed]
          );
          const admins = await pool.query(
            "SELECT email, COALESCE(first_name, '') as name, COALESCE((SELECT name FROM organizations WHERE id = $1), '') as org_name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'",
            [orgIdFailed]
          );
          for (const admin of admins.rows) {
            EmailService.sendPaymentFailedEmail(admin.email, admin.name || admin.email, admin.org_name, {
              amount,
              currency,
              cardInfo,
              attemptCount,
              nextAttempt,
              daysSinceFirstFailure: dunning.urgency,
              organizationId: orgIdFailed,
            }).catch(logWarn('payment failed email'));
          }
          notifyAdmins(
            orgIdFailed,
            dunning.hardDecline ? 'Payment Failed — Card Declined' : 'Payment Failed',
            `Payment for ${amount} ${currency} failed using ${cardInfo}${dunning.hardDecline ? '. This card cannot be used — please add a new one.' : ". We'll retry automatically. Update your payment method to avoid service interruption."}`
          );
        }

        // After 5 failed attempts or 7 days since first failure, move to the past_due
        // grace state. Access is still kept (grace period) while dunning continues.
        if (attemptCount >= 5 || daysSinceFirstFailure >= 7) {
          await pool.query(
            `UPDATE organizations SET subscription_status = 'past_due' WHERE id = $1`,
            [orgIdFailed]
          );
        }
        break;
      }
      case 'invoice.payment_action_required': {
        const actionInvoice = event.data.object as Stripe.Invoice;
        const actionCustomer = await stripe.customers.retrieve(actionInvoice.customer as string) as Stripe.Customer;
        const orgIdAction = actionInvoice.metadata?.organizationId || actionCustomer.metadata?.organizationId || actionInvoice.metadata?.orgId || actionCustomer.metadata?.orgId;
        if (orgIdAction && (actionInvoice.amount_due || 0) > 0) {
          const amount = (actionInvoice.amount_due || 0) / 100;
          const currency = (actionInvoice.currency || 'gbp').toUpperCase();
          const admins = await pool.query(
            "SELECT email, COALESCE(first_name, '') as name, COALESCE((SELECT name FROM organizations WHERE id = $1), '') as org_name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'",
            [orgIdAction]
          );
          for (const admin of admins.rows) {
            EmailService.sendPaymentActionRequiredEmail(admin.email, admin.name || admin.email, admin.org_name, { amount, currency }).catch(logWarn('payment action required email'));
          }
          notifyAdmins(orgIdAction, 'Payment Action Required', `Your bank needs you to confirm a ${currency} ${amount.toFixed(2)} payment to keep your subscription active.`);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer;
        const orgIdSub = sub.metadata?.organizationId || customer.metadata?.organizationId || sub.metadata?.orgId || customer.metadata?.orgId;
        if (orgIdSub) {
          const status = sub.status === 'active' ? 'active' : sub.status === 'trialing' ? 'trial' : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : sub.status === 'canceled' ? 'canceled' : null;
          await pool.query(
            `UPDATE organizations SET subscription_status = COALESCE($1, subscription_status), current_period_end = COALESCE(to_timestamp($3), current_period_end), trial_ends_at = COALESCE(to_timestamp($4), trial_ends_at) WHERE id = $2`,
            [status, orgIdSub, (sub as any).current_period_end || null, (sub as any).trial_end || null]
          );
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(deletedSub.customer as string) as Stripe.Customer;
        const orgIdDel = deletedSub.metadata?.organizationId || customer.metadata?.organizationId || deletedSub.metadata?.orgId || customer.metadata?.orgId;
        if (orgIdDel) {
          // Keep current_period_end so the win-back email can still fire
          await pool.query(
            `UPDATE organizations SET subscription_status = 'canceled', current_period_end = COALESCE(to_timestamp($2), current_period_end) WHERE id = $1`,
            [orgIdDel, (deletedSub as any).current_period_end || null]
          );
        }
        break;
      }
      case 'invoice.finalized': {
        // Record the invoice immediately so it appears in the billing page
        // before payment. This lets the org see what they owe and plan ahead.
        const finInvoice = event.data.object as Stripe.Invoice;
        const finCustomer = await stripe.customers.retrieve(finInvoice.customer as string) as Stripe.Customer;
        const orgIdFin = finInvoice.metadata?.organizationId || finCustomer.metadata?.organizationId || finInvoice.metadata?.orgId || finCustomer.metadata?.orgId;
        if (orgIdFin && finInvoice.id && (finInvoice.amount_due || 0) > 0) {
          const amount = (finInvoice.amount_due || 0) / 100;
          const currency = (finInvoice.currency || 'gbp').toUpperCase();
          const description = finInvoice.lines?.data?.[0]?.description || finInvoice.description || 'Meticle subscription';
          const dueDate = finInvoice.due_date ? new Date(finInvoice.due_date * 1000).toISOString().split('T')[0] : null;
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgIdFin, finInvoice.id]
          );
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, due_date)
               VALUES ($1, $2, $3, $4, $5, 'open', $6, to_timestamp($7), $8)`,
              [orgIdFin, finInvoice.number || `STRIPE-${finInvoice.id.slice(-8)}`, description, amount, currency, finInvoice.id, finInvoice.created, dueDate]
            );
            // Send the invoice to the org admin so they know it's coming
            const admins = await pool.query(
              "SELECT email, COALESCE(first_name, '') as name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'",
              [orgIdFin]
            );
            const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'soon';
            for (const admin of admins.rows) {
              EmailService.sendQueued(admin.email,
                `Invoice for ${currency} ${amount.toFixed(2)} — due ${dueDateStr}`,
                EmailService.buildInvoiceEmailHtml(admin.name || admin.email, amount, currency, description, dueDateStr),
                'billing'
              ).catch(logWarn('invoice finalized email'));
            }
          } else {
            // Update existing invoice if it was backfilled as paid before finalization
            await pool.query(
              `UPDATE invoices SET status = 'open', amount = $1, due_date = $2 WHERE id = $3 AND status = 'paid'`,
              [amount, dueDate, existing.rows[0].id]
            );
          }
        }
        break;
      }
    }

    // Mark the event as processed — if anything above throws, we 500 and Stripe retries
    await pool.query(
      'INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2)',
      [event.id, event.type]
    );

    res.json({ received: true });
  }

  static async retryPayment(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const stripe = getStripe();
    if (!stripe) throw new AppError(400, 'Stripe not configured');

    const org = await pool.query(
      'SELECT stripe_customer_id, name FROM organizations WHERE id = $1',
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
    const amount = (invoice.amount_due || 0) / 100;
    const currency = (invoice.currency || 'gbp').toUpperCase();

    const admins = await pool.query(
      "SELECT email, COALESCE(first_name, '') as name FROM users WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND status = 'active'",
      [orgId]
    );
    const notifyAdminsOfResult = async (subject: string, html: string) => {
      for (const admin of admins.rows) {
        EmailService.sendQueued(admin.email, subject, html).catch(logWarn('payment retry email'));
      }
    };

    // Prefer the org's default card if the invoice has none attached
    const defaultPm = await pool.query(
      'SELECT stripe_payment_method_id FROM payment_methods WHERE organization_id = $1 AND is_default = TRUE LIMIT 1',
      [orgId]
    );

    let paid: Stripe.Invoice;
    try {
      const payParams: any = {};
      if (defaultPm.rows[0]?.stripe_payment_method_id) {
        payParams.payment_method = defaultPm.rows[0].stripe_payment_method_id;
      }
      paid = await stripe.invoices.pay(invoice.id, payParams);
    } catch (err: any) {
      // Card declined (or similar) — email the failed result immediately
      const declineReason = (err as any)?.payment_intent?.last_payment_error?.message || err.message || 'Payment failed';
      const payErr = (err as any)?.payment_intent?.last_payment_error?.payment_method_details?.card;
      const cardInfo = payErr?.last4 ? `${payErr.brand || 'Card'} ending in ${payErr.last4}` : 'your card on file';
      const html = buildEmailHtml(
        'Payment Update',
        "Your payment didn't go through",
        `<p>We tried to charge <strong>${currency} ${amount.toFixed(2)}</strong> to <strong>${cardInfo}</strong> and the bank declined it.</p>` +
        `<p><strong>Reason:</strong> ${declineReason}</p>` +
        `<p>Your data is safe. You can retry at any time from the Billing page — updating your card first usually fixes this.</p>`,
        { label: 'Retry Payment', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing` }
      );
      await notifyAdminsOfResult(`Payment still failing — ${currency} ${amount.toFixed(2)}`, html);
      throw new AppError(402, declineReason);
    }

    // 3D Secure / bank authentication required — hand the client secret back so the
    // customer can confirm the payment in-browser (Stripe.js confirmCardPayment).
    const paymentIntent = (paid as any).payment_intent
      ? typeof (paid as any).payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve((paid as any).payment_intent)
        : (paid as any).payment_intent
      : null;
    if (paid.status !== 'paid' || (paymentIntent as any)?.status === 'requires_action') {
      const clientSecret = (paymentIntent as any)?.client_secret || null;
      if (clientSecret) {
        const html = buildEmailHtml(
          'Payment Action Required',
          'Your bank needs you to confirm a payment',
          `<p>To keep your Meticle subscription running, your bank needs you to confirm the payment of <strong>${currency} ${amount.toFixed(2)}</strong>.</p>` +
          `<p>Open the Billing page and click <strong>Retry Payment</strong> to complete the confirmation pop-up.</p>`,
          { label: 'Complete Payment', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing` }
        );
        await notifyAdminsOfResult('Action required: confirm your Meticle payment', html);
      }
      res.json({ requiresAction: true, clientSecret, message: 'Your bank requires you to confirm this payment.' });
      return;
    }

    // Payment succeeded — sync DB immediately (don't wait for the webhook)
    await pool.query(
      `UPDATE organizations SET subscription_status = 'active', failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL, dunning_email_milestones = '{}' WHERE id = $1`,
      [orgId]
    );
    const periodEnd = paid.lines?.data?.[0]?.period?.end;
    if (periodEnd) {
      await pool.query(
        `UPDATE organizations SET current_period_end = to_timestamp($1) WHERE id = $2`,
        [periodEnd, orgId]
      );
    }

    // Email the successful result (receipt) to every ORG_ADMIN
    for (const admin of admins.rows) {
      EmailService.sendPaymentReceiptEmail(admin.email, admin.name || admin.email, org.rows[0]?.name, {
        amount: (paid.amount_paid || amount) / 100,
        currency,
        invoiceNumber: paid.number || paid.id,
        planName: paid.lines?.data?.[0]?.description || 'Meticle subscription',
        nextBillingDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        isRetry: true,
      }).catch(logWarn('payment retry receipt email'));
    }

    res.json({ message: 'Payment successful', status: paid.status });
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
}
