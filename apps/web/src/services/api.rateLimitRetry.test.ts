import { describe, it, expect, vi } from 'vitest'
import { rateLimitRetryDelayMs, rateLimitMessage, withRateLimitRetry } from './api'

/** A 429 from the per-IP middleware, which carries a retry hint. */
const perIpRateLimit = (seconds: number) => ({
  response: {
    status: 429,
    headers: { 'retry-after': String(seconds) },
    data: { statusCode: 429, message: 'Too many requests.', retryAfterSeconds: seconds },
  },
})

/** A 429 from a per-recipient cap in the controller, which carries no hint. */
const perRecipientRateLimit = () => ({
  response: {
    status: 429,
    headers: {},
    data: { statusCode: 429, message: 'Too many verification codes requested. Please wait 15 minutes.' },
  },
})

const noSleep = () => Promise.resolve()

describe('rateLimitRetryDelayMs', () => {
  it('reads the wait from the Retry-After header', () => {
    expect(rateLimitRetryDelayMs(perIpRateLimit(12))).toBe(12_000)
  })

  it('falls back to the body hint when the header is absent', () => {
    const err = { response: { status: 429, headers: {}, data: { retryAfterSeconds: 7 } } }
    expect(rateLimitRetryDelayMs(err)).toBe(7_000)
  })

  it('adds jitter so simultaneous clients do not retry in lockstep', () => {
    expect(rateLimitRetryDelayMs(perIpRateLimit(10), 250)).toBe(10_250)
  })

  // The distinction the whole design rests on. A per-recipient cap sends no
  // hint, and must never be waited out automatically.
  it('returns null for a 429 with no retry hint', () => {
    expect(rateLimitRetryDelayMs(perRecipientRateLimit())).toBeNull()
  })

  it('returns null for anything that is not a 429', () => {
    expect(rateLimitRetryDelayMs({ response: { status: 500, data: {} } })).toBeNull()
    expect(rateLimitRetryDelayMs({ message: 'Network Error' })).toBeNull()
  })

  it('rejects a nonsensical hint rather than retrying instantly', () => {
    expect(rateLimitRetryDelayMs(perIpRateLimit(0))).toBeNull()
    expect(rateLimitRetryDelayMs({ response: { status: 429, headers: { 'retry-after': 'soon' }, data: {} } })).toBeNull()
  })
})

describe('rateLimitMessage', () => {
  it('tells the user how long to wait, in seconds', () => {
    expect(rateLimitMessage(perIpRateLimit(45), 'fallback')).toContain('45 seconds')
  })

  it('switches to minutes for a long wait', () => {
    expect(rateLimitMessage(perIpRateLimit(300), 'fallback')).toContain('5 minutes')
  })

  // A per-recipient cap is already well-worded by the controller, and the
  // "15 minutes" it states is more useful than anything invented here.
  it('passes through the server message when there is no hint', () => {
    expect(rateLimitMessage(perRecipientRateLimit(), 'fallback')).toBe(
      'Too many verification codes requested. Please wait 15 minutes.'
    )
  })

  it('falls back when the server said nothing', () => {
    expect(rateLimitMessage({ response: { status: 429, data: {} } }, 'fallback')).toBe('fallback')
  })
})

describe('withRateLimitRetry', () => {
  const noJitter = () => 0

  it('passes straight through on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withRateLimitRetry(fn, { sleep: noSleep, jitterMs: noJitter })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries after the advertised wait and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(perIpRateLimit(3))
      .mockResolvedValueOnce('ok')
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(withRateLimitRetry(fn, { sleep, jitterMs: noJitter })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(3_000)
  })

  it('does not retry a per-recipient cap', async () => {
    const fn = vi.fn().mockRejectedValue(perRecipientRateLimit())
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(withRateLimitRetry(fn, { sleep, jitterMs: noJitter })).rejects.toBeTruthy()
    // One attempt only. Auto-retrying this would park the user on the form for
    // 15 minutes and spend one of their three allowed codes per attempt.
    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('does not retry a non-rate-limit failure', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: 'Bad request' } } })
    await expect(withRateLimitRetry(fn, { sleep: noSleep })).rejects.toBeTruthy()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('gives up after the attempt budget rather than looping', async () => {
    const fn = vi.fn().mockRejectedValue(perIpRateLimit(1))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(withRateLimitRetry(fn, { maxRetries: 2, sleep, jitterMs: noJitter })).rejects.toBeTruthy()
    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  // A person would rather read "try again in 2 minutes" than watch a button
  // for two minutes, so a wait we cannot afford is surfaced immediately.
  it('rejects immediately when the advertised wait exceeds the budget', async () => {
    const fn = vi.fn().mockRejectedValue(perIpRateLimit(60))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(withRateLimitRetry(fn, { budgetMs: 45_000, sleep, jitterMs: noJitter })).rejects.toBeTruthy()
    expect(sleep).not.toHaveBeenCalled()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('stops retrying once the total wait would exceed the budget', async () => {
    const fn = vi.fn().mockRejectedValue(perIpRateLimit(20))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(withRateLimitRetry(fn, { maxRetries: 5, budgetMs: 45_000, sleep, jitterMs: noJitter })).rejects.toBeTruthy()
    // 20s fits twice inside 45s, not three times.
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  // The safety property that makes retrying acceptable at all: a middleware
  // 429 rejects before the controller runs, so a retry sends at most one email.
  it('never sends more than one email across a retry', async () => {
    const sent: string[] = []
    const fn = vi.fn().mockImplementation(async () => {
      if (fn.mock.calls.length === 1) throw perIpRateLimit(1)
      sent.push('code')
      return 'ok'
    })

    await withRateLimitRetry(fn, { sleep: noSleep, jitterMs: noJitter })
    expect(sent).toHaveLength(1)
  })
})
