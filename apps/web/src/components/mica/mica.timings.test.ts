/**
 * The recorder's contract.
 *
 * ## What is worth pinning here
 *
 * The numbers are read by a human deciding whether Mica feels slow, so the things
 * that must not be got wrong are the ones that would mislead that human:
 *
 * 1. **A stage that did not fire is absent, not zero.** A microphone that never
 *    opened must not appear as an instant one — that turns the worst case into the
 *    best case, and it is the single most damaging thing this module could do.
 * 2. **Turn boundaries are real.** `done` ends a turn; `idle` belongs to the turn
 *    that just finished; a continuation turn has no `tap` and therefore no `tap*`
 *    span. Getting this wrong would silently attribute turn 2's latency to turn 1.
 * 3. **`tap → listening` is zero.** The performance audit's whole ordering fix was
 *    that the state changes on the press, before the permission probe. If that
 *    regresses, this number is where it shows.
 *
 * The clock is injected so every expected value below is exact rather than
 * "greater than something".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MICA_TIMING_LABEL,
  MICA_TIMING_STAGES,
  MICA_TIMINGS_STORAGE_KEY,
  applyMicaTimingsQuery,
  createMicaTimings,
  formatMicaTurn,
  formatTimingMs,
  installMicaTimingsHandle,
  micaSessionTiming,
  micaTimingRows,
  micaTimingSpans,
  readMicaTimingsEnabled,
} from './mica.timings'

/** A clock the test moves by hand, so an expected gap is an exact number. */
function makeClock() {
  let t = 1000
  return {
    now: () => t,
    advance: (ms: number) => { t += ms },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  try { window.localStorage.removeItem(MICA_TIMINGS_STORAGE_KEY) } catch { /* ignore */ }
  delete (window as unknown as { __micaTimings?: unknown }).__micaTimings
})

describe('Mica timing vocabulary', () => {
  it('is the eight stages, in pipeline order', () => {
    expect(MICA_TIMING_STAGES).toEqual([
      'tap', 'listening', 'micReady', 'speechDone', 'replyStarted', 'firstToken', 'done', 'idle',
    ])
  })

  it('names every stage, using the words the panel shows', () => {
    expect(MICA_TIMING_STAGES.map(s => MICA_TIMING_LABEL[s])).toEqual([
      'Tap', 'Listening', 'Mic ready', 'Speech done', 'Reply started', 'First token', 'Done', 'Idle',
    ])
  })
})

