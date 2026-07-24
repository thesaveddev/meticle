import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

let stripeInstance: Stripe | null = null;
let cachedPrices: { starter: string; professional: string } | null = null;

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
  const customer = await s.customers.create({ email, name, metadata: { orgId } });
  await pool.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2', [customer.id, orgId]);
  return customer.id;
}

export async function getOrCreatePrice(plan: string): Promise<string | null> {
  const s = getStripe();
  if (!s) return null;

  const envKey = plan === 'starter' ? 'STRIPE_PRICE_STARTER' : 'STRIPE_PRICE_PROFESSIONAL';
  const envVal = process.env[envKey];
  if (envVal) return envVal;

  if (cachedPrices?.[plan as keyof typeof cachedPrices]) return cachedPrices[plan as keyof typeof cachedPrices];

  const name = plan === 'starter' ? 'Starter' : 'Professional';
  const amount = plan === 'starter' ? 9900 : 29900; // £99.00 / £299.00 in pence

  const products = await s.products.list({ active: true, limit: 100 });
  let product = products.data.find(p => p.name === `Meticle ${name}`);
  if (!product) {
    product = await s.products.create({ name: `Meticle ${name}`, description: `${name} plan monthly subscription` });
  }

  const prices = await s.prices.list({ product: product.id, active: true, limit: 1, type: 'recurring' });
  if (prices.data.length > 0) {
    const pid = prices.data[0].id;
    process.env[envKey] = pid;
    if (!cachedPrices) cachedPrices = { starter: '', professional: '' };
    (cachedPrices as any)[plan] = pid;
    return pid;
  }

  const price = await s.prices.create({
    product: product.id,
    unit_amount: amount, // £X.XX in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
  });
  process.env[envKey] = price.id;
  if (!cachedPrices) cachedPrices = { starter: '', professional: '' };
  (cachedPrices as any)[plan] = price.id;
  return price.id;
}
