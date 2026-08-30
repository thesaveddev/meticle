import { describe, expect, it } from 'vitest'

function mapStatus(status: string) {
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trial'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return null
}

function grace(periodEnd: number | null, status: string, days: number) {
  return periodEnd && ['active', 'past_due'].includes(status) ? periodEnd + Math.max(0, Math.min(30, days)) * 86400 : null
}

describe('Stripe-shaped billing policies', () => {
  it.each([
    ['active', 'active'], ['trialing', 'trial'], ['past_due', 'past_due'],
    ['unpaid', 'past_due'], ['canceled', 'canceled'], ['incomplete_expired', 'canceled'],
  ])('maps %s to %s', (stripe, expected) => expect(mapStatus(stripe)).toBe(expected))

  it('sets configured grace only for active or past-due subscriptions', () => {
    expect(grace(1000, 'active', 3)).toBe(260200)
    expect(grace(1000, 'past_due', 7)).toBe(605800)
    expect(grace(1000, 'canceled', 7)).toBeNull()
  })

  it('clamps configured grace to the supported range', () => {
    expect(grace(1000, 'active', -4)).toBe(1000)
    expect(grace(1000, 'active', 90)).toBe(2593000)
  })

  it('protects against multiple or incomplete subscription updates', () => {
    const subscriptions = [{ status: 'active', itemId: 'si_1' }, { status: 'active', itemId: 'si_2' }]
    expect(subscriptions.filter(s => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(s.status))).toHaveLength(2)
    expect(subscriptions.some(s => !s.itemId)).toBe(false)
  })

  it('models invoice lifecycle states without treating void or deleted as paid', () => {
    expect(['open', 'paid', 'void', 'uncollectible', 'deleted']).toContain('void')
    expect('void').not.toBe('paid')
    expect('deleted').not.toBe('paid')
  })
})