describe('createMicaTimings', () => {
  it('records a full turn as offsets from the tap, in order', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('listening')
    clock.advance(40)
    recorder.mark('micReady')
    clock.advance(260)
    recorder.mark('speechDone')
    clock.advance(5)
    recorder.mark('replyStarted')
    clock.advance(300)
    recorder.mark('firstToken')
    clock.advance(1400)
    recorder.mark('done')
    clock.advance(2)
    recorder.mark('idle')

    expect(recorder.last()).toEqual({
      session: 1,
      turn: 1,
      openedBy: 'tap',
      origin: 1000,
      offsets: {
        tap: 0,
        listening: 0,
        micReady: 40,
        speechDone: 300,
        replyStarted: 305,
        firstToken: 605,
        done: 2005,
        idle: 2007,
      },
    })
  })

  it('reports a stage that never fired as absent, never as zero', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    // The tap happened, the microphone never opened, the session closed.
    recorder.mark('tap')
    clock.advance(6000)
    recorder.mark('idle')

    const turn = recorder.last()!
    expect(turn.offsets).toEqual({ tap: 0, idle: 6000 })
    expect(turn.offsets.micReady).toBeUndefined()
    expect(turn.offsets.firstToken).toBeUndefined()

    // The rows skip it entirely, and the spans that need it are null.
    expect(micaTimingRows(turn).map(r => r.stage)).toEqual(['tap', 'idle'])
    expect(micaTimingSpans(turn).tapToMicReady).toBeNull()
    expect(micaTimingSpans(turn).tapToFirstToken).toBeNull()
    // What *can* be known still is.
    expect(micaTimingSpans(turn).tapToIdle).toBe(6000)
  })

  it('keeps the first occurrence of a stage and ignores a repeat', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('listening')
    clock.advance(150)
    // `startListening` and `beginRecognition` both enter `listening` in one turn.
    recorder.mark('listening')

    expect(recorder.last()!.offsets.listening).toBe(0)
    expect(recorder.last()!.turn).toBe(1)
  })

  it('keeps the tap → listening gap at zero, because the state changes on the press', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('listening')
    // The permission dialog takes as long as the person takes; none of it may be
    // attributed to the acknowledgement, which happened before the probe.
    clock.advance(9000)
    recorder.mark('micReady')

    expect(micaTimingSpans(recorder.last()).tapToListening).toBe(0)
    expect(micaTimingSpans(recorder.last()).tapToMicReady).toBe(9000)
  })

  it('ends the turn at `done` and opens a continuation turn on the next listen', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('listening')
    recorder.mark('speechDone')
    recorder.mark('replyStarted')
    recorder.mark('firstToken')
    recorder.mark('done')

    // The conversation continues: `finishTurn` reopens the recogniser with no tap.
    clock.advance(100)
    recorder.mark('listening')
    clock.advance(50)
    recorder.mark('speechDone')

    const [first, second] = recorder.turns()
    expect(first.turn).toBe(1)
    expect(second.turn).toBe(2)
    expect(second.openedBy).toBe('listening')
    expect(second.offsets).toEqual({ listening: 0, speechDone: 50 })
    // A continuation had no tap, so the tap-anchored spans are honestly null.
    const spans = micaTimingSpans(second)
    expect(spans.tapToFirstToken).toBeNull()
    expect(spans.tapToListening).toBeNull()
  })

  it('attaches `idle` to the turn that finished rather than opening a new one', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('listening')
    recorder.mark('done')
    clock.advance(30)
    recorder.mark('idle')

    expect(recorder.turns()).toHaveLength(1)
    const turn = recorder.last()!
    expect(turn.openedBy).toBe('tap')
    expect(turn.offsets.idle).toBe(30)
    // `done` closed the turn at 0; `idle` still belongs to it.
    expect(turn.offsets.done).toBe(0)
  })

  it('starts a new session on a new tap and restarts turn numbering', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('done')
    recorder.mark('idle')
    clock.advance(5000)
    recorder.mark('tap')
    recorder.mark('done')

    const turns = recorder.turns()
    expect(turns.map(t => [t.session, t.turn])).toEqual([[1, 1], [2, 1]])
    expect(turns[1].offsets.done).toBe(0)
  })

  it('holds only the most recent turns, so old noise cannot blur the signal', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now, limit: 3 })

    for (let i = 0; i < 5; i++) {
      recorder.mark('tap')
      recorder.mark('done')
      clock.advance(10)
    }

    const turns = recorder.turns()
    expect(turns).toHaveLength(3)
    expect(turns.map(t => t.session)).toEqual([3, 4, 5])
  })

  it('opens a turn on a continuation mark even with nothing before it', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    // No tap was ever recorded — the hook can only do this if it mounted mid-session.
    recorder.mark('listening')
    expect(recorder.last()).toMatchObject({ session: 1, turn: 1, openedBy: 'listening' })
  })

  it('notifies subscribers on every mark, and stops when unsubscribed', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    const listener = vi.fn()

    const unsubscribe = recorder.subscribe(listener)
    recorder.mark('tap')
    expect(listener).toHaveBeenCalledTimes(1)
    // A second tap is a *new* turn, so it is worth a notification.
    recorder.mark('tap')
    expect(listener).toHaveBeenCalledTimes(2)

    recorder.mark('listening')
    // The same stage twice inside one turn changes nothing, so it is not a notification.
    recorder.mark('listening')
    expect(listener).toHaveBeenCalledTimes(3)

    unsubscribe()
    recorder.mark('done')
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('forgets everything on reset', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    expect(recorder.last()).not.toBeNull()
    recorder.reset()
    expect(recorder.turns()).toEqual([])
    expect(recorder.last()).toBeNull()
  })

  it('returns the most recent turn from last() and the whole history from turns()', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('tap')
    recorder.mark('done')
    clock.advance(5)
    recorder.mark('tap')

    expect(recorder.turns()).toHaveLength(2)
    expect(recorder.last()).toBe(recorder.turns()[1])
  })
})

