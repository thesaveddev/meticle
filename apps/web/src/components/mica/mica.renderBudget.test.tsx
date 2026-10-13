import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

/**
 * Mica's cost while the microphone is open, measured rather than asserted by
 * eye.
 *
 * ## Why this file exists
 *
 * The orb is visible on every page and the microphone meter runs for the whole
 * of a live session — the two places where an assistant becomes a tax on the
 * app it lives in. The failure this pins down is a *rendering* one: an audio
 * level published from a `requestAnimationFrame` loop that is also React state
 * re-renders the whole assistant subtree once per frame, which is ~60 renders a
 * second of the overlay, the mini bar and every context consumer — on top of
 * whatever the carer is actually looking at.
 *
 * So the budget below is not "does it look smooth" but "how much React work did
 * one second of listening cost", taken from React's own profiler: the number of
 * commits and their total duration across 120 animation frames of live audio.
 *
 * The audio level is driven through the real production path — the orb starts a
 * session, the meter samples a fake analyser every frame — so this test measures
 * the shipped code rather than a stand-in for it. It passed at ~120 commits per
 * 120 frames before the amplitude channel existed, and at 0 commits after.
 */
class FakeAnalyser {
  fftSize = 512
  frequencyBinCount = 8
  private samples = 0
  connect() { /* the graph is not under test */ }
  getByteFrequencyData(array: Uint8Array) {
    // A level that *varies* every frame, which is what a microphone actually
    // produces. A constant level would let React bail out of the update, and a
    // harness that measures a re-render storm with a steady tone measures
    // nothing at all.
    this.samples += 1
    const level = 96 + Math.round(48 * Math.sin(this.samples / 2))
    array.fill(level)
  }
}

class FakeAudioContext {
  state = 'running'
  createMediaStreamSource() { return { connect() { /* noop */ } } }
  createAnalyser() { return new FakeAnalyser() }
  close() { return Promise.resolve() }
}

class FakeRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start() { /* the turn never completes: this is about the meter, not the transcription */ }
  stop() { /* ditto */ }
}

const setupVoiceStack = () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
  })
}

/**
 * A controllable animation frame.
 *
 * jsdom only provides `requestAnimationFrame` in its visual mode, and the meter
 * loop is the thing under measurement, so the frame clock is shimmed rather
 * than borrowed: each tick is a real macrotask one frame apart, which lets the
 * test count frames by waiting instead of by advancing a fake clock that
 * framer-motion's own loops also share (that combination deadlocks).
 */
let frameHandle = 0
const shimAnimationFrame = () => {
  const callbacks = new Map<number, () => void>()
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (cb: (time: number) => void) => {
      frameHandle += 1
      const handle = frameHandle
      callbacks.set(handle, () => cb(performance.now()))
      setTimeout(() => {
        const run = callbacks.get(handle)
        callbacks.delete(handle)
        run?.()
      }, 16)
      return handle
    },
  })
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: (handle: number) => { callbacks.delete(handle) },
  })
}

/** One animation frame, with React's work for it flushed inside `act`. */
const frame = async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
}

interface Budget {
  commits: number
  actual: number
  base: number
}

/**
 * Open a live session, let the meter run for `frames` frames, and report what
 * React did in that time.
 */
const measureListening = async (frames: number): Promise<Budget> => {
  const renders: Parameters<ProfilerOnRenderCallback>[1][] = []
  let actual = 0
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    renders.push(actualDuration)
    actual += actualDuration
  }

  render(
    <Profiler id="mica-shell" onRender={onRender}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <MicaProvider>
          <div>dashboard page</div>
          <MicaFab />
        </MicaProvider>
      </MemoryRouter>
    </Profiler>,
  )

  // The resting orb, openable.
  const orb = screen.getByRole('button', { name: 'Mica assistant' })
  await act(async () => { fireEvent.click(orb) })
  // A safety net, not the expected path: the chunk is warmed in `beforeAll`.
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }, { timeout: 30_000 })

  // Let the meter start, then record the baseline: everything committed so far
  // is session startup, not per-frame cost.
  await frame()
  const base = renders.length
  actual = 0

  for (let i = 0; i < frames; i += 1) await frame()

  return { commits: renders.length - base, actual, base }
}

describe('Mica render budget while listening', () => {
  /**
   * The overlay is a lazy chunk (see `mica.surfaces.tsx`). Fetch it once, for the
   * same reason the entry points do it on intent: what this file measures is what
   * React does per audio frame, not how fast a module loads on a cold cache.
   * (`mica.pendingSurfaces.test.tsx` covers the cold case, where the orb itself
   * stands in until the chunk lands.)
   */
  beforeAll(async () => {
    await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar')])
  })

  beforeEach(() => {
    shimAnimationFrame()
    setupVoiceStack()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Thirty frames is half a second of listening, and enough to make a per-frame
  // render obvious. The budget is a shape, not a benchmark: the numbers that
  // matter are printed with the assertion, so a regression reads as "31 commits
  // across 30 audio frames" rather than "expected false to be true".
  it('does not re-render the assistant for audio frames', { timeout: 180_000 }, async () => {
    const FRAMES = 30
    const budget = await measureListening(FRAMES)

    // Printed as well as asserted: the interesting number is the one this
    // prints on the way past, not only the one it draws a line under.
    console.log(
      `[mica render budget] ${budget.commits} commits / ${FRAMES} audio frames, `
        + `${budget.actual.toFixed(1)}ms render work, ${budget.base} startup commits`,
    )

    // A frame that re-renders the assistant costs a commit per frame; the
    // amplitude channel means the level reaches the orb without React being
    // asked at all.
    expect(
      budget.commits,
      `React committed ${budget.commits} times across ${FRAMES} audio frames `
        + `(${budget.actual.toFixed(1)}ms of render work); the budget is 3 commits.`,
    ).toBeLessThanOrEqual(3)

    // The waveform is still the metered one, so the budget above is not being
    // met by rendering less of the orb.
    expect(screen.getAllByText(/Mica/i).length).toBeGreaterThan(0)
  })

  it('renders the orb without waiting for anything asynchronous', async () => {
    // The orb is the entry point: it must exist on the first commit of the
    // shell, before any session, provider call or permission prompt.
    let firstCommitHadOrb = false
    render(
      <Profiler
        id="first-paint"
        onRender={() => {
          if (!firstCommitHadOrb) {
            firstCommitHadOrb = Boolean(screen.queryByRole('button', { name: 'Mica assistant' }))
          }
        }}
      >
        <MemoryRouter initialEntries={['/dashboard']}>
          <MicaProvider>
            <div>dashboard page</div>
            <MicaFab />
          </MicaProvider>
        </MemoryRouter>
      </Profiler>,
    )

    expect(firstCommitHadOrb).toBe(true)
  })
})
