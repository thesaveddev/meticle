/**
 * Mica's follow-up memory: a small, org+user-scoped conversation store so a
 * spoken follow-up like "what about tomorrow?" resolves against the previous
 * turn ("who is on shift today?") without any client-side history.
 *
 * Design, stated plainly for the disclosure prompts:
 *
 *   - Server-side only. The client holds one opaque sessionId string; the
 *     transcript never lives in the browser, so a shared or compromised
 *     device cannot replay someone's Q&A history.
 *
 *   - Scoped by (organizationId, userId). A session id is never accepted from
 *     another user or org — lookups require both, so guessing a session id
 *     reads nothing across tenants or colleagues. The scoping is enforced
 *     *inside* the stored blob, not by key naming alone, so the check holds
 *     identically on the Redis and in-memory paths.
 *
 *   - What we keep: the user's own questions and Mica's *final* answers as the
 *     staff member heard them (real names restored). We do NOT keep tool
 *     results or pseudonym maps; the next turn re-derives anything it needs
 *     from the data. This mirrors how a human would recall a conversation —
 *     "you asked who was on shift, I said Fatima Iqbal" — not a database
 *     snapshot, which also keeps the stored data identical to what was already
 *     spoken aloud in the room.
 *
 *   - One exception, and it carries no record data: the page Mica just offered
 *     to open — a route, a label and a destination, never a name or an id — so
 *     that a bare "yes" can be answered by the server that asked the question.
 *     It is replaced by every recorded turn, so an offer never outlives the next
 *     thing said.
 *
 *     The exception covers writes as well as list answers. A confirmed write ends
 *     by offering the record's own page (`mica.recordPages.ts`), and that page is
 *     held here by `setPendingPage` because a write has no turn to hang it on: it
 *     is a save, not a question and an answer. The two doors set the same field,
 *     and the "yes" that answers either is the same code path.
 *
 *   - Bounded: 6 turns max, 30-minute inactivity TTL. Long enough for a shift
 *     handover's worth of follow-ups, short enough that "today" in a stored
 *     question almost always still means the same day.
 *
 *   - Snapshot once per reply, not per turn: the controller calls
 *     recordTurn() exactly once after the model's answer is final, and the
 *     store writes the resulting blob with a sliding TTL. Under multi-instance
 *     deploys a lost mid-conversation write only degrades to Mica treating
 *     the next follow-up as fresh — never to a wrong answer.
 *
 *   - Redis-backed when REDIS_URL is usable, with a per-request in-process
 *     Map fallback when it is not, so a Redis restart degrades conversation
 *     memory but never blocks a question. Every method is awaited by the
 *     controller and no path can hang: the Redis timeout telescopes the
 *     same connect budget as the shared client (see shared/redis), and an
 *     unavailable client falls through to memory immediately.
 */

import { getRedisClient } from '../../shared/redis';
import type { MicaNavigationDestination } from './mica.navigation';
import logger from '../../shared/utils/logger';

const MAX_TURNS = 6;
const TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
/** Redis key prefix — kept short; keys are `mica:sess:<sessionId>` inside it. */
const KEY_PREFIX = 'mica:sess:';

/** Hard ceiling on any one Redis operation so a wedged socket cannot hang a
 * question that would otherwise answer in memory. */
const REDIS_OP_TIMEOUT_MS = Number(process.env.REDIS_OP_TIMEOUT_MS) || 1_000;

export interface MicaTurn {
  question: string;
  answer: string;
  /** Epoch ms when the turn was stored — used for TTL. */
  at: number;
}

export interface MicaSession {
  sessionId: string;
  organizationId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  turns: MicaTurn[];
  /**
   * The page Mica offered to open in its last answer, waiting on the next word
   * ("yes", "go on"). The client is told *that* an offer is outstanding so it can
   * route the next utterance to the endpoint that can open it; what it will open
   * is decided here. Absent when nothing was offered — or when the offer has been
   * replaced by a later turn.
   */
  pendingPage?: MicaPendingPage;
}

/** A page waiting on the carer's confirmation. A route, not a record. */
export interface MicaPendingPage {
  destination: MicaNavigationDestination;
  path: string;
  label: string;
}

const sessions = new Map<string, MicaSession>();

/** Removes expired sessions. Cheap: only iterates what exists. */
function sweep(now: number): void {
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > TTL_MS) sessions.delete(id);
  }
}

// Periodic sweep rather than a lazy per-request gate: a quiet hour that
// receives no requests would otherwise leave dead sessions resident in the
// map indefinitely. Runs every minute; unref'd so the timer alone never
// keeps the process (or a test runner) alive.
const SWEEP_INTERVAL_MS = 60_000;
let sweepsRun = 0;
function runSweep(): void {
  sweep(Date.now());
  sweepsRun += 1;
}
const sweepTimer = setInterval(runSweep, SWEEP_INTERVAL_MS);
if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

/** Test/ops hook: run a sweep immediately and return this process's live count. */
export function sweepExpiredSessions(): number {
  runSweep();
  return sessionCount();
}

/** Test hook: how many periodic sweeps have fired in this process. */
export function sweepCount(): number {
  return sweepsRun;
}