describe('rows and spans', () => {
  it('gives the first row no gap and each later row the gap from the one before it', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    clock.advance(10)
    recorder.mark('micReady')
    clock.advance(90)
    recorder.mark('speechDone')

    expect(micaTimingRows(recorder.last())).toEqual([
      { stage: 'tap', label: 'Tap', atMs: 0, gapMs: null },
      { stage: 'micReady', label: 'Mic ready', atMs: 10, gapMs: 10 },
      { stage: 'speechDone', label: 'Speech done', atMs: 100, gapMs: 90 },
    ])
  })

  it('measures the gap between the two stages that fired, skipping the absent ones', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    recorder.mark('speechDone')
    // No `replyStarted`: the dispatcher failed before it began a reply.
    clock.advance(200)
    recorder.mark('firstToken')

    const rows = micaTimingRows(recorder.last())
    expect(rows.map(r => r.stage)).toEqual(['tap', 'speechDone', 'firstToken'])
    expect(rows[2].gapMs).toBe(200)
    expect(micaTimingSpans(recorder.last()).speechDoneToReplyStarted).toBeNull()
    expect(micaTimingSpans(recorder.last()).tapToFirstToken).toBe(200)
  })

  it('handles no turn at all', () => {
    expect(micaTimingRows(null)).toEqual([])
    expect(micaTimingSpans(null).tapToDone).toBeNull()
    expect(micaTimingSpans(null)).toMatchObject({ session: 0, turn: 0 })
  })
})

describe('formatting', () => {
  it('renders an absent value as a dash, not as zero', () => {
    expect(formatTimingMs(null)).toBe('—')
    expect(formatTimingMs(undefined)).toBe('—')
    expect(formatTimingMs(0)).toBe('0ms')
    expect(formatTimingMs(1234.6)).toBe('1235ms')
  })

  it('describes a turn as text that matches what the panel draws', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    recorder.mark('listening')
    clock.advance(120)
    recorder.mark('speechDone')
    recorder.mark('replyStarted')
    clock.advance(400)
    recorder.mark('firstToken')
    clock.advance(900)
    recorder.mark('done')
    recorder.mark('idle')

    // Normalised, so the assertion is about the numbers rather than the column
    // widths — the padding is there to be read by a person, not to be pinned.
    const flat = formatMicaTurn(recorder.last()).replace(/\s+/g, ' ')
    expect(flat).toContain('Mica turn 1 of session 1 (opened by Tap)')
    expect(flat).toContain('Tap 0ms')
    expect(flat).toContain('Speech done 120ms')
    expect(flat).toContain('Tap → first token 520ms')
    expect(flat).toContain('Tap → done 1420ms')
    expect(flat).toContain('Tap → idle 1420ms')
  })

  it('says so plainly when there is nothing recorded', () => {
    expect(formatMicaTurn(null)).toBe('No Mica turn recorded yet.')
  })
})

