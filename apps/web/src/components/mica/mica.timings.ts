/**
 * Mica's voice-pipeline timings — the eight stages between a tap and a resting orb.
 *
 * ## Why this exists
 *
 * `docs/mica-performance-audit.md` ends with an honest gap: *"No microphone →
 * speech → reply → playback timing breakdown. Those stages now fail independently
 * …, but the timings themselves were not measured on a device."* Every
 * optimisation in that document was justified by mechanism and by harness numbers,
 * both of which are the wrong instrument for the one question a user actually
 * feels: **how long is this thing making me wait?** A microphone that takes two
 * seconds to open on a locked-down Android, a recogniser that sits on a final
 * result, a cold `/ai/mica/ask`, a TTS round trip — those are device facts, and
 * the only way to see them is to instrument the pipeline and read the numbers off
 * the device you are holding.
 *
 * So this module records when each stage of the pipeline actually happened, and
 * `MicaTimingsPanel` draws the result on the screen. Nothing here measures
 * *quality* of the reply; it measures the wait.
 *
 * ## The eight stages
 *
 * | Stage | The moment | Where it is marked |
 * | --- | --- | --- |
 * | `tap` | The orb was pressed — the origin of the turn | `startListening` |
 * | `listening` | The session is live and listening; the UI has acknowledged the tap | the state entry for `listening` |
 * | `micReady` | A real microphone stream is open and feeding the orb | after the meter opens, in `startListening` |
 * | `speechDone` | The recogniser returned a final transcript — the sentence is over | `rec.onend`, before dispatch |
 * | `replyStarted` | Mica began producing an answer | the `thinking` entry in each reply path |
 * | `firstToken` | The first reply content existed and was about to be spoken | `reply()` / `fail()` |
 * | `done` | The reply finished playing | the TTS completion path in `speak` |
 * | `idle` | The session closed | the state entry for `idle` |
 *
 * ### `firstToken` is not a token, and that is deliberate
 *
 * The name is kept because it is the stage people mean, but **`/ai/mica/ask` is a
 * single request and response** — verified: no `EventSource`, no
 * `text/event-stream`, no `ReadableStream` anywhere in `apps/web/src` or in
 * `apps/api/src/modules/ai`. There is no token stream to time. So `firstToken`
 * marks the first moment reply content existed, which for a non-streamed endpoint
 * is when the response arrived. If streaming is ever added, this mark moves to the
 * first delta and every consumer of these numbers keeps working — the stage name
 * already describes that event, it just has a coarser meaning today. Do not read
 * `replyStarted → firstToken` as "time to first token" in the streaming sense
 * without checking that assumption first.
 *
 * ## What it deliberately is not
 *
 * - **Not React state.** Like the amplitude channel (`mica.audio.ts`), this is
 *   written by the pipeline and read by whoever is looking. Eight marks per turn
 *   must never cause a render of the assistant — that is the defect the audio
 *   channel exists to remove, and a recorder that re-rendered would reintroduce it
 *   on a different trigger. Consumers `subscribe` and draw.
 * - **Not a network. Nothing leaves the device.** There is no analytics endpoint,
 *   no beacon, no `fetch`. The numbers are in memory, on the phone, and the only
 *   way out is the console handle or the visible panel. That matters because the
 *   surrounding pipeline carries health data; a timing module that phoned home
 *   would be a new processor in a privacy-sensitive path for no benefit.
 * - **Not a fallback for a missing stage.** A stage that never fired is reported as
 *   *absent*, never as zero or as an interpolation. `micaTimingRows` skips it and
 *   `micaTimingSpans` returns `null`. A turn where the microphone never opened must
 *   not read as a turn where it opened instantly.
 */

/** The stages, in the order they occur. This order is what the panel draws. */
export const MICA_TIMING_STAGES = [
  'tap',
  'listening',
  'micReady',
  'speechDone',
  'replyStarted',
  'firstToken',
  'done',
  'idle',
] as const

export type MicaTimingStage = (typeof MICA_TIMING_STAGES)[number]

