import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'
import { MICA_TIMING_LABEL, MICA_TIMING_STAGES, micaTimingSpans, type MicaTimingsHandle } from './mica.timings'

/**
 * A whole turn through the real pipeline: tap, microphone, speech, reply, playback,
 * close — with the eight stage timings read back at the end.
 *
 * ## Why this exists next to `mica.timings.test.ts`
 *
 * That file tests the recorder with hand-written marks: it proves the vocabulary,
 * the gaps, the ring buffer and the session merge behave. It cannot prove the
 * pipeline *calls* `mark` in the right places, which is the half that can be wrong
 * while every unit test stays green — a `speechDone` marked after dispatch instead
 * of before still produces a plausible-looking table.
 *
 * So this one drives the real `useMica` inside the real provider: the orb's click
 * handler, the permission probe, the recogniser's `onend`, the ask request, the TTS
 * fallback, the resumption, and the Escape that closes the session. Nothing is
 * stubbed but the browser APIs jsdom does not have — and the clock, which is what
 * makes the assertions exact rather than tolerant.
 *
 * ## The controlled clock
 *
 * `performance.now` is frozen and advanced by hand, so every stage has a known
 * offset and the test asserts the numbers the panel will show rather than "some
 * positive number". Two stages are deliberately marked in the same tick as the tap,
 * and they assert as `0`.
 *
 * ## The continuation is part of the test, not a detail
 *
 * A reply reopens the microphone, so a finished turn is followed by a turn with no
 * tap in it. That is asserted here explicitly (`turns()` is `[1, 2]`, and the
 * continuation's own spans have no tap to measure from) because it is the reason
 * the readout reports the *session* rather than the latest turn: without the merge
 * in `micaSessionTiming`, the numbers below would be replaced by dashes a beat
 * after the reply finished.
 */
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
  },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

class FakeRecognition {
  static last: FakeRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  // Inert on purpose: ending the utterance is the test's to control, and the VAD
  // timer that would normally call this cannot run deterministically under a
  // frozen clock.
  stop = vi.fn()
  constructor() { FakeRecognition.last = this }

  hear(text: string) {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] as unknown as ArrayLike<unknown> })
  }
}

const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] })

/** The clock the pipeline reads. Frozen until `advance` moves it. */
let clock = 0
const advance = (ms: number) => { clock += ms }

/** The first `getUserMedia` is the permission probe; every later one is the meter. */
let probeCalls = 0
let resolveProbe: (value: unknown) => void = () => undefined

let resolveAsk: ((value: unknown) => void) | null = null
let rejectTts: (() => void) | null = null

/**
 * jsdom has no AudioContext, and the meter needs one to report a real stream —
 * without it the run is refused and `micReady` never fires, which is one of the
 * stages this test exists to see.
 */
const stubAudioContext = () => {
  class FakeAnalyser {
    fftSize = 512
    frequencyBinCount = 256
    getByteFrequencyData = (data: Uint8Array) => data.fill(0)
  }
  class FakeAudioContext {
    createMediaStreamSource = () => ({ connect: vi.fn() })
    createAnalyser = () => new FakeAnalyser()
    // A real AudioContext closes asynchronously, and the tear-down awaits that.
    close = () => Promise.resolve()
  }
  Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
}

const setupVoiceStack = () => {
  probeCalls = 0
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn(() => {
        probeCalls += 1
        if (probeCalls === 1) return new Promise(resolve => { resolveProbe = resolve })
        return Promise.resolve(stream())
      }),
    },
    configurable: true,
  })
  class FakeUtterance {
    lang = ''
    rate = 1
    pitch = 1
    onstart: (() => void) | null = null
    onboundary: ((e: { charIndex: number }) => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(public text: string) {}
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      cancel: vi.fn(),
      // Speech finishes at once: this measures the pipeline, not the playback, and
      // `done` is asserted at the clock value the test chose for it.
      speak: (u: { onend?: (() => void) | null }) => { queueMicrotask(() => u.onend?.()) },
    },
    configurable: true,
  })
  stubAudioContext()
}

/** The ask is answered when the test says so; the TTS request fails the same way. */
const pendingAsk = () => {
  vi.mocked(api.post).mockImplementation((url: string) => {
    if (url === '/ai/mica/ask') {
      return new Promise(resolve => { resolveAsk = value => resolve(value as never) })
    }
    // /ai/tts: no audio comes back, which drops the reply to browser speech.
    return new Promise((_resolve, reject) => { rejectTts = () => reject(new Error('no tts')) })
  })
}