describe('switching the readout on', () => {
  it('is off unless the flag is set', () => {
    expect(readMicaTimingsEnabled()).toBe(false)
  })

  it('turns on from ?micaTimings=1 and remembers it across Mica\u2019s own navigation', () => {
    // A query string is lost when Mica pushes a route, which is why the flag is stored.
    expect(applyMicaTimingsQuery('?micaTimings=1')).toBe(true)
    expect(window.localStorage.getItem(MICA_TIMINGS_STORAGE_KEY)).toBe('1')
    expect(readMicaTimingsEnabled()).toBe(true)
  })

  it('turns off from ?micaTimings=0 and clears the stored flag', () => {
    applyMicaTimingsQuery('?micaTimings=1')
    expect(applyMicaTimingsQuery('?micaTimings=0')).toBe(false)
    expect(window.localStorage.getItem(MICA_TIMINGS_STORAGE_KEY)).toBeNull()
    expect(readMicaTimingsEnabled()).toBe(false)
  })

  it('says nothing when the query string is silent, leaving the stored flag alone', () => {
    applyMicaTimingsQuery('?micaTimings=1')
    expect(applyMicaTimingsQuery('?other=1')).toBeNull()
    expect(readMicaTimingsEnabled()).toBe(true)
  })

  it('treats a bare ?micaTimings as on', () => {
    expect(applyMicaTimingsQuery('?micaTimings')).toBe(true)
  })
})

describe('the console handle', () => {
  it('exposes the turns, the rows, the spans and the text', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    clock.advance(75)
    recorder.mark('done')

    const uninstall = installMicaTimingsHandle(recorder, { panel: false })
    const handle = (window as unknown as { __micaTimings: any }).__micaTimings

    expect(handle.stages).toEqual(MICA_TIMING_STAGES)
    expect(handle.turns()).toHaveLength(1)
    expect(handle.last().offsets.done).toBe(75)
    expect(handle.rows().map((r: { stage: string }) => r.stage)).toEqual(['tap', 'done'])
    expect(handle.spans().tapToDone).toBe(75)
    expect(handle.text()).toContain('Tap → done')
    expect(handle.panel).toBe(false)

    uninstall()
    expect((window as unknown as { __micaTimings?: unknown }).__micaTimings).toBeUndefined()
  })

  it('resets through the handle, and does not remove a handle it does not own', () => {
    const clock = makeClock()
    const first = createMicaTimings({ now: clock.now })
    const second = createMicaTimings({ now: clock.now })

    const uninstallFirst = installMicaTimingsHandle(first, { panel: true })
    installMicaTimingsHandle(second, { panel: false })

    first.mark('tap')
    const handle = (window as unknown as { __micaTimings: any }).__micaTimings
    expect(handle.panel).toBe(false) // the second install won
    handle.reset()
    expect(second.turns()).toEqual([])

    // Uninstalling the superseded handle must not delete the live one.
    uninstallFirst()
    expect((window as unknown as { __micaTimings?: unknown }).__micaTimings).toBe(handle)
  })

  it('prints a table without throwing', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    recorder.mark('done')
    const spy = vi.spyOn(console, 'table').mockImplementation(() => undefined)

    installMicaTimingsHandle(recorder, { panel: false })
    ;(window as unknown as { __micaTimings: any }).__micaTimings.table()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual([
      { session: 1, turn: 1, openedBy: 'tap', tap: 0, done: 0 },
    ])
  })
})

/**
 * The session view — what the panel and the handle actually report.
 *
 * A reply reopens the microphone, so the turn a moment after any answer has no
 * tap in it and no tap spans. Without the merge, the readout would replace the
 * numbers the carer's own tap produced with dashes one beat after the reply
 * finished. These tests pin what the merge keeps — and, just as importantly, what
 * it refuses to do: move `tap → first token` onto a later sentence's reply, which
 * would make the headline number grow every time the carer said something else.
 */
