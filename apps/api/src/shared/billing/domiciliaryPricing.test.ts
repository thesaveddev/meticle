import { describe, expect, it } from 'vitest';
import { domiciliaryContractMrr, isDomiciliaryServiceTypes, isInvoiceForSubscription, isStripeSubscriptionForCustomer, stripeSubscriptionIdFromInvoice } from './domiciliaryPricing';

describe('domiciliary pricing reporting', () => {
  it('recognises domiciliary and live-in service types, including mixed providers', () => {
    expect(isDomiciliaryServiceTypes('domiciliary', ['supported_living'])).toBe(true);
    expect(isDomiciliaryServiceTypes('supported_living', ['live_in'])).toBe(true);
    expect(isDomiciliaryServiceTypes('supported_living', ['supported_living'])).toBe(false);
    expect(isDomiciliaryServiceTypes(null, null)).toBe(false);
  });

  it('counts only accepted subscriptions and returns active monthly pence as pounds', () => {
    expect(domiciliaryContractMrr({ quoteAcceptedAt: null, stripeSubscriptionId: 'sub_1', activeMonthlyPricePence: 25000 })).toBe(0);
    expect(domiciliaryContractMrr({ quoteAcceptedAt: new Date(), stripeSubscriptionId: null, activeMonthlyPricePence: 25000 })).toBe(0);
    expect(domiciliaryContractMrr({ quoteAcceptedAt: new Date(), stripeSubscriptionId: 'sub_1', activeMonthlyPricePence: 25000 })).toBe(250);
    expect(domiciliaryContractMrr({ quoteAcceptedAt: new Date(), stripeSubscriptionId: 'sub_1', activeMonthlyPricePence: null })).toBe(0);
  });

  it('supports Stripe invoices using either the legacy or current subscription field', () => {
    expect(stripeSubscriptionIdFromInvoice({ subscription: 'sub_legacy' })).toBe('sub_legacy');
    expect(stripeSubscriptionIdFromInvoice({ parent: { subscription_details: { subscription: { id: 'sub_current' } } } })).toBe('sub_current');
    expect(stripeSubscriptionIdFromInvoice({})).toBeNull();
  });

  it('matches an invoice only to the current subscription', () => {
    expect(isInvoiceForSubscription({ subscription: 'sub_current' }, 'sub_current')).toBe(true);
    expect(isInvoiceForSubscription({ subscription: 'sub_old' }, 'sub_current')).toBe(false);
    expect(isInvoiceForSubscription({ parent: { subscription_details: { subscription: { id: 'sub_current' } } } }, 'sub_current')).toBe(true);
    expect(isInvoiceForSubscription({ subscription: 'sub_current' }, null)).toBe(false);
  });

  it('confirms the stored subscription belongs to the organisation customer', () => {
    expect(isStripeSubscriptionForCustomer('cus_1', 'cus_1')).toBe(true);
    expect(isStripeSubscriptionForCustomer({ id: 'cus_1' }, 'cus_1')).toBe(true);
    expect(isStripeSubscriptionForCustomer('cus_other', 'cus_1')).toBe(false);
    expect(isStripeSubscriptionForCustomer('cus_1', null)).toBe(false);
  });
});