/** The words the panel and the console use. These are the stage names as spoken. */
export const MICA_TIMING_LABEL: Record<MicaTimingStage, string> = {
  tap: 'Tap',
  listening: 'Listening',
  micReady: 'Mic ready',
  speechDone: 'Speech done',
  replyStarted: 'Reply started',
  firstToken: 'First token',
  done: 'Done',
  idle: 'Idle',
}

/**
 * One turn through the pipeline.
 *
 * `offsets` holds **milliseconds after the turn began**, and only for the stages
 * that actually fired — so `{}`-ish turns are normal and are meant to be read as
 * "this did not happen", not "this took no time".
 */
export interface MicaTurnTiming {
  /** 1-based, counting sessions since the recorder was created. */
  session: number
  /** 1-based within the session. Turn 2+ is a continuation: the conversation resumed with no tap. */
  turn: number
  /** The stage that opened the turn: `tap` for a user-started turn, `listening` for a continuation. */
  openedBy: MicaTimingStage
  /** The clock reading at the origin, for debugging against the console's own timeline. */
  origin: number
  offsets: Partial<Record<MicaTimingStage, number>>
}

export interface MicaTimingsRecorder {
  /** Record that a stage happened. Idempotent per turn: the first occurrence wins. */
  mark(stage: MicaTimingStage): void
  /** Every turn held, oldest first. */
  turns(): readonly MicaTurnTiming[]
  /** The most recent turn, or `null` before the first mark. */
  last(): MicaTurnTiming | null
  /**
   * The current session's turns read as one turn — the headline measurement.
   *
   * See `micaSessionTiming`, which explains why this is not the same thing as
   * `last()` once the conversation continues. The readout shows this one.
   */
  session(): MicaTurnTiming | null
  /** Forget every turn. The numbers after this describe only what follows. */
  reset(): void
  /** Called on every mark. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

/** A row as the panel draws it: one stage, its offset, and its gap from the previous stage. */
export interface MicaTimingRow {
  stage: MicaTimingStage
  label: string
  /** Milliseconds after the turn's origin. */
  atMs: number
  /** Milliseconds since the previous stage that fired, or `null` for the first row. */
  gapMs: number | null
}

/**
 * The spans worth reading together, derived rather than stored.
 *
 * Each is `null` when either end is missing, and `tap*` spans are `null` on a
 * continuation turn — there was no tap. That is the honest answer, and it is why
 * these are computed here instead of being written as marks: a stored span would
 * have to invent a value for a turn that had no tap.
 */
export interface MicaTimingSpans {
  turn: number
  session: number
  /** Tap to the UI acknowledging it. Should be ~0: the state changes on the press. */
  tapToListening: number | null
  /** Tap to a real microphone stream. This is the permission dialog plus `getUserMedia`. */
  tapToMicReady: number | null
  /** Tap to the end of the spoken sentence — the carer's own speaking time, plus VAD. */
  tapToSpeechDone: number | null
  /** Sentence end to Mica starting an answer. The turn dispatcher's own cost. */
  speechDoneToReplyStarted: number | null
  /** Answer started to content in hand. On this pipeline it is the whole round trip. */
  replyStartedToFirstToken: number | null
  /** **The number a user feels first**: tap to the first thing Mica can say. */
  tapToFirstToken: number | null
  /** Content to the end of the spoken reply. The TTS round trip plus playback. */
  firstTokenToDone: number | null
  /** Tap to the reply having finished playing. */
  tapToDone: number | null
  /** Tap to the session closing. Only the session's final turn has this. */
  tapToIdle: number | null
}

/** How many turns are kept. A session's turns are the interesting ones; older ones only blur the signal. */
const HISTORY_LIMIT = 20

/**
 * Create a recorder.
 *
 * `now` and `limit` are injectable so the numbers can be pinned in a test; in the
 * app both are left alone. `now` must be monotonic — `performance.now()` is used
 * rather than `Date.now()` precisely because a wall-clock adjustment mid-turn
 * would produce a negative gap.
 */
export function createMicaTimings(options: { now?: () => number; limit?: number } = {}): MicaTimingsRecorder {
  const now = options.now ?? (() => performance.now())
  const limit = options.limit ?? HISTORY_LIMIT

  const turns: MicaTurnTiming[] = []
  const listeners = new Set<() => void>()
  let current: MicaTurnTiming | null = null
  /** A turn is closed by `done`; the next stage opens a new one. `idle` still attaches to it. */
  let closed = false
  let session = 0
  let turnInSession = 0

  const notify = () => {
    for (const listener of listeners) listener()
  }

  function startTurn(stage: MicaTimingStage) {
    if (stage === 'tap') {
      session += 1
      turnInSession = 0
    }
    turnInSession += 1
    current = {
      // A continuation with no session yet is still session 1: the numbers should
      // read as a session, not as turn 1 of session 0.
      session: Math.max(1, session),
      turn: turnInSession,
      openedBy: stage,
      origin: now(),
      offsets: { [stage]: 0 },
    }
    closed = stage === 'done'
    turns.push(current)
    if (turns.length > limit) turns.shift()
  }

  function mark(stage: MicaTimingStage) {
    if (stage === 'tap') {
      startTurn('tap')
      notify()
      return
    }

    // `idle` belongs to the turn that just finished rather than to a new one: it
    // is the session closing, and the session's length is the sum of its turns.
    if (stage === 'idle') {
      // With no turn in progress there is nothing to close. This is reachable:
      // `MicaProvider` dismisses its notice with `setState('idle')`, and a tap that
      // never opened a session (an unsupported browser, a refused microphone) would
      // otherwise appear as a turn that did nothing — a phantom reading in the panel
      // on exactly the device whose failure someone is trying to diagnose.
      if (!current) return
      if (current.offsets.idle === undefined) {
        current.offsets.idle = now() - current.origin
        closed = true
        notify()
      }
      return
    }

    if (!current || closed) {
      startTurn(stage)
      notify()
      return
    }

    if (current.offsets[stage] === undefined) {
      current.offsets[stage] = now() - current.origin
      if (stage === 'done') closed = true
      notify()
    }
  }

  return {
    mark,
    turns: () => turns,
    last: () => turns[turns.length - 1] ?? null,
    session: () => micaSessionTiming(turns),
    reset: () => {
      turns.length = 0
      current = null
      closed = false
      session = 0
      turnInSession = 0
      notify()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * The current session's turns read as one turn: the headline measurement.
 *
 * ## Why this exists at all
 *
 * A reply does not end a Mica session — it reopens the microphone (`finishTurn`
 * calls back into `beginRecognition`). That resumption is a real turn with its own
 * origin, so the taps, marks and spans above are right per turn… and the turn the
 * readout is watching moves on one beat after the reply ends. The carer taps,
 * speaks, reads `Tap → first token 1830ms`, and the panel immediately replaces it
 * with a continuation turn that has no tap in it and therefore reads `—` for every
 * span they were looking at. A measurement that erases itself is worse than none.
 *
 * So the session is also readable as one timeline: the turn that opened it, with
 * the stages of the turns that followed merged onto its origin.
 *
 * ## First occurrence wins, and only `idle` is taken from the end
 *
 * A `firstToken` merged from a later turn would silently turn `tapToFirstToken`
 * into "tap to the *latest* reply", a number that grows every time the carer says
 * something else and means nothing. So a stage keeps the value from the first turn
 * that reached it — which is the tap turn for everything up to `done` — and the
 * spans stay true to the turn that started the session. `idle` is the exception,
 * because the session closes once and it closes at the end, so it is taken from
 * whichever turn carried it.
 *
 * ## What it costs
 *
 * A second sentence in the same session has its own `replyStarted`/`firstToken`,
 * and this view does not show them — `turns()` and `console.table()` do. That is
 * the trade: one honest headline per session, plus every turn's own numbers for
 * whoever wants to read them. The `turn` field is the number of the tap turn; the
 * session's turn count is `turns().length`.
 */
export function micaSessionTiming(turns: readonly MicaTurnTiming[]): MicaTurnTiming | null {
  const latest = turns[turns.length - 1]
  if (!latest) return null

  const inSession = turns.filter(turn => turn.session === latest.session)
  const first = inSession[0]
  if (!first) return null

  const offsets: Partial<Record<MicaTimingStage, number>> = {}
  for (const turn of inSession) {
    // A later turn's offsets are measured from its own origin, so they are moved
    // onto the session's tap before they are merged — the spans that subtract two
    // stages from different turns are otherwise nonsense.
    const shift = turn.origin - first.origin
    for (const stage of MICA_TIMING_STAGES) {
      const at = turn.offsets[stage]
      if (at === undefined) continue
      if (stage === 'idle' || offsets[stage] === undefined) offsets[stage] = at + shift
    }
  }

  return {
    session: first.session,
    turn: first.turn,
    openedBy: first.openedBy,
    origin: first.origin,
    offsets,
  }
}

/** The stages that fired, in pipeline order, with each one's gap from the last. */
export function micaTimingRows(turn: MicaTurnTiming | null | undefined): MicaTimingRow[] {
  if (!turn) return []
  const rows: MicaTimingRow[] = []
  let previous: number | null = null
  for (const stage of MICA_TIMING_STAGES) {
    const atMs = turn.offsets[stage]
    if (atMs === undefined) continue
    rows.push({
      stage,
      label: MICA_TIMING_LABEL[stage],
      atMs,
      gapMs: previous === null ? null : atMs - previous,
    })
    previous = atMs
  }
  return rows
}

/** The named spans for a turn. See `MicaTimingSpans` for what each one means. */
export function micaTimingSpans(turn: MicaTurnTiming | null | undefined): MicaTimingSpans {
  const at = (stage: MicaTimingStage) => turn?.offsets[stage]
  const span = (from: MicaTimingStage, to: MicaTimingStage): number | null => {
    const a = at(from)
    const b = at(to)
    return a === undefined || b === undefined ? null : b - a
  }

  return {
    session: turn?.session ?? 0,
    turn: turn?.turn ?? 0,
    tapToListening: span('tap', 'listening'),
    tapToMicReady: span('tap', 'micReady'),
    tapToSpeechDone: span('tap', 'speechDone'),
    speechDoneToReplyStarted: span('speechDone', 'replyStarted'),
    replyStartedToFirstToken: span('replyStarted', 'firstToken'),
    tapToFirstToken: span('tap', 'firstToken'),
    firstTokenToDone: span('firstToken', 'done'),
    tapToDone: span('tap', 'done'),
    tapToIdle: span('tap', 'idle'),
  }
}

/** `—` for an absent stage. Used by the panel and the text export so they agree. */
export const formatTimingMs = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Math.round(value)}ms`

/**
 * A turn as plain text, for pasting a device measurement into an issue or a doc.
 *
 * Deliberately the same shape the panel draws, so a screenshot and a paste cannot
 * tell two different stories about the same turn.
 */
export function formatMicaTurn(turn: MicaTurnTiming | null | undefined): string {
  if (!turn) return 'No Mica turn recorded yet.'
  const spans = micaTimingSpans(turn)
  const lines = [
    `Mica turn ${turn.turn} of session ${turn.session} (opened by ${MICA_TIMING_LABEL[turn.openedBy]})`,
    '',
    ...micaTimingRows(turn).map(row =>
      `  ${row.label.padEnd(14)} ${formatTimingMs(row.atMs).padStart(7)}   (+${formatTimingMs(row.gapMs)})`,
    ),
    '',
    `  Tap → first token   ${formatTimingMs(spans.tapToFirstToken)}`,
    `  Tap → done          ${formatTimingMs(spans.tapToDone)}`,
    `  Tap → idle          ${formatTimingMs(spans.tapToIdle)}`,
  ]
  return lines.join('\n')
}

/* ─── Turning it on, and getting the numbers out ──────────────────────── */

export const MICA_TIMINGS_STORAGE_KEY = 'mica.timings'
export const MICA_TIMINGS_QUERY_KEY = 'micaTimings'

/**
 * Is the on-screen readout switched on?
 *
 * **Why `localStorage` rather than a query string.** A query string is the obvious
 * switch, and on a phone it is the one you can actually type — but Mica *navigates*:
 * when a reply carries a destination, `MicaProvider` pushes a route, and the query
 * string is gone with it. A panel that vanishes the first time Mica does its job is
 * worse than no panel. So the query string is the way in, and it writes the flag to
 * `localStorage`, which survives the navigation.
 *
 * Storage access is wrapped because private-mode browsers throw on it, and a
 * measurement tool that breaks the app it measures is not worth having.
 */
export function readMicaTimingsEnabled(): boolean {
  try {
    return window.localStorage.getItem(MICA_TIMINGS_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Apply the `?micaTimings=` query string, if present, to the stored flag.
 *
 * Returns the new state, or `null` when the query string says nothing — so the
 * caller can tell "the URL turned it on" from "the URL was silent" and leave the
 * stored flag alone in the second case. `?micaTimings=0` turns it off, which is
 * how you get rid of the panel without opening a console on a phone.
 */
export function applyMicaTimingsQuery(search: string): boolean | null {
  let value: string | null
  try {
    value = new URLSearchParams(search).get(MICA_TIMINGS_QUERY_KEY)
  } catch {
    return null
  }
  if (value === null) return null

  const enabled = value !== '0' && value !== 'false'
  try {
    if (enabled) window.localStorage.setItem(MICA_TIMINGS_STORAGE_KEY, '1')
    else window.localStorage.removeItem(MICA_TIMINGS_STORAGE_KEY)
  } catch {
    // Storage unavailable: still report the URL's intent, so this visit is instrumented.
  }
  return enabled
}

/** The console handle, `window.__micaTimings`. */
export interface MicaTimingsHandle {
  /** The stage order, for anyone typing against it. */
  stages: readonly MicaTimingStage[]
  /** Every turn held. */
  turns(): readonly MicaTurnTiming[]
  /** The most recent turn — the continuations included, one per turn. */
  last(): MicaTurnTiming | null
  /** The current session as one turn — what `rows`/`spans`/`text` report. */
  session(): MicaTurnTiming | null
  /** The session as rows — the same rows the panel draws. */
  rows(): MicaTimingRow[]
  /** The named spans for the session. */
  spans(): MicaTimingSpans
  /** The session as text, for pasting into a report. */
  text(): string
  /** `console.table` of every turn held. */
  table(): void
  /** Forget everything held. */
  reset(): void
  /** The readout's current state, independent of the panel being mounted. */
  panel: boolean
}

/**
 * Install `window.__micaTimings` and return the uninstaller.
 *
 * Installed **always**, not only when the panel is on. The number you want is the
 * one from the tap that felt slow, and a switch you have to set *before* noticing
 * is a switch you did not set. It exposes nothing but timings — no transcript, no
 * reply, no identifiers — so leaving it available costs nothing and is the
 * difference between "we think the recogniser is slow" and a number.
 */
export function installMicaTimingsHandle(
  recorder: MicaTimingsRecorder,
  options: { panel: boolean },
): () => void {
  const handle: MicaTimingsHandle = {
    stages: MICA_TIMING_STAGES,
    turns: () => recorder.turns(),
    last: () => recorder.last(),
    session: () => recorder.session(),
    // The headline is the session, not the latest continuation: `text()` is what
    // gets pasted into a report, and it has to be the eight stages of the turn the
    // person actually started. `turns()` and `table()` have the per-turn view.
    rows: () => micaTimingRows(recorder.session()),
    spans: () => micaTimingSpans(recorder.session()),
    text: () => formatMicaTurn(recorder.session()),
    table: () => {
      const rows = recorder.turns().map(turn => ({
        session: turn.session,
        turn: turn.turn,
        openedBy: turn.openedBy,
        ...turn.offsets,
      }))
      console.table(rows)
    },
    reset: () => recorder.reset(),
    panel: options.panel,
  }

  const scope = window as unknown as { __micaTimings?: MicaTimingsHandle }
  scope.__micaTimings = handle

  return () => {
    // Only remove our own handle: a second provider mounting during a route change
    // must not delete the handle the live session just installed.
    if (scope.__micaTimings === handle) delete scope.__micaTimings
  }
}
