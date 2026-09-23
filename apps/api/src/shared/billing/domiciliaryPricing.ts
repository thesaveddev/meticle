type InvoiceSubscriptionReference = string | { id?: string } | null | undefined;

export type DomiciliaryContractState = {
  quoteAcceptedAt: Date | string | null;
  stripeSubscriptionId: string | null;
  activeMonthlyPricePence: number | null;
};

export function domiciliaryContractMrr(state: DomiciliaryContractState): number {
  if (!state.quoteAcceptedAt || !state.stripeSubscriptionId) return 0;
  const amountPence = Number(state.activeMonthlyPricePence);
  if (!Number.isSafeInteger(amountPence) || amountPence < 0) return 0;
  return amountPence / 100;
}

export function isDomiciliaryServiceTypes(primaryServiceType: string | null, serviceTypes: unknown): boolean {
  const types = [
    ...(primaryServiceType ? [primaryServiceType] : []),
    ...(Array.isArray(serviceTypes) ? serviceTypes.filter((value): value is string => typeof value === 'string') : []),
  ];
  return types.some(type => type === 'domiciliary' || type === 'live_in');
}

export function stripeSubscriptionIdFromInvoice(invoice: {
  subscription?: InvoiceSubscriptionReference;
  parent?: { subscription_details?: { subscription?: InvoiceSubscriptionReference } } | null;
}): string | null {
  const reference = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (typeof reference === 'string') return reference;
  return typeof reference?.id === 'string' ? reference.id : null;
}

export function isInvoiceForSubscription(
  invoice: Parameters<typeof stripeSubscriptionIdFromInvoice>[0],
  subscriptionId: string | null | undefined,
): boolean {
  return !!subscriptionId && stripeSubscriptionIdFromInvoice(invoice) === subscriptionId;
}

export function isStripeSubscriptionForCustomer(
  subscriptionCustomer: string | { id?: string } | null | undefined,
  customerId: string | null | undefined,
): boolean {
  const subscriptionCustomerId = typeof subscriptionCustomer === 'string'
    ? subscriptionCustomer
    : subscriptionCustomer?.id;
  return !!customerId && subscriptionCustomerId === customerId;
}
