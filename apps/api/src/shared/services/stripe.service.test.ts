import { describe, expect, it } from 'vitest'
import { domiciliaryContractPriceLookupKey, isExpectedDomiciliaryContractPrice, isExpectedStripePrice, PLAN_PRICE_CONFIG } from './stripe.service'
import { domiciliaryContractMrr, isDomiciliaryServiceTypes } from '../billing/domiciliaryPricing'

describe('domiciliary subscription reporting invariants', () => {
  it('recognizes domiciliary service across primary and secondary service types', () => {
    expect(isDomiciliaryServiceTypes('supported_living', ['domiciliary'])).toBe(true)
    expect(isDomiciliaryServiceTypes('supported_living', ['supported_living'])).toBe(false)
  })

  it('reports MRR only for accepted contracts with a recorded Stripe subscription', () => {
    expect(domiciliaryContractMrr({ quoteAcceptedAt: null, stripeSubscriptionId: 'sub_1', activeMonthlyPricePence: 25000 })).toBe(0)
    expect(domiciliaryContractMrr({ quoteAcceptedAt: new Date(), stripeSubscriptionId: null, activeMonthlyPricePence: 25000 })).toBe(0)
    expect(domiciliaryContractMrr({ quoteAcceptedAt: new Date(), stripeSubscriptionId: 'sub_1', activeMonthlyPricePence: 25000 })).toBe(250)
  })
})



describe('Stripe plan price invariants', () => {
  it('matches the prices shown in the billing UI', () => {
    expect(PLAN_PRICE_CONFIG).toEqual({
      starter: { amount: 9900, currency: 'gbp', interval: 'month' },
      professional: { amount: 29900, currency: 'gbp', interval: 'month' },
    })
  })

  it('defines one supported monthly GBP price for each purchasable plan', () => {
    expect(Object.keys(PLAN_PRICE_CONFIG)).toEqual(['starter', 'professional'])
    expect(PLAN_PRICE_CONFIG.starter.amount).toBe(9900)
    expect(PLAN_PRICE_CONFIG.professional.amount).toBe(29900)
  })

  it('accepts only active monthly GBP prices at the configured amount', () => {
    expect(isExpectedStripePrice('professional', {
      active: true,
      currency: 'gbp',
      unit_amount: 29900,
      recurring: { interval: 'month', interval_count: 1 } as any,
    })).toBe(true)
    expect(isExpectedStripePrice('starter', {
      active: true,
      currency: 'gbp',
      unit_amount: 9900,
      recurring: { interval: 'month', interval_count: 1 } as any,
    })).toBe(true)
  })

  it('uses a distinct Stripe lookup key for VAT treatment', () => {
    expect(domiciliaryContractPriceLookupKey(25000, 'exclusive')).not.toBe(domiciliaryContractPriceLookupKey(25000, 'inclusive'))
    expect(() => domiciliaryContractPriceLookupKey(0, 'exclusive')).toThrow(/positive integer/)
    expect(() => domiciliaryContractPriceLookupKey(25000.5, 'exclusive')).toThrow(/positive integer/)
  })

  it('accepts only a matching monthly GBP domiciliary price with the agreed VAT basis', () => {
    const expected = {
      active: true,
      currency: 'gbp',
      unit_amount: 25000,
      recurring: { interval: 'month', interval_count: 1 },
      tax_behavior: 'exclusive',
      metadata: { pricingModel: 'sales_led', vatBehavior: 'exclusive' },
    }
    expect(isExpectedDomiciliaryContractPrice(25000, 'exclusive', expected as any)).toBe(true)
    expect(isExpectedDomiciliaryContractPrice(25000, 'inclusive', expected as any)).toBe(false)
    expect(isExpectedDomiciliaryContractPrice(25000, 'exclusive', { ...expected, tax_behavior: 'inclusive' } as any)).toBe(false)
    expect(isExpectedDomiciliaryContractPrice(25000, 'exclusive', { ...expected, metadata: { ...expected.metadata, vatBehavior: 'inclusive' } } as any)).toBe(false)
    expect(isExpectedDomiciliaryContractPrice(25000, 'exclusive', { ...expected, active: false } as any)).toBe(false)
  })

  it.each([
    ['wrong amount', { active: true, currency: 'gbp', unit_amount: 15000, recurring: { interval: 'month', interval_count: 1 } }],
    ['wrong interval', { active: true, currency: 'gbp', unit_amount: 29900, recurring: { interval: 'year', interval_count: 1 } }],
    ['inactive price', { active: false, currency: 'gbp', unit_amount: 29900, recurring: { interval: 'month', interval_count: 1 } }],
    ['wrong currency', { active: true, currency: 'usd', unit_amount: 29900, recurring: { interval: 'month', interval_count: 1 } }],
    ['multiple months per interval', { active: true, currency: 'gbp', unit_amount: 29900, recurring: { interval: 'month', interval_count: 2 } }],
  ])('rejects %s', (_label, price) => {
    expect(isExpectedStripePrice('professional', price as any)).toBe(false)
  })
})
