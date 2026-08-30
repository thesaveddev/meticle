import { describe, expect, it } from 'vitest'

type EventState = 'processing' | 'processed' | 'failed'

function claim(existing: { status: EventState; updatedAt: number } | null, now: number) {
  if (!existing) return { claimed: true, status: 'processing' as const, attempts: 1 }
  const stale = existing.status === 'processing' && now - existing.updatedAt >= 600_000
  if (existing.status === 'failed' || stale) {
    return { claimed: true, status: 'processing' as const, attempts: 2 }
  }
  return { claimed: false, status: existing.status, attempts: 1 }
}

describe('Webhook idempotency state machine', () => {
  it('claims a new event once', () => {
    expect(claim(null, 100)).toEqual({ claimed: true, status: 'processing', attempts: 1 })
  })

  it('does not allow a concurrent delivery to claim a processing event', () => {
    expect(claim({ status: 'processing', updatedAt: 100 }, 101)).toEqual({ claimed: false, status: 'processing', attempts: 1 })
  })

  it('allows a failed event to be retried', () => {
    expect(claim({ status: 'failed', updatedAt: 100 }, 101)).toEqual({ claimed: true, status: 'processing', attempts: 2 })
  })

  it('allows recovery of a stale processing claim', () => {
    expect(claim({ status: 'processing', updatedAt: 100 }, 600101)).toEqual({ claimed: true, status: 'processing', attempts: 2 })
  })

  it('does not reprocess a completed event', () => {
    expect(claim({ status: 'processed', updatedAt: 100 }, 600101)).toEqual({ claimed: false, status: 'processed', attempts: 1 })
  })
})
