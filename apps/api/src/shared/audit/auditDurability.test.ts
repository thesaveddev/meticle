/**
 * The mechanism that keeps a response from overtaking the audit row it caused.
 *
 * Tested at the unit level on purpose: whether a *particular* endpoint's audit
 * insert wins the race is a timing question that a test can only observe by
 * getting lucky, whereas "the response does not end until the write has settled"
 * is a property of four functions and can be asserted exactly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AUDIT_FLUSH_TIMEOUT_MS,
  auditWriteStorage,
  createAuditWriteStore,
  flushAuditWrites,
  trackAuditWrite,
} from './auditDurability'
import logger from '../utils/logger'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('audit write durability', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => logger as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks nothing when there is no request in scope', async () => {
    // A background job or a script must behave exactly as it did before.
    const store = createAuditWriteStore()
    const write = deferred()
    const returned = trackAuditWrite(write.promise)

    expect(returned).toBe(write.promise)
    expect(store.pending.size).toBe(0)

    write.resolve()
    await flushAuditWrites(store)
    expect(store.pending.size).toBe(0)
  })

  it('registers a write with the request store, and forgets it once it settles', async () => {
    const store = createAuditWriteStore()
    await auditWriteStorage.run(store, async () => {
      const write = deferred()
      trackAuditWrite(write.promise)
      expect(store.pending.size).toBe(1)
      write.resolve()
      await tick()
      expect(store.pending.size).toBe(0)
    })
  })

  it('forgets a failed write too, so the flush never waits for a rejection', async () => {
    const store = createAuditWriteStore()
    await auditWriteStorage.run(store, async () => {
      const write = deferred()
      // `AuditRepository.log` catches internally; this proves the tracking does
      // not depend on that, since a rejected promise left in the set would make
      // the flush wait for a write that has already given up.
      void trackAuditWrite(write.promise).then(() => undefined, () => undefined)
      write.reject(new Error('audit insert failed'))
      await tick()
      expect(store.pending.size).toBe(0)
    })
  })

  it('does not resolve the flush until the write has settled', async () => {
    const store = createAuditWriteStore()
    const write = deferred()

    await auditWriteStorage.run(store, async () => {
      trackAuditWrite(write.promise)

      let flushed = false
      const flushing = flushAuditWrites(store).then(() => { flushed = true })

      await tick()
      expect(flushed).toBe(false)

      write.resolve()
      await flushing
      expect(flushed).toBe(true)
    })
  })

  it('returns immediately when the request wrote nothing', async () => {
    const store = createAuditWriteStore()
    const started = Date.now()
    await flushAuditWrites(store, 60_000)
    expect(Date.now() - started).toBeLessThan(1_000)
  })

  it('gives up at the ceiling, reports the writes still outstanding, and does not reject', async () => {
    const store = createAuditWriteStore()
    const write = deferred()

    await auditWriteStorage.run(store, async () => {
      trackAuditWrite(write.promise)

      let finished = false
      const flushing = flushAuditWrites(store, 10).then(() => { finished = true })

      // Well past the ceiling, which the still-unresolved write cannot reach.
      await new Promise(resolve => setTimeout(resolve, 60))
      // A response held open behind a wedged database is the failure this bound
      // exists for, so the flush resolves with the write still outstanding.
      expect(finished).toBe(true)
      expect(store.pending.size).toBe(1)
      await flushing
      expect(logger.warn).toHaveBeenCalled()

      write.resolve()
      await tick()
    })
  })

  it('has a ceiling well below every client timeout in the product', () => {
    expect(AUDIT_FLUSH_TIMEOUT_MS).toBeLessThanOrEqual(5_000)
  })
})