describe('micaSessionTiming', () => {
  it('reads the tap turn and the turns a reply reopened as one turn', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    recorder.mark('listening')
    clock.advance(700)
    recorder.mark('micReady')
    clock.advance(500)
    recorder.mark('speechDone')
    recorder.mark('replyStarted')
    clock.advance(400)
    recorder.mark('firstToken')
    clock.advance(1000)
    recorder.mark('done')
    // The reply reopens the microphone: a second turn, and one with no tap.
    recorder.mark('listening')
    clock.advance(1000)
    recorder.mark('idle')

    expect(recorder.turns()).toHaveLength(2)
    expect(recorder.last()?.openedBy).toBe('listening')
    expect(micaTimingSpans(recorder.last()).tapToFirstToken).toBeNull()

    // The session is the eight stages of the turn that was actually started.
    const session = recorder.session()
    expect(micaTimingRows(session).map(row => row.stage)).toEqual([...MICA_TIMING_STAGES])
    expect(micaTimingRows(session).map(row => row.atMs)).toEqual([0, 0, 700, 1200, 1200, 1600, 2600, 3600])
    expect(micaTimingSpans(session).tapToFirstToken).toBe(1600)
    expect(micaTimingSpans(session).tapToDone).toBe(2600)
    // `idle` closed the session on the continuation, and still measures from the tap.
    expect(micaTimingSpans(session).tapToIdle).toBe(3600)
  })

  it('keeps the tap turn’s numbers instead of a later reply’s', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    clock.advance(100)
    recorder.mark('firstToken')
    clock.advance(100)
    recorder.mark('done')
    // A second sentence, in the turn the reply reopened.
    recorder.mark('listening')
    clock.advance(500)
    recorder.mark('speechDone')
    clock.advance(500)
    recorder.mark('firstToken')

    const session = recorder.session()
    // The headline stays the tap's: 100ms, not 1200ms. A `firstToken` taken from
    // the later turn would turn this into "tap to the latest reply", which grows
    // with every sentence and means nothing.
    expect(micaTimingSpans(session).tapToFirstToken).toBe(100)
    // The continuation's stages are still merged, shifted onto the tap's origin.
    expect(session?.offsets.speechDone).toBe(700)
    // And its own numbers remain readable, per turn.
    expect(recorder.last()?.offsets.firstToken).toBe(1000)
  })

  it('takes `idle` from whichever turn the session closed on', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    recorder.mark('done')

    // Still listening: the session has not closed, and that is not a zero.
    expect(recorder.session()?.offsets.idle).toBeUndefined()
    expect(micaTimingSpans(recorder.session()).tapToIdle).toBeNull()

    clock.advance(3000)
    recorder.mark('idle')
    expect(micaTimingSpans(recorder.session()).tapToIdle).toBe(3000)
  })

  it('starts a fresh session at the next tap', () => {
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })
    recorder.mark('tap')
    clock.advance(100)
    recorder.mark('done')
    clock.advance(100)
    recorder.mark('idle')

    clock.advance(5000)
    recorder.mark('tap')

    const session = recorder.session()
    expect(session?.session).toBe(2)
    // Only what the new session has reached — a later tap must not inherit the
    // previous session's `done` or `idle`.
    expect(session?.offsets).toEqual({ tap: 0 })
    expect(recorder.turns()).toHaveLength(2)
  })

  it('is null before the first mark', () => {
    expect(micaSessionTiming([])).toBeNull()
    const recorder = createMicaTimings({ now: () => 0 })
    expect(recorder.session()).toBeNull()
  })

  it('does not open a turn for an `idle` that has no session to close', () => {
    // A tap that never opened a session — an unsupported browser, a refused
    // microphone — is dismissed by `MicaProvider` with `setState('idle')`. That must
    // not read as a turn that did nothing, which is exactly what someone diagnosing
    // that device would be looking at.
    const clock = makeClock()
    const recorder = createMicaTimings({ now: clock.now })

    recorder.mark('idle')

    expect(recorder.turns()).toEqual([])
    expect(recorder.session()).toBeNull()
    expect(recorder.last()).toBeNull()
  })
})
