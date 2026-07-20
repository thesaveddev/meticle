import { Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../../shared/database';
import { AppError } from '../../shared/middleware/error.middleware';
import { getStripe, getOrCreateCustomer, getOrCreatePrice } from '../../shared/services/stripe.service';
import { AuditRepository } from '../audit/audit.repository';
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
    if (stripe && org.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 1, status: 'all' });
      if (subs.data.length > 0) {
        const sub = subs.data[0];
        stripeSubscription = {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
      }
    }

    res.json({
      plan: org.plan,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      daysRemaining,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscription,
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
    let { payment_method_id, card_last_four, card_brand, expiry_month, expiry_year } = req.body;

    const stripe = getStripe();
    if (stripe && payment_method_id) {
      const org = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
      if (org.rows[0]?.stripe_customer_id) {
        await stripe.paymentMethods.attach(payment_method_id, { customer: org.rows[0].stripe_customer_id });
      }
      // Retrieve card details from Stripe
      try {
        const pm = await stripe.paymentMethods.retrieve(payment_method_id);
        if (pm.card) {
          card_last_four = pm.card.last4 || card_last_four;
          card_brand = pm.card.brand || card_brand;
          expiry_month = pm.card.exp_month || expiry_month;
          expiry_year = pm.card.exp_year || expiry_year;
        }
      } catch { /* use provided values */ }
    }

    const existing = await pool.query(
      'SELECT id FROM payment_methods WHERE organization_id = $1', [orgId]
    );
    const isDefault = existing.rows.length === 0;
    const result = await pool.query(
      `INSERT INTO payment_methods (organization_id, card_last_four, card_brand, expiry_month, expiry_year, is_default, stripe_payment_method_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, card_last_four || '', card_brand || '', expiry_month || 0, expiry_year || 0, isDefault, payment_method_id || null]
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
    const stripe = getStripe();
    if (stripe && pm.rows[0]?.stripe_payment_method_id) {
      try {
        await stripe.paymentMethods.detach(pm.rows[0].stripe_payment_method_id);
      } catch { /* already detached */ }
    }

    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    // If the deleted card was default, auto-set next card as default
    if (pm.rows[0]?.is_default) {
      const next = await pool.query(
        'SELECT id FROM payment_methods WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1',
        [orgId]
      );
      if (next.rows.length > 0) {
        await pool.query('UPDATE payment_methods SET is_default = TRUE WHERE id = $1', [next.rows[0].id]);
      }
    }
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

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const orgId = invoice.metadata?.orgId || customer.metadata?.orgId;
        if (orgId && invoice.id) {
          await pool.query(
            `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE organization_id = $1 AND stripe_invoice_id = $2`,
            [orgId, invoice.id]
          );
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
    }

    res.json({ received: true });
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