/** Generates an unguessable session id. Crypto when available, else random. */
function newSessionId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `ses-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Runs a Redis operation with a hard timeout; null on failure so callers can
 * fall back to the in-process map instead of hanging the request. */
async function withTimeout<T>(
  op: (client: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>) => Promise<T>,
): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), REDIS_OP_TIMEOUT_MS);
    op(client)
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

/**
 * Loads the caller's session, or creates one when `sessionId` is absent or
 * no longer valid. The Redis copy is authoritative when present (multi-
 * instance deploys share it); the in-process map is both the fallback store
 * and a fast-path cache of the session this worker has seen this shift, so
 * the common case is one Redis GET per turn. Returns null for a supplied id
 * that does not belong to this user+org — the caller treats that like a
 * fresh conversation.
 */
export function loadOrCreateSession(
  organizationId: string,
  userId: string,
  sessionId?: string,
): Promise<MicaSession | null> {
  return loadOrCreateSessionAsync(organizationId, userId, sessionId);
}

async function loadOrCreateSessionAsync(
  organizationId: string,
  userId: string,
  sessionId?: string,
): Promise<MicaSession | null> {
  const restore = (blob: MicaSession | null | undefined): MicaSession | null =>
    blob &&
    blob.organizationId === organizationId &&
    blob.userId === userId &&
    Date.now() - blob.updatedAt <= TTL_MS
      ? blob
      : null;

  if (sessionId) {
    // Redis first, then memory: either copy belongs to this user+org wins.
    const fromRedis = await withTimeout(async (c) => {
      const raw = await c.get(KEY_PREFIX + sessionId);
      return raw ? (JSON.parse(raw) as MicaSession) : null;
    });
    if (fromRedis) {
      const ok = restore(fromRedis);
      if (ok) {
        sessions.set(sessionId, ok); // warm the local cache
        return ok;
      }
    } else {
      const local = restore(sessions.get(sessionId) ?? null);
      if (local) return local;
    }
    // Supplied but invalid/foreign/expired: fall through to a fresh session.
  }
  const fresh: MicaSession = {
    sessionId: newSessionId(),
    organizationId,
    userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turns: [],
  };
  sessions.set(fresh.sessionId, fresh);
  return fresh;
}

/**
 * Appends a completed turn, trims history to MAX_TURNS and persists the
 * snapshot with a sliding TTL. Resolution order: Redis write when available
 * (authoritative across instances), then the in-process map. The in-process
 * copy is updated regardless so a Redis blip mid-conversation still resolves
 * *this* worker's next turn from memory.
 *
 * `pendingPage` is the page this turn offered to open, and every call replaces
 * whatever the previous turn offered — including with nothing. That is what keeps
 * an offer answerable only by the sentence straight after it: the carer who hears
 * "want me to open the rota?" and then asks something else is not one "yes" away
 * from being taken there.
 */
export async function recordTurn(
  session: MicaSession,
  question: string,
  answer: string,
  pendingPage?: MicaPendingPage,
): Promise<void> {
  session.turns.push({ question, answer, at: Date.now() });
  session.updatedAt = Date.now();
  if (session.turns.length > MAX_TURNS) {
    session.turns.splice(0, session.turns.length - MAX_TURNS);
  }
  session.pendingPage = pendingPage;
  await persist(session);
}

/**
 * Remembers the page a *write* just produced, with no turn to record it with.
 *
 * A confirmed write is not a question and an answer — it is a save — so there is
 * nothing to append to the transcript, and inventing a turn for it would put a
 * sentence nobody said in front of the model on the next follow-up. What it does
 * share with an answered question is the offer that follows it in the reply, and
 * that offer has to be held somewhere for the carer's "yes" to resolve.
 *
 * Called with `undefined` when the record's page cannot be offered (a caller whose
 * role the router keeps out, or a write that produced no record). That is not a
 * no-op: the write is the next thing said in this conversation, so it retires
 * whatever was offered before it. A carer who heard "want me to open the rota
 * planner?", asked instead for a task to be added, and then said "yes" is not one
 * word away from being taken to a page they stopped talking about.
 */
export async function setPendingPage(
  session: MicaSession,
  pendingPage?: MicaPendingPage,
): Promise<void> {
  session.pendingPage = pendingPage;
  session.updatedAt = Date.now();
  await persist(session);
}

/**
 * Writes the snapshot: the in-process copy first (so *this* worker's next turn
 * resolves from memory even if Redis is gone), then Redis when available.
 */
async function persist(session: MicaSession): Promise<void> {
  sessions.set(session.sessionId, session);
  await withTimeout((c) =>
    c.set(KEY_PREFIX + session.sessionId, JSON.stringify(session), {
      PX: TTL_MS,
    }),
  );
}

/**
 * Builds the message history for the model: system prompt, prior turns as
 * user/assistant pairs, then the new question. Returns the count of prior
 * turns included so the caller can log/audit it.
 */
export function buildFollowUpMessages(
  session: MicaSession,
  systemPrompt: string,
  question: string,
): { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; priorTurns: number } {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  for (const turn of session.turns) {
    messages.push({ role: 'user', content: turn.question });
    messages.push({ role: 'assistant', content: turn.answer });
  }
  messages.push({ role: 'user', content: question });
  return { messages, priorTurns: session.turns.length };
}

/** Test/ops hook: number of live sessions in this process. */
export function sessionCount(): number {
  return sessions.size;
}
