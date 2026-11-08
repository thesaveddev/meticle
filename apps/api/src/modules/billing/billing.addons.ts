/**
 * Purchasable add-ons. Each entry is a recurring Stripe price attached as an
 * extra subscription item on the organisation's plan subscription — the same
 * mechanism plan upgrades use, so an add-on is never a free-form flag: if
 * Stripe did not bill it, the organisation does not hold it.
 *
 * Amounts are pence per month (GBP). Like the plan prices, a `STRIPE_PRICE_*`
 * environment ID may pin the price; it is verified against the amount below
 * before anything is charged (see `getOrCreateAddonPrice`).
 */
export interface AddonDefinition {
  slug: string;
  name: string;
  description: string;
  amount: number;
  currency: 'gbp';
  interval: 'month';
  envKey: string;
}

export const ADDON_CATALOG: AddonDefinition[] = [
  {
    slug: 'extra_location',
    name: 'Additional location',
    description:
      'Run the rota, compliance and reporting for one more registered location on top of your plan allowance.',
    amount: 4900,
    currency: 'gbp',
    interval: 'month',
    envKey: 'STRIPE_PRICE_ADDON_EXTRA_LOCATION',
  },
];

export function getAddon(slug: string): AddonDefinition | undefined {
  return ADDON_CATALOG.find((addon) => addon.slug === slug);
}

export function isAddonSlug(slug: string): boolean {
  return getAddon(slug) !== undefined;
}

/**
 * Reconcile the organisation's add-on flags from the Stripe subscription's
 * items. A slug counts only when it names a catalogued add-on — anything
 * else on the subscription (plan items, legacy prices) is ignored. Pure so
 * the webhook and the tests share the rule.
 */
export function reconcileAddonsFromItems(
  items: Array<{ metadata?: Record<string, string> | null } | null | undefined> | null | undefined,
): string[] {
  if (!items) return [];
  const found = new Set<string>();
  for (const item of items) {
    const slug = item?.metadata?.addon;
    if (slug && isAddonSlug(slug)) found.add(slug);
  }
  return [...found].sort();
}

export function formatAddonAmount(addon: AddonDefinition): string {
  return `£${(addon.amount / 100).toFixed(2)}`;
}
