import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export type BillingPlan = 'starter' | 'professional';

/**
 * The application-facing catalogue is deliberately kept separate from Stripe
 * price IDs. Stripe IDs are environment-specific; these are the invariants the
 * configured Stripe prices must satisfy before a subscription can be changed.
 */
export const PLAN_PRICE_CONFIG: Record<BillingPlan, {
  amount: number;
  currency: 'gbp';
  interval: 'month';
}> = {
  starter: { amount: 9900, currency: 'gbp', interval: 'month' },
  professional: { amount: 29900, currency: 'gbp', interval: 'month' },
};

export function isExpectedStripePrice(
  plan: string,
  price: Pick<Stripe.Price, 'active' | 'currency' | 'unit_amount' | 'recurring'>,
): price is Pick<Stripe.Price, 'active' | 'currency' | 'unit_amount' | 'recurring'> & { active: true } {
  if (!(plan in PLAN_PRICE_CONFIG) || !price.active) return false;
  const expected = PLAN_PRICE_CONFIG[plan as BillingPlan];
  return price.currency === expected.currency
    && price.unit_amount === expected.amount
    && price.recurring?.interval === expected.interval
    && (price.recurring?.interval_count ?? 1) === 1;
}

let stripeInstance: Stripe | null = null;
let cachedPrices: Partial<Record<BillingPlan, string>> | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null as any;
    if (process.env.NODE_ENV === 'production' && key && !key.startsWith('sk_live')) {
      return null as any;
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(orgId: string, email: string, name: string): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  const { default: pool } = await import('../database');
  const existing = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [orgId]);
  if (existing.rows[0]?.stripe_customer_id) return existing.rows[0].stripe_customer_id;

  // Recover customers created before the database link was persisted. The
  // organizationId metadata is authoritative and prevents duplicate Stripe
  // customers when a request succeeded at Stripe but the DB write was missed.
  let customer: Stripe.Customer | null = null;
  try {
    const matches = await s.customers.search({
      query: `metadata['organizationId']:'${orgId}'`,
      limit: 1,
    });
    customer = matches.data[0] || null;
  } catch {
    // Customer search may be unavailable on some Stripe accounts; fall back to
    // the exact email match and still verify the organization metadata.
    const matches = await s.customers.list({ email, limit: 20 });
    customer = matches.data.find(candidate => candidate.metadata?.organizationId === orgId) || null;
  }

  if (!customer) {
    customer = await s.customers.create({ email, name, metadata: { organizationId: orgId } });
  }
  await pool.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2', [customer.id, orgId]);
  return customer.id;
}

export async function getOrCreatePrice(plan: string): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;
  if (!(plan in PLAN_PRICE_CONFIG)) throw new Error(`Unsupported billing plan: ${plan}`);

  const billingPlan = plan as BillingPlan;
  const envKey = billingPlan === 'starter' ? 'STRIPE_PRICE_STARTER' : 'STRIPE_PRICE_PROFESSIONAL';
  const envVal = process.env[envKey];

  if (envVal) {
    // Never trust an environment ID blindly. A stale/test/annual price here can
    // otherwise silently charge a different amount than the UI promises.
    const configuredPrice = await s.prices.retrieve(envVal);
    if (!isExpectedStripePrice(billingPlan, configuredPrice)) {
      const expected = PLAN_PRICE_CONFIG[billingPlan];
      throw new Error(`${envKey} does not match ${billingPlan}: expected ${expected.currency.toUpperCase()} ${expected.amount / 100} per ${expected.interval}`);
    }
    return configuredPrice.id;
  }
  if (process.env.NODE_ENV === 'production') throw new Error(`${envKey} must be configured in production`);

  if (cachedPrices?.[billingPlan]) return cachedPrices[billingPlan]!;

  const name = billingPlan === 'starter' ? 'Starter' : 'Professional';
  const expected = PLAN_PRICE_CONFIG[billingPlan];
  const products = await s.products.list({ active: true, limit: 100 });
  let product = products.data.find(p => p.name === `Meticle ${name}`);
  if (!product) {
    product = await s.products.create({ name: `Meticle ${name}`, description: `${name} plan monthly subscription` });
  }

  const prices = await s.prices.list({ product: product.id, active: true, limit: 100, type: 'recurring' });
  const matchingPrice = prices.data.find(price => isExpectedStripePrice(billingPlan, price));
  if (matchingPrice) {
    process.env[envKey] = matchingPrice.id;
    if (!cachedPrices) cachedPrices = {};
    cachedPrices[billingPlan] = matchingPrice.id;
    return matchingPrice.id;
  }

  const price = await s.prices.create({
    product: product.id,
    unit_amount: expected.amount,
    currency: expected.currency,
    recurring: { interval: expected.interval },
  });
  process.env[envKey] = price.id;
  if (!cachedPrices) cachedPrices = {};
  cachedPrices[billingPlan] = price.id;
  return price.id;
}
