import { AsyncLocalStorage } from 'async_hooks'
import logger from '../utils/logger'

/**
 * Audit rows must exist before the response that caused them.
 *
 * `AuditRepository.log` used to be called beside a mutation rather than inside
 * it, and nobody awaited it — roughly a hundred call sites. Almost always the
 * insert committed microseconds later and nothing was visible; under load the
 * response could leave first, so a reader on another connection (which is every
 * auditor, every exporter and every second request) found the change with no
 * record of who made it. One endpoint made that visible as a missing row on a
 * record whose *purpose* is the row — `POST /homecare/staff-notices`, the
 * acknowledgement a provider puts in front of an inspector.
 *
 * The decision the tracker left open was per-site: "which of these must have
 * their row before the response leaves?" The answer taken here is *all of them*,
 * because the test that would settle it per site — what would a customer be
 * unable to prove if the process died between the two writes? — has the same
 * answer for every audited mutation. A leave approval, a controlled-drug
 * administration, a compliance sign-off and a settings change are each an event
 * that a provider may be asked to account for, and an audit log that is complete
 * except where it was under load is not evidence.
 *
 * So the writes are tracked per request and the response is deferred until they
 * have settled. Three properties this deliberately keeps:
 *
 *   · **An audit failure still cannot fail the request.** The write's promise
 *     resolves either way — `AuditRepository.log` catches and logs — so awaiting
 *     it can never turn a broken audit insert into a 500. The mutation has
 *     already committed by the time the audit is written, and a failed audit is
 *     reported in the log rather than by breaking a carer's check-in.
 *   · **The wait is bounded.** A wedged database is already capped by the
 *     statement timeout, but a response held open behind an audit insert is the
 *     kind of failure that takes a service down quietly, so the flush has its own
 *     ceiling. Expiry delays nothing: the response goes, and the outstanding
 *     writes are reported so the gap is visible rather than assumed away.
 *   · **Nothing outside a request changes.** With no store in scope — the email
 *     queue, the event worker, a script — a write is tracked nowhere and behaves
 *     exactly as it did before.
 */
export interface AuditWriteStore {
  pending: Set<Promise<unknown>>
}

export const auditWriteStorage = new AsyncLocalStorage<AuditWriteStore>()

/** The per-request store the middleware below puts in scope. */
export function createAuditWriteStore(): AuditWriteStore {
  return { pending: new Set() }
}

/**
 * The longest a response will wait for the audit rows it wrote.
 *
 * Two seconds is not a considered latency budget for an insert on the same
 * connection the mutation just used, which is a millisecond or two; it is a
 * ceiling on how long a request can be held by a database that has stopped
 * answering, chosen to be below every client timeout in the product.
 */
export const AUDIT_FLUSH_TIMEOUT_MS = 2_000

/**
 * Register an audit write with the request that caused it.
 *
 * Returns the same promise it was given, so a caller may still await it. The
 * promise is dropped from the store when it settles — settled or failed, because
 * a failed audit write is not going to succeed on the next tick and holding it
 * until the flush would only make the flush wait for nothing.
 */
export function trackAuditWrite<T>(write: Promise<T>): Promise<T> {
  const store = auditWriteStorage.getStore()
  if (!store) return write
  store.pending.add(write)
  const forget = () => { store.pending.delete(write) }
  void write.then(forget, forget)
  return write
}

/**
 * Wait for the writes this request registered, up to `timeoutMs`.
 *
 * Never rejects: a caller is on the response path and must be able to proceed
 * whatever happened to the audit writes.
 */
export async function flushAuditWrites(
  store: AuditWriteStore,
  timeoutMs: number = AUDIT_FLUSH_TIMEOUT_MS
): Promise<void> {
  if (store.pending.size === 0) return

  // Snapshot: the promise handlers above mutate the set as writes settle.
  const writes = [...store.pending]
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs) })
  try {
    await Promise.race([Promise.allSettled(writes), expired])
  } finally {
    if (timer) clearTimeout(timer)
  }

  if (store.pending.size > 0) {
    logger.warn(
      { pending: store.pending.size, timeoutMs },
      'audit writes had not committed when the response was sent'
    )
  }
}
