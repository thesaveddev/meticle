import { describe, expect, it } from 'vitest'
import { isExpectedStripePrice, PLAN_PRICE_CONFIG } from './stripe.service'

describe('Stripe plan price invariants', () => {
  it('matches the prices shown in the billing UI', () => {
    expect(PLAN_PRICE_CONFIG).toEqual({
      starter: { amount: 9900, currency: 'gbp', interval: 'month' },
      professional: { amount: 29900, currency: 'gbp', interval: 'month' },
    })
  })

  it('accepts only active monthly GBP prices at the configured amount', () => {
    expect(isExpectedStripePrice('professional', {
      active: true,
      currency: 'gbp',
      unit_amount: 29900,
      recurring: { interval: 'month', interval_count: 1 } as any,
    })).toBe(true)
  })

  it.each([
    ['wrong amount', { active: true, currency: 'gbp', unit_amount: 15000, recurring: { interval: 'month', interval_count: 1 } }],
    ['wrong interval', { active: true, currency: 'gbp', unit_amount: 29900, recurring: { interval: 'year', interval_count: 1 } }],
    ['inactive price', { active: false, currency: 'gbp', unit_amount: 29900, recurring: { interval: 'month', interval_count: 1 } }],
    ['wrong currency', { active: true, currency: 'usd', unit_amount: 29900, recurring: { interval: 'month', interval_count: 1 } }],
  ])('rejects %s', (_label, price) => {
    expect(isExpectedStripePrice('professional', price as any)).toBe(false)
  })
})
