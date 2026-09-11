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

/**
 * Per-type pricing for domiciliary care organisations.
 * These are configurable per organisation via the billing settings.
 * Amounts are in pence (e.g., 600 = £6.00).
 */
export interface DomiciliaryPricing {
  per_client_monthly: number;   // pence per client per month
  per_carer_monthly: number;    // pence per carer per month
  per_visit: number;            // pence per visit (optional, 0 = disabled)
  travel_pay_included: boolean; // whether travel time is paid
  vat_inclusive: boolean;       // whether prices include VAT
  vat_rate: number;             // VAT rate as percentage (e.g., 20 for 20%)
}

export const DEFAULT_DOMICILIARY_PRICING: DomiciliaryPricing = {
  per_client_monthly: 600,    // £6.00
  per_carer_monthly: 200,     // £2.00
  per_visit: 0,               // disabled by default
  travel_pay_included: false,
  vat_inclusive: false,
  vat_rate: 20,
};

/**
 * Mileage rates configurable by tax year, vehicle type, and fuel category.
 * Based on HMRC Approved Mileage Allowance Payments (AMAP).
 */
export interface MileageRate {
  id: string;
  tax_year: string;           // e.g., '2024-25'
  vehicle_type: 'car' | 'motorcycle' | 'bicycle';
  fuel_category: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  rate_per_mile: number;      // pence per mile
  effective_from: string;     // ISO date
  effective_to: string | null; // ISO date or null for current
}

/**
 * Payroll provider types supported for export.
 */
export type PayrollProvider = 'sage' | 'xero' | 'quickbooks' | 'brightpay' | 'staffology' | 'generic_csv';

export const PAYROLL_PROVIDERS: Record<PayrollProvider, { name: string; format: string }> = {
  sage: { name: 'Sage Payroll', format: 'sage_csv' },
  xero: { name: 'Xero Payroll', format: 'xero_csv' },
  quickbooks: { name: 'QuickBooks Payroll', format: 'quickbooks_csv' },
  brightpay: { name: 'BrightPay', format: 'brightpay_csv' },
  staffology: { name: 'Staffology', format: 'staffology_csv' },
  generic_csv: { name: 'Generic CSV', format: 'csv' },
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
    const isLive = key.startsWith('sk_live');
    const isTest = key.startsWith('sk_test');
    if (process.env.NODE_ENV === 'production' && key && !isLive) {
      console.error(`[stripe] BLOCKED: Production env but key is ${isTest ? 'test-mode' : 'unknown prefix'}. Stripe disabled.`);
      return null as any;
    }
    console.log(`[stripe] Initialized: mode=${isLive ? 'live' : isTest ? 'test' : 'unknown'}, price_starter=${process.env.STRIPE_PRICE_STARTER || '(not set)'}, price_professional=${process.env.STRIPE_PRICE_PROFESSIONAL || '(not set)'}`);
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
    console.log(`[stripe] Price lookup: ${envKey}=${envVal}, actual_amount=${configuredPrice.unit_amount}, actual_currency=${configuredPrice.currency}, actual_interval=${configuredPrice.recurring?.interval}, active=${configuredPrice.active}`);
    if (!isExpectedStripePrice(billingPlan, configuredPrice)) {
      const expected = PLAN_PRICE_CONFIG[billingPlan];
      console.error(`[stripe] REJECTED: ${envKey}=${envVal} has amount=${configuredPrice.unit_amount} but expected ${expected.amount} (${expected.currency} ${expected.amount / 100} per ${expected.interval})`);
      throw new Error(`${envKey} does not match ${billingPlan}: expected ${expected.currency.toUpperCase()} ${expected.amount / 100} per ${expected.interval}, but Stripe price ${envVal} is ${configuredPrice.currency} ${(configuredPrice.unit_amount || 0) / 100} per ${configuredPrice.recurring?.interval || 'unknown'}`);
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