const handleOf = () => (window as unknown as { __micaTimings: MicaTimingsHandle }).__micaTimings

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <div>dashboard page</div>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

/**
 * The surfaces are lazy chunks (see `mica.surfaces.tsx`); a carer warms them with
 * intent, and a test's click fires none. Fetched once, so what the assertions wait
 * on is the pipeline and not a module load.
 */
beforeAll(async () => {
  await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar'), import('./MicaTimingsPanel')])
})

beforeEach(() => {
  clock = 0
  probeCalls = 0
  resolveAsk = null
  rejectTts = null
  FakeRecognition.last = null
  setupVoiceStack()
  pendingAsk()
  // The pipeline reads the clock through `performance.now`; shadowing the jsdom
  // method with a frozen one is what makes every offset below exact.
  Object.defineProperty(window.performance, 'now', { value: () => clock, configurable: true, writable: true })
  // The readout is off by default; these sessions are measured with it on, which is
  // the same state `?micaTimings=1` stores.
  window.localStorage.setItem('mica.timings', '1')
})

afterEach(() => {
  vi.clearAllMocks()
  delete (window.performance as unknown as { now?: unknown }).now
})

describe('Mica — the eight stage timings of one turn, end to end', () => {
  it('records tap, listening, mic ready, speech done, reply started, first token, done and idle', async () => {
    // A non-zero start, so an offset can never pass by being an absolute reading.
    clock = 1000
    renderShell()

    // ── The tap ────────────────────────────────────────────────────────
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // The session is live on the press, so the first two stages are already in and
    // both sit at the origin. The microphone is *not* ready — the browser is still
    // asking — and a stage that has not happened is absent rather than zero.
    const handle = handleOf()
    expect(handle.rows().map(row => row.stage)).toEqual(['tap', 'listening'])
    expect(handle.rows().map(row => row.atMs)).toEqual([0, 0])
    expect(handle.spans().tapToMicReady).toBeNull()
    expect(handle.spans().tapToFirstToken).toBeNull()

    // ── Permission answered, a real stream open ────────────────────────
    advance(700)
    await act(async () => {
      resolveProbe(stream())
      await Promise.resolve()
    })
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
    expect(handleOf().rows().find(row => row.stage === 'micReady')?.atMs).toBe(700)

    // ── The sentence ends ──────────────────────────────────────────────
    const rec = FakeRecognition.last as FakeRecognition
    advance(500)
    rec.hear('who is on shift today?')
    await waitFor(() => expect(screen.getByText('“who is on shift today?”')).toBeInTheDocument())
    await act(async () => { rec.onend?.() })

    // ── The reply ──────────────────────────────────────────────────────
    await waitFor(() => expect(resolveAsk).not.toBeNull())
    // `replyStarted` is marked when the request goes out, so it shares the tick that
    // ended the sentence — which is the point of the stage: the gap to it is the
    // dispatcher's own cost, and here there is none.
    expect(handleOf().spans().speechDoneToReplyStarted).toBe(0)

    advance(400)
    await act(async () => {
      resolveAsk?.({ data: { answer: 'Fatima Iqbal is on shift today.', sessionId: 's1' } })
      await Promise.resolve()
    })
    // Twice: the answer is drawn and announced (`aria-live`), so both are expected.
    expect((await screen.findAllByText('Fatima Iqbal is on shift today.')).length).toBeGreaterThan(0)
    expect(handleOf().spans().replyStartedToFirstToken).toBe(400)

    // ── Playback finishes ──────────────────────────────────────────────
    await waitFor(() => expect(rejectTts).not.toBeNull())
    advance(1000)
    await act(async () => { rejectTts?.() })
    await waitFor(() => expect(handleOf().rows().map(row => row.stage)).toContain('done'))

    // ── The carer ends the session ─────────────────────────────────────
    advance(1000)
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // ── What the pipeline recorded ─────────────────────────────────────
    expect(handle.session()).not.toBeNull()
    // All eight, once each, in the order they happen. This is the assertion the
    // feature exists for: no stage is missing and none is out of turn.
    expect(handle.rows().map(row => row.stage)).toEqual([...MICA_TIMING_STAGES])
    expect(handle.rows().map(row => row.atMs)).toEqual([0, 0, 700, 1200, 1200, 1600, 2600, 3600])
    // Each stage's gap from the one before it — the reading that says *where* the
    // wait was, rather than how long the whole thing took.
    expect(handle.rows().map(row => row.gapMs)).toEqual([null, 0, 700, 500, 0, 400, 1000, 1000])

    const spans = handle.spans()
    expect(spans.tapToListening).toBe(0)
    expect(spans.tapToMicReady).toBe(700)
    expect(spans.tapToSpeechDone).toBe(1200)
    expect(spans.speechDoneToReplyStarted).toBe(0)
    expect(spans.replyStartedToFirstToken).toBe(400)
    // The two a user actually feels: the tap to the first thing Mica can say, and
    // the tap to the reply having finished playing.
    expect(spans.tapToFirstToken).toBe(1600)
    expect(spans.firstTokenToDone).toBe(1000)
    expect(spans.tapToDone).toBe(2600)
    expect(spans.tapToIdle).toBe(3600)

    // ── The continuation, which is why the reading is a session ────────
    // Two turns: the one the tap opened, and the one the reply reopened. The latest
    // turn has no tap in it, so its tap spans are `null` — the honest answer, and
    // exactly the reading that would replace the numbers above in the panel if the
    // panel reported `last()`.
    expect(handle.turns().map(turn => turn.turn)).toEqual([1, 2])
    expect(handle.last()?.openedBy).toBe('listening')
    expect(micaTimingSpans(handle.last()).tapToFirstToken).toBeNull()
    expect(micaTimingSpans(handle.last()).speechDoneToReplyStarted).toBeNull()

    // The paste-able form tells the same story as the panel.
    const text = handle.text()
    for (const stage of MICA_TIMING_STAGES) expect(text).toContain(MICA_TIMING_LABEL[stage])
    expect(text).toContain('Tap → first token   1600ms')
    expect(text).toContain('Tap → done          2600ms')
    expect(text).toContain('Tap → idle          3600ms')
  })

  it('draws the same eight stages in the on-device readout', async () => {
    clock = 500
    renderShell()

    // Switched on for this session only (the same flag `?micaTimings=1` stores).
    const panel = await screen.findByRole('region', { name: 'Mica voice pipeline timings' })
    const scoped = within(panel)
    expect(scoped.getByText('no turn yet')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Live: every stage is drawn in pipeline order, the ones the pipeline has
    // reached carry a number, and the ones it has not read `—` rather than being
    // omitted — the missing stage is the finding.
    expect(scoped.getByText('Tap')).toBeInTheDocument()
    expect(scoped.getByText('Listening')).toBeInTheDocument()
    expect(scoped.getAllByText('—').length).toBeGreaterThan(0)
    expect(scoped.getByText('session 1 · 1 turn')).toBeInTheDocument()

    // Drive the rest of the turn: this test is about the readout drawing the marks,
    // not about re-measuring them.
    advance(700)
    await act(async () => {
      resolveProbe(stream())
      await Promise.resolve()
    })
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
    const rec = FakeRecognition.last as FakeRecognition
    rec.hear('who is on shift today?')
    await waitFor(() => expect(screen.getByText('“who is on shift today?”')).toBeInTheDocument())
    await act(async () => { rec.onend?.() })
    await waitFor(() => expect(resolveAsk).not.toBeNull())
    advance(400)
    await act(async () => {
      resolveAsk?.({ data: { answer: 'Fatima Iqbal is on shift today.' } })
      await Promise.resolve()
    })
    await waitFor(() => expect(rejectTts).not.toBeNull())
    await act(async () => { rejectTts?.() })
    await waitFor(() => expect(handleOf().rows().map(row => row.stage)).toContain('done'))
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }) })

    // With the whole session in, nothing is a dash any more: all eight stages
    // reached, all eight drawn with the recorded time and its gap.
    await waitFor(() => expect(scoped.queryByText('—')).toBeNull())
    // The headline spans the panel adds underneath, from the turn the tap opened.
    expect(scoped.getByText('Tap → first token')).toBeInTheDocument()
    expect(scoped.getAllByText('1100ms').length).toBeGreaterThan(0)
    // The reply reopened the microphone, so the readout is a session of two turns
    // and still shows the tap turn's numbers.
    expect(scoped.getByText('session 1 · 2 turns')).toBeInTheDocument()
  })

  it('leaves the readout out of the tree when it is not switched on', async () => {
    window.localStorage.removeItem('mica.timings')
    renderShell()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    })
    await screen.findByRole('dialog')

    // The handle is always installed — the tap that felt slow is not one you set a
    // flag for in advance — but the panel is a diagnostic overlay and stays out.
    expect(screen.queryByRole('region', { name: 'Mica voice pipeline timings' })).toBeNull()
    expect(handleOf().panel).toBe(false)
    expect(handleOf().stages).toEqual([...MICA_TIMING_STAGES])
  })
})
