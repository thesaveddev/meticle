import { Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { getStripe, getOrCreateCustomer, getOrCreatePrice, getOrCreateDomiciliaryPrice, isExpectedDomiciliaryContractPrice, PLAN_PRICE_CONFIG, DomiciliaryVatBehavior } from '../../shared/services/stripe.service';
import { selectDunningMilestone, HARD_DECLINES } from './dunning';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationsController } from '../notifications/notifications.controller';
import { EmailService } from '../../shared/utils/email.service';
import { buildEmailHtml } from '../../shared/utils/email.template';
import { logWarn } from '../../shared/utils/logger';
import { buildInvoiceHtml, generatePdf } from './billing.pdf';
import { isDomiciliaryServiceTypes, isInvoiceForSubscription, isStripeSubscriptionForCustomer, stripeSubscriptionIdFromInvoice } from '../../shared/billing/domiciliaryPricing';

export class BillingController {
  static async getSubscription(req: Request, res: Response) {
    const userOrgId = req.user!.organizationId!;
    const orgId = req.params.id || userOrgId;
    if (orgId !== userOrgId) throw new AppError(403, 'Access denied');
    const result = await pool.query(
      `SELECT plan, COALESCE(subscription_status, 'trial') as subscription_status, trial_ends_at, current_period_end, COALESCE(stripe_customer_id, '') as stripe_customer_id, service_types, primary_service_type, domiciliary_monthly_price_pence, domiciliary_active_monthly_price_pence, domiciliary_quote_accepted_at, domiciliary_quote_updated_at, domiciliary_price_vat_behavior, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Organization not found');
    const org = result.rows[0];
    if (org.stripe_customer_id && typeof org.stripe_customer_id !== 'string') {
      throw new AppError(500, 'Invalid Stripe customer configuration');
    }
    const isDomiciliary = isDomiciliaryServiceTypes(org.primary_service_type, org.service_types);
    const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
      : 0;

    const stripe = getStripe();
    let stripeSubscription: any = null;
    let stripeUnavailable = false;
    let domiciliaryBillingAddress: any = null;
    // Guard: skip ALL Stripe reconciliation when stripe_customer_id is missing.
    // Without this guard, clearing the customer ID for local trial testing causes
    // the billing controller to overwrite local trial dates or cancel the org.
    const hasStripeCustomer = !!(stripe && typeof org.stripe_customer_id === 'string' && org.stripe_customer_id.trim() !== '');
    if (hasStripeCustomer && req.user!.role === 'ORG_ADMIN') {
      try {
        const customer = await stripe.customers.retrieve(org.stripe_customer_id);
        if (!('deleted' in customer) || !customer.deleted) {
          domiciliaryBillingAddress = customer.address ? {
            line1: customer.address.line1 || '',
            line2: customer.address.line2 || '',
            city: customer.address.city || '',
            postal_code: customer.address.postal_code || '',
            country: customer.address.country || 'GB',
          } : null;
        }
      } catch (err) { logWarn('stripe billing address lookup')(err); }
    }
    if (hasStripeCustomer) {
      let subscriptionList: Stripe.Subscription[] = [];
      try {
        if (org.domiciliary_stripe_subscription_id) {
          const domiciliarySub = await stripe.subscriptions.retrieve(org.domiciliary_stripe_subscription_id);
          if (!isStripeSubscriptionForCustomer(domiciliarySub.customer as any, org.stripe_customer_id)) {
            throw new Error('Recorded domiciliary subscription belongs to a different Stripe customer');
          }
          subscriptionList = [domiciliarySub];
        } else if (!isDomiciliary) {
          let hasMore = true;
          let startingAfter: string | undefined;
          while (hasMore) {
            const subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 100, status: 'all', ...(startingAfter ? { starting_after: startingAfter } : {}) });
            subscriptionList.push(...subs.data.filter(sub => sub.metadata?.organizationId === orgId));
            hasMore = subs.has_more;
            startingAfter = subs.data.at(-1)?.id;
            if (!subs.data.length || subscriptionList.length) hasMore = false;
          }
          if (!subscriptionList.length && !org.primary_service_type && !org.service_types?.length) {
            const fallback = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 1, status: 'all' });
            subscriptionList = fallback.data;
          }
        }
      } catch (err: any) {
        logWarn('stripe subscription lookup')(err);
        stripeUnavailable = true;
        res.json({
          plan: isDomiciliary ? 'sales_led' : org.plan,
          subscriptionStatus: org.subscription_status,
          trialEndsAt: org.trial_ends_at,
          currentPeriodEnd: org.current_period_end,
          daysRemaining,
          stripeSubscription: null,
          hasUnpaidInvoice: false,
          stripeUnavailable,
          ...(req.user!.role === 'ORG_ADMIN' ? {
            domiciliaryMonthlyPricePence: org.domiciliary_monthly_price_pence ?? null,
            domiciliaryActiveMonthlyPricePence: org.domiciliary_active_monthly_price_pence ?? null,
            domiciliaryQuoteAcceptedAt: org.domiciliary_quote_accepted_at ?? null,
            domiciliaryQuoteUpdatedAt: org.domiciliary_quote_updated_at ?? null,
            domiciliaryPriceVatBehavior: org.domiciliary_price_vat_behavior ?? null,
            domiciliaryStripeSubscriptionId: org.domiciliary_stripe_subscription_id ?? null,
            domiciliaryBillingAddress,
          } : {}),
        });
        return;
      }
      if (subscriptionList.length > 0) {
        const sub = subscriptionList[0];
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
          await pool.query(`UPDATE organizations SET subscription_status = COALESCE($1, subscription_status), plan = COALESCE($6, plan), current_period_end = COALESCE($2::timestamptz, current_period_end), trial_ends_at = $3::timestamptz, grace_period_ends_at = CASE WHEN $1 IN ('active', 'past_due') AND $2 IS NOT NULL THEN $5::timestamptz ELSE NULL END WHERE id = $4`,
            [stripeMapped, subPeriodEnd ? new Date(subPeriodEnd * 1000).toISOString() : null, subTrialEnd ? new Date(subTrialEnd * 1000).toISOString() : null, orgId, subPeriodEnd ? new Date((subPeriodEnd + 7 * 86400) * 1000).toISOString() : null, sub.metadata?.plan || null]
          );
          if (stripeMapped) org.subscription_status = stripeMapped;
          if (!isDomiciliary && sub.metadata?.plan) org.plan = sub.metadata.plan;
          if (isDomiciliary && org.domiciliary_stripe_subscription_id === sub.id) {
            if (sub.status === 'canceled') {
              await pool.query(`UPDATE organizations SET subscription_status = 'canceled', domiciliary_quote_accepted_at = NULL, domiciliary_active_monthly_price_pence = NULL WHERE id = $1 AND domiciliary_stripe_subscription_id = $2`, [orgId, sub.id]);
              org.domiciliary_quote_accepted_at = null;
              org.domiciliary_active_monthly_price_pence = null;
              org.subscription_status = 'canceled';
            } else if (sub.status === 'active') {
              await pool.query(`UPDATE organizations SET subscription_status = 'active' WHERE id = $1`, [orgId]);
              org.subscription_status = 'active';
            } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
              await pool.query(`UPDATE organizations SET subscription_status = 'past_due' WHERE id = $1`, [orgId]);
              org.subscription_status = 'past_due';
            }
          }
          if (subPeriodEnd) org.current_period_end = new Date(subPeriodEnd * 1000).toISOString();
          if (subTrialEnd) org.trial_ends_at = new Date(subTrialEnd * 1000).toISOString();
        }
      } else {
        // No Stripe subscription found but DB thinks it's active — mark expired
        // ONLY if this org actually has a Stripe subscription (not a local trial).
        // Trial orgs without a Stripe customer should never be auto-canceled here.
        if ((org.subscription_status === 'active' || org.subscription_status === 'past_due')
          && org.stripe_customer_id
          && (!isDomiciliary || org.domiciliary_stripe_subscription_id)) {
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
    if (hasStripeCustomer && (!isDomiciliary || org.domiciliary_stripe_subscription_id)) {
      try {
        const openInvoices = await stripe.invoices.list({
          customer: org.stripe_customer_id,
          status: 'open',
          limit: 100,
          ...(isDomiciliary ? { subscription: org.domiciliary_stripe_subscription_id } : {}),
        });
        hasUnpaidInvoice = openInvoices.data.some(invoice => !isDomiciliary
          || isInvoiceForSubscription(invoice as any, org.domiciliary_stripe_subscription_id));
      } catch { /* best-effort */ }
    }

    res.json({
      plan: isDomiciliary ? 'sales_led' : org.plan,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      currentPeriodEnd: org.current_period_end,
      daysRemaining,
      stripeSubscription,
      hasUnpaidInvoice,
      stripeUnavailable,
      ...(req.user!.role === 'ORG_ADMIN' ? {
        domiciliaryMonthlyPricePence: org.domiciliary_monthly_price_pence ?? null,
        domiciliaryActiveMonthlyPricePence: org.domiciliary_active_monthly_price_pence ?? null,
        domiciliaryQuoteAcceptedAt: org.domiciliary_quote_accepted_at ?? null,
        domiciliaryQuoteUpdatedAt: org.domiciliary_quote_updated_at ?? null,
        domiciliaryPriceVatBehavior: org.domiciliary_price_vat_behavior ?? null,
        domiciliaryStripeSubscriptionId: org.domiciliary_stripe_subscription_id ?? null,
        domiciliaryBillingAddress,
      } : {}),
    });
  }

  static async updateDomiciliaryBillingAddress(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const address = req.body.address;
    if (!address || typeof address !== 'object' || address.country !== 'GB'
      || typeof address.line1 !== 'string' || !address.line1.trim()
      || typeof address.city !== 'string' || !address.city.trim()
      || typeof address.postal_code !== 'string' || !address.postal_code.trim()) {
      throw new AppError(400, 'A valid UK billing address is required');
    }
    const org = await pool.query(
      `SELECT stripe_customer_id, primary_service_type, service_types FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!org.rows[0]) throw new AppError(404, 'Organization not found');
    if (!isDomiciliaryServiceTypes(org.rows[0].primary_service_type, org.rows[0].service_types)) {
      throw new AppError(403, 'This action is only available for domiciliary organisations');
    }
    const stripe = getStripe();
    if (!stripe) throw new AppError(503, 'Stripe is not configured for secure domiciliary billing');
    const customerId = org.rows[0].stripe_customer_id || await getOrCreateCustomer(
      orgId, ((req.user as any).email as string) || orgId, 'MeticleCare domiciliary organisation',
    );
    if (!customerId) throw new AppError(503, 'Stripe customer could not be created');
    await stripe.customers.update(customerId, {
      address: {
        line1: address.line1.trim(),
        ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
        city: address.city.trim(),
        postal_code: address.postal_code.trim().toUpperCase(),
        country: 'GB',
      },
    });
    res.json({ message: 'UK billing address saved' });
  }

