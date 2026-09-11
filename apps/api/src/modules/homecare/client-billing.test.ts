import { describe, expect, it } from 'vitest'
import { applyVat, buildFundingBreakdown, calculateClientBillingLine } from './client-billing'

describe('client billing utilisation calculation', () => {
  it('bills completed delivered minutes at the package client rate', () => {
    expect(calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 60, deliveredMinutes: 45, clientRatePence: 1200 })).toMatchObject({
      scheduledMinutes: 60,
      deliveredMinutes: 45,
      clientRatePence: 1200,
      amountPence: 900,
      netAmountPence: 900,
      grossAmountPence: 900,
      vatAmountPence: 0,
      billingStatus: 'billable',
      exclusionReason: null,
    })
  })

  it('applies VAT exclusive and inclusive rules correctly', () => {
    expect(calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 60, deliveredMinutes: 60, clientRatePence: 1000, vatRate: 20, vatInclusive: false })).toMatchObject({ netAmountPence: 1000, vatAmountPence: 200, grossAmountPence: 1200 })
    expect(calculateClientBillingLine({ visitStatus: 'completed', scheduledMinutes: 60, deliveredMinutes: 60, clientRatePence: 1200, vatRate: 20, vatInclusive: true })).toMatchObject({ netAmountPence: 1000, vatAmountPence: 200, grossAmountPence: 1200 })
  })

  it('keeps VAT helpers deterministic on edge rates', () => {
    expect(applyVat(1200, null, false)).toEqual({ vatRate: null, vatInclusive: false, netAmountPence: 1200, vatAmountPence: 0, grossAmountPence: 1200 })
    expect(applyVat(0, 20, false)).toEqual({ vatRate: 20, vatInclusive: false, netAmountPence: 0, vatAmountPence: 0, grossAmountPence: 0 })
    expect(buildFundingBreakdown([{ funding_type: 'private', gross_amount_pence: 1200, net_amount_pence: 1000, vat_amount_pence: 200, billing_status: 'billable' }, { funding_type: 'private', gross_amount_pence: 0, net_amount_pence: 0, vat_amount_pence: 0, billing_status: 'not_billable' }])).toMatchObject({ private: { count: 2, gross_pence: 1200, billable_count: 1 } })
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
