import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

/**
 * What the carer is owed for pressing the orb, before the microphone is ready.
 *
 * ## Why this file exists
 *
 * Starting a session is asynchronous, and the two slowest steps are the ones the
 * carer has nothing to look at during: the browser's permission dialog (which
 * waits for a person), and — on a cold cache — the assistant's own UI arriving as
 * a lazy chunk. The tap used to show nothing at all through both of them: the
 * state change came last, after the probe, the meter and the recogniser, so a
 * first-time user pressed a control and watched a dialog they had not been given
 * a reason for appear over an orb that had not changed.
 *
 * So these tests hold the microphone open on purpose — a probe that never
 * resolves — and prove the session starts anyway: the listening surface is up and
 * the recogniser has not been asked to run. They also pin the edge that fixing it
 * introduces: a session ended while the permission dialog is up must not open a
 * recogniser afterwards.
 *
 * The browser speech stack is stubbed to the minimum `useMica` touches.
 */
class FakeRecognition {
  static last: FakeRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  constructor() { FakeRecognition.last = this }
}

/** The stream a resolved probe hands back; the meter opens its own. */
const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] })

let resolveProbe: (value: unknown) => void = () => undefined

/**
 * Hold the *first* getUserMedia open — the permission probe — and let every
 * later one (the meter's stream) resolve at once, so the only thing standing
 * between the tap and a recogniser is the probe under test.
 */
const deferProbe = () => {
  let calls = 0
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn(() => {
        calls += 1
        if (calls === 1) return new Promise(resolve => { resolveProbe = resolve })
        return Promise.resolve(stream())
      }),
    },
    configurable: true,
  })
}

const setupVoiceStack = () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(stream()) },
    configurable: true,
  })
  Object.defineProperty(window, 'speechSynthesis', {
    value: { cancel: vi.fn(), speak: vi.fn() },
    configurable: true,
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: class { lang = ''; rate = 1; pitch = 1; onend: (() => void) | null = null; constructor(public text: string) {} },
    configurable: true,
  })
}

const answerProbe = async () => {
  await act(async () => {
    resolveProbe(stream())
    await Promise.resolve()
  })
}

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <div>dashboard page</div>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

const tapOrb = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
  })
}

describe('Mica, from the tap to a live microphone', () => {
  // The surfaces are lazy chunks. A carer warms them by touching the orb; the
  // tests fetch them once, so what is asserted here is the state change and not a
  // module load (`mica.pendingSurfaces.test.tsx` covers the cold case).
  beforeAll(async () => {
    await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar')])
  })

  beforeEach(() => {
    setupVoiceStack()
    FakeRecognition.last = null
  })

  afterEach(() => { vi.clearAllMocks() })

  it('opens the session while the microphone probe is still unanswered', async () => {
    deferProbe()
    renderShell()

    await tapOrb()

    // The listening surface is up...
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('is listening…')).toBeInTheDocument()
    // ...and nothing has been asked of the microphone yet, which is the whole
    // point: the state did not wait for the person at the permission dialog.
    expect(FakeRecognition.last).toBeNull()

    // Answer it, and the session continues into the recogniser as before.
    await answerProbe()
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
  })

  it('does not leave a listening overlay behind when the microphone is refused', async () => {
    let calls = 0
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(() => {
          calls += 1
          return calls === 1 ? Promise.reject(new Error('denied')) : Promise.resolve(stream())
        }),
      },
      configurable: true,
    })
    renderShell()

    await tapOrb()

    // A refusal is the pre-session notice, not a modal claiming to listen.
    expect(await screen.findByText(/Microphone permission is blocked/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(FakeRecognition.last).toBeNull()
  })

  it('never opens the recogniser when the session ended while the dialog was up', async () => {
    deferProbe()
    renderShell()
    await tapOrb()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Escape, the keyboard exit from a live session — and the one control a carer
    // has while a permission dialog has their attention.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    // The probe answers after the session is over. Nothing may start listening.
    await answerProbe()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

    expect(FakeRecognition.last).toBeNull()
    expect(screen.getByRole('button', { name: 'Mica assistant' })).toBeInTheDocument()
  })
})
