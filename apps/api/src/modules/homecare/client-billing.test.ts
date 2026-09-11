import { describe, expect, it } from 'vitest'
import { calculateClientBillingLine } from './client-billing'

describe('client billing utilisation calculation', () => {
  it('bills completed delivered minutes at the package client rate', () => {
    expect(calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 60, deliveredMinutes: 45, clientRatePence: 1200 })).toEqual({
      scheduledMinutes: 60,
      deliveredMinutes: 45,
      clientRatePence: 1200,
      amountPence: 900,
      billingStatus: 'billable',
      exclusionReason: null,
    })
  })

  it.each(['missed', 'cancelled'])('does not bill a %s visit', (visitStatus) => {
    const result = calculateClientBillingLine({ visitStatus, scheduledMinutes: 30, deliveredMinutes: 0, clientRatePence: 1200 })
    expect(result.amountPence).toBe(0)
    expect(result.billingStatus).toBe('not_billable')
  })

  it('holds incomplete visits for review rather than billing them', () => {
    const result = calculateClientBillingLine({ visitStatus: 'checked_in', scheduledMinutes: 30, deliveredMinutes: 0, clientRatePence: 1200 })
    expect(result.billingStatus).toBe('review')
    expect(result.exclusionReason).toBe('Visit is not completed')
  })

  it('holds completed visits without a client rate for review', () => {
    const result = calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 30, deliveredMinutes: 30, clientRatePence: null })
    expect(result.billingStatus).toBe('review')
    expect(result.amountPence).toBe(0)
  })

  it('holds a completed visit with no delivered minutes for review', () => {
    const result = calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 30, deliveredMinutes: 0, clientRatePence: 1200 })
    expect(result.billingStatus).toBe('review')
    expect(result.exclusionReason).toBe('No delivered minutes recorded')
  })
})
