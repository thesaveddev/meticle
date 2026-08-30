import { describe, expect, it } from 'vitest'

function graceEnd(periodEnd: number, days = 7) {
  return periodEnd + days * 86400
}

function stateForStripeStatus(status: string, periodEnd: number | null, graceDays = 7) {
  if (status === 'canceled' || status === 'incomplete_expired') {
    return { subscriptionStatus: 'canceled', currentPeriodEnd: periodEnd, gracePeriodEndsAt: null }
  }
  const subscriptionStatus = status === 'trialing' ? 'trial' : status === 'unpaid' || status === 'past_due' ? 'past_due' : 'active'
  return {
    subscriptionStatus,
    currentPeriodEnd: periodEnd,
    gracePeriodEndsAt: periodEnd == null ? null : graceEnd(periodEnd, graceDays),
  }
}

describe('Stripe billing state transitions', () => {
  it('sets period and grace for active subscriptions', () => {
    expect(stateForStripeStatus('active', 1_000)).toEqual({ subscriptionStatus: 'active', currentPeriodEnd: 1_000, gracePeriodEndsAt: 605_800 })
  })

  it('sets period and grace for past-due subscriptions', () => {
    expect(stateForStripeStatus('past_due', 1_000)).toEqual({ subscriptionStatus: 'past_due', currentPeriodEnd: 1_000, gracePeriodEndsAt: 605_800 })
  })

  it('clears grace when Stripe cancels a subscription', () => {
    expect(stateForStripeStatus('canceled', 1_000)).toEqual({ subscriptionStatus: 'canceled', currentPeriodEnd: 1_000, gracePeriodEndsAt: null })
  })

  it('supports a configured grace length', () => {
    expect(stateForStripeStatus('active', 1_000, 3).gracePeriodEndsAt).toBe(260_200)
  })

  it('does not create a grace timestamp without a billing period end', () => {
    expect(stateForStripeStatus('active', null).gracePeriodEndsAt).toBeNull()
  })
})
