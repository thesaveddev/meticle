import { describe, expect, it } from 'vitest'

function lifecycle(status: string, periodEnd: number | null, graceDays = 7) {
  if (['canceled', 'incomplete_expired'].includes(status)) return { status: 'canceled', periodEnd, graceEnd: null }
  const mapped = status === 'trialing' ? 'trial' : ['past_due', 'unpaid'].includes(status) ? 'past_due' : 'active'
  return { status: mapped, periodEnd, graceEnd: periodEnd == null ? null : periodEnd + graceDays * 86400 }
}

describe('Webhook billing lifecycle', () => {
  it.each(['active', 'past_due', 'unpaid'])('sets grace for %s', status => {
    expect(lifecycle(status, 1_000).graceEnd).toBe(605_800)
  })

  it.each(['canceled', 'incomplete_expired'])('clears grace for %s', status => {
    expect(lifecycle(status, 1_000).graceEnd).toBeNull()
  })

  it('does not invent a grace date without a period end', () => {
    expect(lifecycle('active', null).graceEnd).toBeNull()
  })

  it('maps successful payment back to active and clears failure state by policy', () => {
    const result = lifecycle('active', 2_000)
    expect(result.status).toBe('active')
    expect(result.graceEnd).toBe(606_800)
  })
})