  static async acceptDomiciliaryQuote(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const org = await pool.query(
      `SELECT domiciliary_monthly_price_pence, domiciliary_stripe_price_id,
              domiciliary_quote_accepted_at, domiciliary_quote_updated_at,
              domiciliary_subscription_generation, primary_service_type, service_types, subscription_status, domiciliary_price_vat_behavior
       FROM organizations WHERE id = $1`,
      [orgId],
    );
    if (!org.rows[0]) throw new AppError(404, 'Organization not found');
    let row = org.rows[0];
    if (!isDomiciliaryServiceTypes(row.primary_service_type, row.service_types)) {
      throw new AppError(403, 'This action is only available for domiciliary organisations');
    }
    if (!Number.isSafeInteger(row.domiciliary_monthly_price_pence) || row.domiciliary_monthly_price_pence <= 0) {
      throw new AppError(409, 'Your organisation does not have an agreed subscription price yet. Please contact sales.');
    }
    if (!['inclusive', 'exclusive'].includes(row.domiciliary_price_vat_behavior)) {
      throw new AppError(409, 'Your quote does not specify VAT treatment. Please contact sales.');
    }
    const stripe = getStripe();
    if (!stripe) throw new AppError(503, 'Stripe is not configured for secure domiciliary billing');
    let advisoryLocked = false;
    try {
      const lockResult = await pool.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [orgId]);
      if (!lockResult.rows[0]?.locked) throw new AppError(409, 'A billing update is already in progress for this organisation. Please try again.');
      advisoryLocked = true;
      // Reload under the same org-scoped advisory lock used by quote updates,
      // so Stripe can never activate an amount that sales changed concurrently.
      const lockedQuote = await pool.query(
        `SELECT domiciliary_monthly_price_pence, domiciliary_stripe_price_id,
                domiciliary_quote_accepted_at, domiciliary_quote_updated_at,
                domiciliary_subscription_generation, primary_service_type, service_types, subscription_status, domiciliary_price_vat_behavior
         FROM organizations WHERE id = $1`,
        [orgId],
      );
      row = lockedQuote.rows[0];
      if (!row || !isDomiciliaryServiceTypes(row.primary_service_type, row.service_types)
        || !Number.isSafeInteger(row.domiciliary_monthly_price_pence) || row.domiciliary_monthly_price_pence <= 0
        || !['inclusive', 'exclusive'].includes(row.domiciliary_price_vat_behavior)) {
        throw new AppError(409, 'Your domiciliary quote changed. Review the latest quote and try again.');
      }
      const userEmail = ((req.user as any).email as string) || orgId;
      const customerId = await getOrCreateCustomer(orgId, userEmail, 'MeticleCare domiciliary organisation');
      if (!customerId) throw new AppError(503, 'Stripe customer could not be created');
      const defaultPaymentMethod = await pool.query(
        'SELECT stripe_payment_method_id FROM payment_methods WHERE organization_id = $1 AND is_default = TRUE LIMIT 1',
        [orgId],
      );
      const paymentMethodId = defaultPaymentMethod.rows[0]?.stripe_payment_method_id;
      if (!paymentMethodId) throw new AppError(409, 'Add a default payment card before activating your domiciliary subscription');
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer && paymentMethod.customer !== customerId) {
        throw new AppError(409, 'The default payment card belongs to another billing account');
      }
      if (!paymentMethod.customer) await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
      const customer = await stripe.customers.retrieve(customerId);
      if ('deleted' in customer && customer.deleted) throw new AppError(409, 'Stripe customer is unavailable');
      if (!customer.address?.line1 || !customer.address?.city || !customer.address?.postal_code || customer.address.country !== 'GB') {
        throw new AppError(409, 'Add your UK billing address in Billing settings before activating the subscription');
      }
      const vatBehavior = row.domiciliary_price_vat_behavior as DomiciliaryVatBehavior;
      const priceId = row.domiciliary_stripe_price_id || await getOrCreateDomiciliaryPrice(row.domiciliary_monthly_price_pence, vatBehavior);
      const price = await stripe.prices.retrieve(priceId);
      if (!isExpectedDomiciliaryContractPrice(row.domiciliary_monthly_price_pence, vatBehavior, price)) {
        throw new AppError(409, 'The saved Stripe price does not match your agreed quote. Contact sales.');
      }
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      const current = subscriptions.data.filter(sub => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(sub.status));
      if (current.length > 1) throw new AppError(409, 'Multiple subscriptions need billing support review');
      if (current.length === 1 && current[0].metadata?.pricingModel !== 'sales_led') {
        throw new AppError(409, 'An existing subscription needs a billing review before the domiciliary agreement can be activated');
      }
      const generation = Number(row.domiciliary_subscription_generation || 0)
        + (!current.length && row.domiciliary_stripe_subscription_id
          && !row.domiciliary_quote_accepted_at ? 1 : 0);
      let subscription: Stripe.Subscription;
      if (current.length === 1) {
        const item = current[0].items.data[0];
        if (!item?.id) throw new AppError(409, 'Existing Stripe subscription has no billable item');
        subscription = await stripe.subscriptions.update(current[0].id, {
          items: [{ id: item.id, price: priceId }],
          proration_behavior: 'none',
          cancel_at_period_end: false,
          default_payment_method: paymentMethodId,
          automatic_tax: { enabled: true },
          metadata: { organizationId: orgId, serviceType: 'domiciliary', pricingModel: 'sales_led', vatBehavior },
        });
      } else {
        subscription =          await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          default_payment_method: paymentMethodId,
          automatic_tax: { enabled: true },
          metadata: { organizationId: orgId, serviceType: 'domiciliary', pricingModel: 'sales_led', vatBehavior },
        }, { idempotencyKey: `domiciliary-contract-${orgId}-${new Date(row.domiciliary_quote_updated_at || 0).getTime()}-${generation}` });
      }
      if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
        throw new AppError(409, `Stripe subscription is ${subscription.status}; complete payment setup before activating the agreement`);
      }
      const persisted = await pool.query(
        `UPDATE organizations SET          domiciliary_quote_accepted_at = COALESCE(domiciliary_quote_accepted_at, NOW()),
          domiciliary_subscription_generation = $10,
          domiciliary_active_monthly_price_pence = $7,
          domiciliary_stripe_price_id = $1, domiciliary_stripe_subscription_id = $2,
          subscription_status = CASE WHEN $3 = 'trialing' THEN 'trial' WHEN $3 = 'past_due' THEN 'past_due' ELSE 'active' END,
          current_period_end = to_timestamp($4), trial_ends_at = to_timestamp($5)
         WHERE id = $6
           AND domiciliary_monthly_price_pence = $7
           AND domiciliary_price_vat_behavior = $8
           AND domiciliary_quote_updated_at IS NOT DISTINCT FROM $9::timestamptz`,
        [priceId, subscription.id, subscription.status, (subscription as any).current_period_end || null, (subscription as any).trial_end || null, orgId, row.domiciliary_monthly_price_pence, vatBehavior, row.domiciliary_quote_updated_at, generation],
      );
      if (persisted.rowCount !== 1) {
        if (current.length === 0) {
          await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false }).catch(logWarn('cancel stale domiciliary subscription'));
        }
        throw new AppError(409, 'The domiciliary quote changed during activation. Review the latest quote and try again.');
      }
      await pool.query(
        `INSERT INTO domiciliary_billing_audit (organization_id, actor_user_id, action, monthly_price_pence, stripe_price_id, details)
         VALUES ($1, $2, 'subscription_activated', $3, $4, $5::jsonb)`,
        [orgId, req.user!.userId, row.domiciliary_monthly_price_pence, priceId, JSON.stringify({ subscription_id: subscription.id, status: subscription.status })],
      );
      res.json({ message: 'Domiciliary subscription activated', status: subscription.status });
    } catch (err: any) {
      logWarn('domiciliary subscription acceptance')(err);
      if (err instanceof AppError) throw err;
      if (process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe could not activate the agreed domiciliary subscription');
      throw new AppError(502, 'Stripe could not activate the agreed domiciliary subscription');
    } finally {
      if (advisoryLocked) {
        await pool.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [orgId]).catch(logWarn('release domiciliary billing lock'));
      }
    }
  }

  static async updatePlan(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const userEmail = ((req.user as any).email as string) || orgId;
    const { plan } = req.body;
    const orgState = await pool.query(
      'SELECT subscription_status, trial_ends_at, service_types, primary_service_type FROM organizations WHERE id = $1',
      [orgId]
    );
    if (orgState.rows.length === 0) throw new AppError(404, 'Organization not found');
    const currentSubscriptionStatus = orgState.rows[0].subscription_status || 'trial';
    const currentTrialEndsAt = orgState.rows[0].trial_ends_at ? new Date(orgState.rows[0].trial_ends_at) : null;
    const isDomiciliary = isDomiciliaryServiceTypes(orgState.rows[0].primary_service_type, orgState.rows[0].service_types);
    const planType = typeof plan === 'string' ? plan : '';
    if (isDomiciliary) throw new AppError(409, 'Domiciliary subscriptions are sales-led. Contact the MeticleCare team to agree your plan and price.');
    const validPlans = ['starter', 'professional'];
    if (!validPlans.includes(planType)) throw new AppError(400, 'Invalid plan');

    const stripe = getStripe();
    if (!stripe && process.env.NODE_ENV === 'production') throw new AppError(503, 'Stripe is not configured for production billing');
    if (stripe && !process.env.STRIPE_PRICE_STARTER && !process.env.STRIPE_PRICE_PROFESSIONAL && process.env.NODE_ENV === 'production') {
      throw new AppError(503, 'Stripe price IDs are not configured for production billing');
    }
    if (stripe) {
      try {
        const customerId = await getOrCreateCustomer(orgId, userEmail, 'Meticle Care organisation');
        if (customerId) {
          const price = await getOrCreatePrice(plan);
          if (price) {
            // Defensive: verify the exact recurring GBP price before a charge.
            const verifyPrice = await stripe.prices.retrieve(price);
            const expectedPrice = PLAN_PRICE_CONFIG[plan as keyof typeof PLAN_PRICE_CONFIG];
            if (!verifyPrice.active || verifyPrice.currency !== expectedPrice.currency
              || verifyPrice.unit_amount !== expectedPrice.amount
              || verifyPrice.recurring?.interval !== expectedPrice.interval
              || (verifyPrice.recurring?.interval_count ?? 1) !== 1) {
              throw new AppError(500, `Stripe price ${price} does not match the configured ${plan} subscription price. Contact support to correct Stripe configuration.`);
            }
            const defaultPaymentMethod = await pool.query(
              'SELECT stripe_payment_method_id FROM payment_methods WHERE organization_id = $1 AND is_default = TRUE LIMIT 1',
              [orgId]
            );
            const paymentMethodId = defaultPaymentMethod.rows[0]?.stripe_payment_method_id || null;
            if (paymentMethodId) {
              const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
              // Do not detach a payment method from another Stripe customer during
              // a plan change. Require the organisation to add its own card instead.
              if (paymentMethod.customer && paymentMethod.customer !== customerId) {
                throw new AppError(409, 'The default payment method belongs to another billing account');
              }
              if (!paymentMethod.customer) {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
              }
              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
            }

            const existingSubs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
            let sub: Stripe.Subscription | null = null;
            const activeSubscriptions = existingSubs.data.filter((candidate) => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(candidate.status));
            if (activeSubscriptions.length > 1) {
              throw new AppError(409, 'Multiple Stripe subscriptions require support review');
            }
            if (activeSubscriptions.length === 1) {
              const existingSubscription = activeSubscriptions[0];
              const subscriptionItem = existingSubscription.items.data[0];
              if (!subscriptionItem?.id) throw new AppError(409, 'Stripe subscription has no billable item to update');
              console.log(`[billing] Updating existing sub ${existingSubscription.id}: item=${subscriptionItem.id}, new_price=${price}, proration=none`);
              await stripe.subscriptions.update(existingSubscription.id, {
                items: [{ id: subscriptionItem.id, price }],
                proration_behavior: 'none',
                cancel_at_period_end: false,
                metadata: { organizationId: orgId, plan },
                ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
              });
              sub = await stripe.subscriptions.retrieve(existingSubscription.id);
              console.log(`[billing] Updated sub result: status=${sub.status}, items=${sub.items.data.map(i => `${i.price?.unit_amount}x${i.quantity}`).join(',')}`);
            } else {
              const trialStillActive = currentSubscriptionStatus === 'trial'
                && (!currentTrialEndsAt || currentTrialEndsAt.getTime() > Date.now());
              if (!trialStillActive && !paymentMethodId) {
                throw new AppError(409, 'Add a default payment card before renewing your subscription');
              }
              const createParams: Stripe.SubscriptionCreateParams = {
                customer: customerId,
                items: [{ price }],
                metadata: { organizationId: orgId, plan },
                ...(paymentMethodId ? { default_payment_method: paymentMethodId } : {}),
                ...(trialStillActive ? { trial_period_days: 30 } : {}),
              };
              console.log(`[billing] Creating new sub: customer=${customerId}, price=${price}, trial=${trialStillActive}, payment_method=${paymentMethodId || 'none'}`);
              sub = await stripe.subscriptions.create(createParams);
              console.log(`[billing] Created sub result: status=${sub.status}, id=${sub.id}, items=${sub.items.data.map(i => `${i.price?.unit_amount}x${i.quantity}`).join(',')}`);
            }
            // Persist the resulting Stripe state so an expired/inactive org is
            // reactivated only after Stripe has created or updated the subscription.
            if (sub) {
              const mapped =
                sub.status === 'active' ? 'active' :
                sub.status === 'trialing' ? 'trial' :
                sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' :
                sub.status === 'canceled' ? 'canceled' : null;
              await pool.query(
                `            UPDATE organizations SET
                   subscription_status = COALESCE($1, subscription_status),
                   current_period_end = COALESCE($2::timestamptz, current_period_end),
                   trial_ends_at = $3::timestamptz,
                   grace_period_ends_at = CASE WHEN $1 IN ('active', 'past_due') AND $2 IS NOT NULL THEN $5::timestamptz ELSE NULL END
                 WHERE id = $4`,
                [mapped, (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null, (sub as any).trial_end ? new Date((sub as any).trial_end * 1000).toISOString() : null, orgId, (sub as any).current_period_end ? new Date(((sub as any).current_period_end + 7 * 86400) * 1000).toISOString() : null]
              );
            }
          }
        }
      } catch (err: any) {
        logWarn('stripe plan update')(err);
        if (err instanceof AppError) throw err;
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
    const org = await pool.query(
      'SELECT stripe_customer_id, primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1',
      [orgId],
    );
    const isDomiciliary = isDomiciliaryServiceTypes(org.rows[0]?.primary_service_type, org.rows[0]?.service_types);
    const domiciliarySubscriptionId = org.rows[0]?.domiciliary_stripe_subscription_id as string | null;
    const stripe = getStripe();
    if (stripe && org.rows[0]?.stripe_customer_id && (!isDomiciliary || domiciliarySubscriptionId)) {
      try {
        const stripeInvoices = await stripe.invoices.list({
          customer: org.rows[0].stripe_customer_id,
          limit: 100,
          ...(isDomiciliary ? { subscription: domiciliarySubscriptionId! } : {}),
        });
        for (const inv of stripeInvoices.data) {
          if (isDomiciliary && !isInvoiceForSubscription(inv as any, domiciliarySubscriptionId)) continue;
          const amount = (inv.amount_paid || inv.amount_due || 0) / 100;
          const status = inv.status === 'paid' ? 'paid' : inv.status === 'open'
            ? (inv.attempted && inv.next_payment_attempt == null ? 'past_due' : 'open')
            : inv.status || 'open';
          const description = inv.lines?.data?.[0]?.description || inv.description || 'Meticle Care subscription';
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgId, inv.id]
          );
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE invoices SET status = $1, amount = $2, description = $3, issued_at = to_timestamp($4), paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, to_timestamp($6)) ELSE NULL END WHERE id = $5`,
              [status, amount, description, inv.created, existing.rows[0].id, inv.status_transitions?.paid_at || inv.created]
            );
          } else {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, paid_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), CASE WHEN $6 = 'paid' THEN to_timestamp($9) ELSE NULL END)`,
              [orgId, inv.number || `STRIPE-${inv.id.slice(-8)}`, description, amount, inv.currency?.toUpperCase() || 'GBP', status, inv.id, inv.created, inv.status_transitions?.paid_at || inv.created]
            );
          }
        }
      } catch (err: any) {
        logWarn('stripe invoice backfill')(err);
      }
    }
    // Invoice history is organisation-owned, so preserve historical invoices
    // from previous agreements. Only the live backfill is narrowed to the
    // recorded domiciliary subscription; retries are scoped separately.
    const result = await pool.query(
      `SELECT * FROM invoices WHERE organization_id = $1 ORDER BY issued_at DESC NULLS LAST, created_at DESC`,
      [orgId],
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
    const orgName = org.rows[0]?.name || 'Meticle Care customer';
    const primaryColor = org.rows[0]?.primary_color || '#0F4C81';
    const invoiceStatus = inv.rows[0].status || 'open';
    const pdf = await generatePdf(buildInvoiceHtml({ ...inv.rows[0], status: invoiceStatus }, { name: orgName, primary_color: primaryColor }));
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
      const customerId = await getOrCreateCustomer(orgId, userEmail, 'Meticle Care organisation');
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
      if (!org.rows[0]?.stripe_customer_id) throw new AppError(409, 'Your Stripe customer is not configured');
      const stripeCustomerId = org.rows[0].stripe_customer_id;
      const pmBefore = await stripe.paymentMethods.retrieve(payment_method_id);
      // A payment method already attached to another customer belongs to that
      // billing account. Never detach it behind their back; Stripe cards can be
      // shared by staff, but ownership must be established with a fresh SetupIntent.
      if (pmBefore.customer && pmBefore.customer !== stripeCustomerId) {
        throw new AppError(409, 'This payment method is already linked to another billing account');
      }
      if (!pmBefore.customer) {
        await stripe.paymentMethods.attach(payment_method_id, { customer: stripeCustomerId });
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
    let result;
    try {
      result = await pool.query(
        `INSERT INTO payment_methods (organization_id, card_last_four, card_brand, cardholder_name, expiry_month, expiry_year, is_default, stripe_payment_method_id, stripe_fingerprint)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [orgId, card_last_four || '', card_brand || '', cardholder_name || null, expiry_month || 0, expiry_year || 0, isDefault, payment_method_id || null, stripeFingerprint]
      );
    } catch (err) {
      if (stripe && payment_method_id) {
        try { await stripe.paymentMethods.detach(payment_method_id); } catch (detachError) { logWarn('payment method compensation failed')(detachError); }
      }
      throw err;
    }
    if (isDefault && stripe && payment_method_id) {
      const org = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
      const stripeCustomerId = org.rows[0]?.stripe_customer_id;
      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: { default_payment_method: payment_method_id },
        });
      }
    }

    res.status(201).json(result.rows[0]);
  }

  static async setDefaultPaymentMethod(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { id } = req.params;
    const pm = await pool.query('SELECT organization_id, stripe_payment_method_id FROM payment_methods WHERE id = $1', [id]);
    if (pm.rows.length === 0) throw new AppError(404, 'Payment method not found');
    if (pm.rows[0].organization_id !== orgId) throw new AppError(403, 'Access denied');
    const stripe = getStripe();
    const stripePaymentMethodId = pm.rows[0]?.stripe_payment_method_id;
    if (stripe && stripePaymentMethodId) {
      const org = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
      const stripeCustomerId = org.rows[0]?.stripe_customer_id;
      if (stripeCustomerId) {
        const pmInfo = await stripe.paymentMethods.retrieve(stripePaymentMethodId).catch(() => null);
        if (pmInfo?.customer && pmInfo.customer !== stripeCustomerId) {
          throw new AppError(409, 'This payment method is linked to another billing account');
        }
        if (!pmInfo?.customer) {
          await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: stripeCustomerId });
        }
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: { default_payment_method: stripePaymentMethodId },
        });
      }
    }

    // Only mutate local default flags after the Stripe ownership/default check succeeds.
    // This prevents a failed Stripe operation from leaving the database out of sync.
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
    // Claim atomically. A processed event is immutable; a failed or stale
    // processing event can be reclaimed so Stripe retries are not lost.
    const claimed = await pool.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, status, attempt_count, updated_at)
       VALUES ($1, $2, 'processing', 1, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO UPDATE SET
         status = 'processing', attempt_count = stripe_webhook_events.attempt_count + 1,
         last_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE stripe_webhook_events.status = 'failed'
          OR (stripe_webhook_events.status = 'processing' AND stripe_webhook_events.updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
       RETURNING event_id`,
      [event.id, event.type]
    );
    if (claimed.rows.length === 0) {
      res.json({ received: true, duplicate: true });
      return;
    }

    const notifyAdmins = async (orgId: string, title: string, msg: string, sendEmail?: { subject: string; html: string }) => {
      const admins = await pool.query(
        "SELECT u.id, u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN'",
        [orgId]
      );
      for (const admin of admins.rows) {
        NotificationsController.createNotification(admin.id, title, msg, 'billing').catch(logWarn('billing notification'));
        if (sendEmail) {
          EmailService.sendQueued(admin.email, sendEmail.subject, sendEmail.html, 'billing').catch(logWarn('billing email'));
        }
      }
    };

    try {
      switch (event.type) {
        case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const orgId = invoice.metadata?.organizationId || customer.metadata?.organizationId || invoice.metadata?.orgId || customer.metadata?.orgId;
        const invoiceSubscriptionId = stripeSubscriptionIdFromInvoice(invoice as any);
        const invoiceOrganization = orgId ? await pool.query(
          `SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1`,
          [orgId],
        ) : { rows: [] as any[] };
        if (!invoiceOrganization.rows[0]) break;
        const isDomiciliaryInvoice = isDomiciliaryServiceTypes(invoiceOrganization.rows[0].primary_service_type, invoiceOrganization.rows[0].service_types);
        if (isDomiciliaryInvoice && (!invoiceSubscriptionId || invoiceOrganization.rows[0].domiciliary_stripe_subscription_id !== invoiceSubscriptionId)) break;
        if (orgId && invoice.id) {
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgId, invoice.id]
          );
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE invoices SET status = 'paid', paid_at = COALESCE(to_timestamp($2), NOW()) WHERE id = $1`,
              [existing.rows[0].id, invoice.status_transitions?.paid_at || null]
            );
          } else {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, paid_at)
               VALUES ($1, $2, $3, $4, $5, 'paid', $6, to_timestamp($7), to_timestamp($8))`,
              [orgId, `STRIPE-${invoice.number || Date.now()}`, `Stripe invoice ${invoice.id}`, (invoice.amount_paid || 0) / 100, invoice.currency?.toUpperCase() || 'GBP', invoice.id, invoice.created, invoice.status_transitions?.paid_at || invoice.created]
            );
          }
          // Payment succeeded after failures — only the current domiciliary
          // subscription may clear dunning and reactivate its organisation.
          await pool.query(
            `UPDATE organizations SET failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL, dunning_email_milestones = '{}', subscription_status = 'active'
             WHERE id = $1 AND subscription_status = 'past_due'
               AND ($2 = FALSE OR domiciliary_stripe_subscription_id = $3)`,
            [orgId, isDomiciliaryInvoice, invoiceSubscriptionId]
          );
          // Persist the period end for reminder/win-back jobs
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          if (periodEnd) {
            await pool.query(
              `UPDATE organizations SET current_period_end = to_timestamp($1), grace_period_ends_at = to_timestamp($1 + (COALESCE(grace_period_days, 7) * 86400))
               WHERE id = $2 AND ($3 = FALSE OR domiciliary_stripe_subscription_id = $4)`,
              [periodEnd, orgId, isDomiciliaryInvoice, invoiceSubscriptionId]
            );
          }
          // Send the customer a receipt — only for paid subscription invoices (amount > 0)
          if (invoiceSubscriptionId && (invoice.amount_paid || 0) > 0) {
            const admins = await pool.query(
              "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
              [orgId]
            );
            const amount = (invoice.amount_paid || 0) / 100;
            const currency = (invoice.currency || 'gbp').toUpperCase();
            for (const admin of admins.rows) {
              EmailService.sendPaymentReceiptEmail(admin.email, admin.name || admin.email, invoice.metadata?.orgName || 'your organisation', {
                amount,
                currency,
                invoiceNumber: invoice.number || invoice.id,
                planName: invoice.lines?.data?.[0]?.description || 'Meticle Care subscription',
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
        const failedSubscriptionId = stripeSubscriptionIdFromInvoice(failedInvoice as any);
        const failedOrg = await pool.query('SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1', [orgIdFailed]);
        if (!failedOrg.rows[0]) break;
        const isDomiciliaryFailure = isDomiciliaryServiceTypes(failedOrg.rows[0].primary_service_type, failedOrg.rows[0].service_types);
        if (isDomiciliaryFailure && (!failedSubscriptionId || failedOrg.rows[0].domiciliary_stripe_subscription_id !== failedSubscriptionId)) break;
        // Track failure only for the current subscription on sales-led accounts.
        await pool.query(
          `UPDATE organizations SET
            failed_payment_count = COALESCE(failed_payment_count, 0) + 1,
            last_payment_failed_at = NOW(),
            first_payment_failed_at = COALESCE(first_payment_failed_at, NOW())
          WHERE id = $1 AND ($2 = FALSE OR domiciliary_stripe_subscription_id = $3)`,
          [orgIdFailed, isDomiciliaryFailure, failedSubscriptionId]
        );

        const orgRow = await pool.query(
          'SELECT failed_payment_count, first_payment_failed_at, dunning_email_milestones FROM organizations WHERE id = $1',
          [orgIdFailed]
        );
        const attemptCount = failedInvoice.attempt_count || 0;
        if (isDomiciliaryFailure && !orgRow.rows[0]) break;
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
            `UPDATE organizations SET dunning_email_milestones = array_append(COALESCE(dunning_email_milestones, '{}'::int[]), $1)
             WHERE id = $2 AND ($3 = FALSE OR domiciliary_stripe_subscription_id = $4)`,
            [dunning.milestoneDay, orgIdFailed, isDomiciliaryFailure, failedSubscriptionId]
          );
          const admins = await pool.query(
            "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name, COALESCE((SELECT name FROM organizations WHERE id = $1), '') as org_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
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
            `UPDATE organizations SET subscription_status = 'past_due' WHERE id = $1
             AND ($2 = FALSE OR domiciliary_stripe_subscription_id = $3)`,
            [orgIdFailed, isDomiciliaryFailure, failedSubscriptionId]
          );
        }
        break;
      }
      case 'invoice.payment_action_required': {
        const actionInvoice = event.data.object as Stripe.Invoice;
        const actionCustomer = await stripe.customers.retrieve(actionInvoice.customer as string) as Stripe.Customer;
        const orgIdAction = actionInvoice.metadata?.organizationId || actionCustomer.metadata?.organizationId || actionInvoice.metadata?.orgId || actionCustomer.metadata?.orgId;
        if (orgIdAction && (actionInvoice.amount_due || 0) > 0) {
          const actionSubscriptionId = stripeSubscriptionIdFromInvoice(actionInvoice as any);
          const actionOrg = await pool.query('SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1', [orgIdAction]);
          if (actionOrg.rows[0] && isDomiciliaryServiceTypes(actionOrg.rows[0].primary_service_type, actionOrg.rows[0].service_types)
            && (!actionSubscriptionId || actionOrg.rows[0].domiciliary_stripe_subscription_id !== actionSubscriptionId)) break;
          const amount = (actionInvoice.amount_due || 0) / 100;
          const currency = (actionInvoice.currency || 'gbp').toUpperCase();
          const admins = await pool.query(
            "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name, COALESCE((SELECT name FROM organizations WHERE id = $1), '') as org_name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
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
          const orgService = await pool.query('SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1', [orgIdSub]);
          const domiciliary = sub.metadata?.pricingModel === 'sales_led' || sub.metadata?.serviceType === 'domiciliary'
            || (!!orgService.rows[0] && isDomiciliaryServiceTypes(orgService.rows[0].primary_service_type, orgService.rows[0].service_types));
          if (domiciliary && orgService.rows[0]?.domiciliary_stripe_subscription_id !== sub.id) break;
          await pool.query(
            `UPDATE organizations SET subscription_status = COALESCE($1, subscription_status),
              domiciliary_quote_accepted_at = CASE WHEN $2 AND $1 = 'canceled' AND domiciliary_stripe_subscription_id = $7 THEN NULL ELSE domiciliary_quote_accepted_at END,
              domiciliary_active_monthly_price_pence = CASE WHEN $2 AND $1 = 'canceled' AND domiciliary_stripe_subscription_id = $7 THEN NULL ELSE domiciliary_active_monthly_price_pence END,
              plan = CASE WHEN $2 THEN plan ELSE COALESCE($3, plan) END,
              current_period_end = COALESCE(to_timestamp($5), current_period_end),
              trial_ends_at = COALESCE(to_timestamp($6), trial_ends_at),
              grace_period_ends_at = CASE WHEN $1 IN ('active', 'past_due') AND $5 IS NOT NULL THEN to_timestamp($5 + (COALESCE(grace_period_days, 7) * 86400)) ELSE NULL END
             WHERE id = $4
               AND (NOT (
                 primary_service_type IN ('domiciliary', 'live_in')
                 OR 'domiciliary' = ANY(COALESCE(service_types, '{}'))
                 OR 'live_in' = ANY(COALESCE(service_types, '{}'))
                 OR $2 = TRUE
               ) OR domiciliary_stripe_subscription_id = $7)`,
            [status, domiciliary, sub.metadata?.plan || null, orgIdSub, (sub as any).current_period_end || null, (sub as any).trial_end || null, sub.id]
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
          const orgService = await pool.query('SELECT primary_service_type, service_types FROM organizations WHERE id = $1', [orgIdDel]);
          const domiciliary = deletedSub.metadata?.pricingModel === 'sales_led' || deletedSub.metadata?.serviceType === 'domiciliary'
            || (!!orgService.rows[0] && isDomiciliaryServiceTypes(orgService.rows[0].primary_service_type, orgService.rows[0].service_types));
          await pool.query(
            `UPDATE organizations SET subscription_status = 'canceled', current_period_end = COALESCE(to_timestamp($2), current_period_end), grace_period_ends_at = NULL,
               domiciliary_quote_accepted_at = CASE WHEN $3 AND domiciliary_stripe_subscription_id = $4 THEN NULL ELSE domiciliary_quote_accepted_at END,
               domiciliary_active_monthly_price_pence = CASE WHEN $3 AND domiciliary_stripe_subscription_id = $4 THEN NULL ELSE domiciliary_active_monthly_price_pence END
             WHERE id = $1
               AND (NOT (
                 primary_service_type IN ('domiciliary', 'live_in')
                 OR 'domiciliary' = ANY(COALESCE(service_types, '{}'))
                 OR 'live_in' = ANY(COALESCE(service_types, '{}'))
                 OR $3 = TRUE
               ) OR domiciliary_stripe_subscription_id = $4)`,
            [orgIdDel, (deletedSub as any).current_period_end || null, domiciliary, deletedSub.id]
          );
        }
        break;
      }
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
      case 'invoice.deleted': {
        const lifecycleInvoice = event.data.object as Stripe.Invoice;
        const lifecycleCustomer = await stripe.customers.retrieve(lifecycleInvoice.customer as string) as Stripe.Customer;
        const lifecycleOrgId = lifecycleInvoice.metadata?.organizationId || lifecycleCustomer.metadata?.organizationId || lifecycleInvoice.metadata?.orgId || lifecycleCustomer.metadata?.orgId;
        const lifecycleSubscriptionId = stripeSubscriptionIdFromInvoice(lifecycleInvoice as any);
        const lifecycleOrg = lifecycleOrgId ? await pool.query('SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1', [lifecycleOrgId]) : { rows: [] as any[] };
        if (!lifecycleOrg.rows[0]) break;
        if (isDomiciliaryServiceTypes(lifecycleOrg.rows[0].primary_service_type, lifecycleOrg.rows[0].service_types)
          && (!lifecycleSubscriptionId || lifecycleOrg.rows[0].domiciliary_stripe_subscription_id !== lifecycleSubscriptionId)) break;
        if (lifecycleOrgId && lifecycleInvoice.id) {
          const lifecycleStatus = event.type === 'invoice.voided' ? 'void' : event.type === 'invoice.marked_uncollectible' ? 'uncollectible' : 'deleted';
          await pool.query(
            `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
             ON CONFLICT (organization_id, stripe_invoice_id) DO UPDATE SET status = EXCLUDED.status, description = EXCLUDED.description, amount = EXCLUDED.amount, currency = EXCLUDED.currency`,
            [lifecycleOrgId, lifecycleInvoice.number || `STRIPE-${lifecycleInvoice.id.slice(-8)}`, lifecycleInvoice.description || `Stripe invoice ${lifecycleInvoice.id}`, (lifecycleInvoice.amount_due || lifecycleInvoice.amount_paid || 0) / 100, (lifecycleInvoice.currency || 'gbp').toUpperCase(), lifecycleStatus, lifecycleInvoice.id, lifecycleInvoice.created]
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
        const finalizedSubscriptionId = stripeSubscriptionIdFromInvoice(finInvoice as any);
        const finalizedOrg = orgIdFin ? await pool.query('SELECT primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1', [orgIdFin]) : { rows: [] as any[] };
        if (!finalizedOrg.rows[0]) break;
        if (isDomiciliaryServiceTypes(finalizedOrg.rows[0].primary_service_type, finalizedOrg.rows[0].service_types)
          && (!finalizedSubscriptionId || finalizedOrg.rows[0].domiciliary_stripe_subscription_id !== finalizedSubscriptionId)) break;
        if (orgIdFin && finInvoice.id && (finInvoice.amount_due || 0) > 0) {
          const amount = (finInvoice.amount_due || 0) / 100;
          const currency = (finInvoice.currency || 'gbp').toUpperCase();
          const description = finInvoice.lines?.data?.[0]?.description || finInvoice.description || 'Meticle Care subscription';
          const dueDate = finInvoice.due_date ? new Date(finInvoice.due_date * 1000).toISOString().split('T')[0] : null;
          const existing = await pool.query(
            'SELECT id, status FROM invoices WHERE organization_id = $1 AND stripe_invoice_id = $2',
            [orgIdFin, finInvoice.id]
          );
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO invoices (organization_id, invoice_number, description, amount, currency, status, stripe_invoice_id, issued_at, due_date)
               VALUES ($1, $2, $3, $4, $5, 'open', $6, to_timestamp($7), $8)`,
              [orgIdFin, finInvoice.number || `STRIPE-${finInvoice.id.slice(-8)}`, description, amount, currency, finInvoice.id, finInvoice.created, dueDate]
            );
            // Send the invoice to the org admin so they know it's coming
            const admins = await pool.query(              "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
              [orgIdFin]);
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
              `UPDATE invoices SET status = CASE WHEN status IN ('void', 'uncollectible', 'deleted') THEN status ELSE 'open' END, amount = $1, due_date = $2 WHERE id = $3`,
              [amount, dueDate, existing.rows[0].id]
            );
          }
        }
        break;
      }
    }

    await pool.query(
      `UPDATE stripe_webhook_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = NULL WHERE event_id = $1`,
      [event.id]
    );
    res.json({ received: true });
    } catch (err: any) {
      await pool.query(
        `UPDATE stripe_webhook_events SET status = 'failed', last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE event_id = $1 AND status = 'processing'`,
        [event.id, String(err?.message || err).slice(0, 2000)]
      ).catch(logWarn('mark webhook failed'));
      throw err;
    }
  }

  static async retryPayment(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const stripe = getStripe();
    if (!stripe) throw new AppError(400, 'Stripe not configured');

    const org = await pool.query(
      'SELECT stripe_customer_id, name, primary_service_type, service_types, domiciliary_stripe_subscription_id FROM organizations WHERE id = $1',
      [orgId]
    );
    const customerId = org.rows[0]?.stripe_customer_id;
    if (!customerId) throw new AppError(400, 'No Stripe customer found');
    const isDomiciliary = isDomiciliaryServiceTypes(org.rows[0]?.primary_service_type, org.rows[0]?.service_types);
    const domiciliarySubscriptionId = org.rows[0]?.domiciliary_stripe_subscription_id as string | null;
    if (isDomiciliary && !domiciliarySubscriptionId) {
      throw new AppError(409, 'There is no active domiciliary subscription to retry payment for');
    }

    // Never retry a legacy invoice or a different subscription under the same
    // Stripe customer. Domiciliary retries must be tied to the recorded contract.
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: 'open',
      limit: 100,
      ...(isDomiciliary ? { subscription: domiciliarySubscriptionId! } : {}),
    });
    const invoice = invoices.data.find(candidate => !isDomiciliary
      || isInvoiceForSubscription(candidate as any, domiciliarySubscriptionId));
    if (!invoice) throw new AppError(400, 'No unpaid invoices found for the current subscription');
    const amount = (invoice.amount_due || 0) / 100;
    const currency = (invoice.currency || 'gbp').toUpperCase();

    const admins = await pool.query(
      "SELECT u.email, COALESCE(NULLIF(sp.first_name || ' ' || sp.last_name, ''), u.email) as name FROM users u LEFT JOIN staff_profiles sp ON u.id = sp.user_id WHERE u.organization_id = $1 AND u.role = 'ORG_ADMIN' AND u.status = 'active'",
      [orgId]
    );
    const notifyAdminsOfResult = async (subject: string, html: string) => {
      for (const admin of admins.rows) {
        EmailService.sendQueued(admin.email, subject, html, 'billing').catch(logWarn('payment retry email'));
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
          `<p>To keep your Meticle Care subscription running, your bank needs you to confirm the payment of <strong>${currency} ${amount.toFixed(2)}</strong>.</p>` +
          `<p>Open the Billing page and click <strong>Retry Payment</strong> to complete the confirmation pop-up.</p>`,
          { label: 'Complete Payment', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing` }
        );
        await notifyAdminsOfResult('Action required: confirm your Meticle Care payment', html);
      }
      res.json({ requiresAction: true, clientSecret, message: 'Your bank requires you to confirm this payment.' });
      return;
    }

    // Payment succeeded — sync DB immediately (don't wait for the webhook)
    await pool.query(
      `UPDATE organizations SET subscription_status = 'active', failed_payment_count = 0, first_payment_failed_at = NULL, last_payment_failed_at = NULL, dunning_email_milestones = '{}'
       WHERE id = $1 AND ($2 = FALSE OR domiciliary_stripe_subscription_id = $3)`,
      [orgId, isDomiciliary, domiciliarySubscriptionId],
    );
    const periodEnd = paid.lines?.data?.[0]?.period?.end;
    if (periodEnd) {
      await pool.query(
        `UPDATE organizations SET current_period_end = to_timestamp($1), grace_period_ends_at = to_timestamp($1 + (COALESCE(grace_period_days, 7) * 86400))
         WHERE id = $2 AND ($3 = FALSE OR domiciliary_stripe_subscription_id = $4)`,
        [periodEnd, orgId, isDomiciliary, domiciliarySubscriptionId],
      );
    }

    // Email the successful result (receipt) to every ORG_ADMIN
    for (const admin of admins.rows) {
      EmailService.sendPaymentReceiptEmail(admin.email, admin.name || admin.email, org.rows[0]?.name, {
        amount: (paid.amount_paid || amount) / 100,
        currency,
        invoiceNumber: paid.number || paid.id,
        planName: paid.lines?.data?.[0]?.description || 'Meticle Care subscription',
        nextBillingDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        isRetry: true,
      }).catch(logWarn('payment retry receipt email'));
    }

    res.json({ message: 'Payment successful', status: paid.status });
  }

  static async getStripePriceConfig(req: Request, res: Response) {
    const stripe = getStripe();
    if (!stripe) throw new AppError(503, 'Stripe is not configured');

    const plans = ['starter', 'professional'] as const;
    const result: Record<string, any> = {};

    for (const plan of plans) {
      const envKey = plan === 'starter' ? 'STRIPE_PRICE_STARTER' : 'STRIPE_PRICE_PROFESSIONAL';
      const envVal = process.env[envKey];
      if (!envVal) {
        result[plan] = { configured: false, envKey, message: `${envKey} is not set` };
        continue;
      }
      try {
        const price = await stripe.prices.retrieve(envVal);
        const expected = plan === 'starter' ? { amount: 9900, currency: 'gbp', interval: 'month' } : { amount: 29900, currency: 'gbp', interval: 'month' };
        result[plan] = {
          configured: true,
          envKey,
          priceId: price.id,
          active: price.active,
          amount: price.unit_amount,
          amountDisplay: `£${((price.unit_amount || 0) / 100).toFixed(2)}`,
          currency: price.currency,
          interval: price.recurring?.interval,
          intervalCount: price.recurring?.interval_count,
          matchesExpected: price.active && price.currency === expected.currency && price.unit_amount === expected.amount && price.recurring?.interval === expected.interval,
          expectedAmount: `£${(expected.amount / 100).toFixed(2)}`,
          expectedCurrency: expected.currency,
          expectedInterval: expected.interval,
        };
      } catch (err: any) {
        result[plan] = { configured: true, envKey, priceId: envVal, error: err.message };
      }
    }

    res.json(result);
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

  static async getPricingConfig(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query(
      'SELECT billing_config FROM organizations WHERE id = $1',
      [orgId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Organization not found');
    // Do not materialize defaults here: a UI save sends the loaded JSON back,
    // and implicit policy defaults would override existing package-level rules.
    res.json(result.rows[0].billing_config || {});
  }

  static async updatePricingConfig(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { billing_config } = req.body;
    if (!billing_config || typeof billing_config !== 'object' || Array.isArray(billing_config)) {
      throw new AppError(400, 'billing_config must be an object');
    }

    // Treat this endpoint as a partial settings update. Replacing the whole JSON
    // document would silently erase mileage, payroll, or escalation settings when
    // the billing form only edits VAT and domiciliary rates.
    const current = await pool.query(
      'SELECT billing_config FROM organizations WHERE id = $1',
      [orgId]
    );
    if (current.rows.length === 0) throw new AppError(404, 'Organization not found');
    const existingConfig = current.rows[0].billing_config || {};
    const mergedConfig = {
      ...existingConfig,
      ...billing_config,
      ...(billing_config.domiciliary || existingConfig.domiciliary
        ? {
            domiciliary: {
              ...(existingConfig.domiciliary || {}),
              ...(billing_config.domiciliary || {}),
            },
          }
        : {}),
    };

    await pool.query(
      'UPDATE organizations SET billing_config = $1 WHERE id = $2',
      [JSON.stringify(mergedConfig), orgId]
    );

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_BILLING_CONFIG',
      entity_type: 'organization',
      entity_id: orgId,
      new_data: { billing_config_keys: Object.keys(billing_config) },
      ip_address: req.ip,
    }).catch(logWarn('audit billing config'));

    res.json({ billing_config: mergedConfig });
  }

  static async getMileageRates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const result = await pool.query(
      'SELECT billing_config FROM organizations WHERE id = $1',
      [orgId]
    );
    if (result.rows.length === 0) throw new AppError(404, 'Organization not found');
    const config = result.rows[0].billing_config || {};
    res.json(config.mileage_rates || []);
  }

  static async updateMileageRates(req: Request, res: Response) {
    const orgId = req.user!.organizationId!;
    const { mileage_rates } = req.body;
    if (!Array.isArray(mileage_rates)) throw new AppError(400, 'mileage_rates must be an array');

    const result = await pool.query(
      'SELECT billing_config FROM organizations WHERE id = $1',
      [orgId]
    );
    const config = result.rows[0]?.billing_config || {};
    config.mileage_rates = mileage_rates;
    await pool.query(
      'UPDATE organizations SET billing_config = $1 WHERE id = $2',
      [JSON.stringify(config), orgId]
    );

    AuditRepository.log({
      user_id: req.user!.userId,
      action: 'UPDATE_MILEAGE_RATES',
      entity_type: 'organization',
      entity_id: orgId,
      new_data: { rate_count: mileage_rates.length },
      ip_address: req.ip,
    }).catch(logWarn('audit mileage rates'));

    res.json({ mileage_rates });
  }
}
