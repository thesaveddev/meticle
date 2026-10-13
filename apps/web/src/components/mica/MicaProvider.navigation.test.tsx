import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

/**
 * The seam the whole voice-navigation feature rests on: a spoken destination
 * reaches the API, the API answers with a route, and the *provider* pushes it —
 * with the session dropping into the bar instead of closing.
 *
 * Every other test covers one piece of that (the parser, the payload, the bar,
 * the deep link). This one covers the joint between them, because a provider that
 * received `navigate` and did nothing with it would leave all of those green
 * while the carer still ended up staring at the page they started on.
 *
 * The browser speech stack is stubbed to the minimum the hook touches: the
 * recogniser (so a transcript can be fed in), getUserMedia (the pre-session mic
 * probe) and speechSynthesis (the TTS fallback, since /ai/tts is made to fail).
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
  // Ending is driven by the test, so the recogniser's stop is inert: a real
  // stop() fires onend, and the assertions below need to control that moment.
  stop = vi.fn()
  constructor() { FakeRecognition.last = this }

  /** Feed a transcript as one final result, the way the recogniser does. */
  hear(text: string) {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] as unknown as ArrayLike<unknown> })
  }
}

const setupVoiceStack = () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
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
      // Speech finishes immediately so the turn's continuation runs without a
      // timer: this is about routing, not about audio duration.
      speak: (u: { onend?: (() => void) | null }) => { queueMicrotask(() => u.onend?.()) },
    },
    configurable: true,
  })
}

/**
 * Say something, then end the utterance the way the VAD does.
 *
 * The flush between the two matters: the hook reads the transcript from a ref
 * that a render updates, so ending the utterance in the same tick would look
 * like a silent turn and restart listening instead of routing what was said.
 */
const say = async (rec: FakeRecognition, text: string) => {
  rec.hear(text)
  await waitFor(() => expect(screen.getByText(`“${text}”`)).toBeInTheDocument())
  await act(async () => { rec.onend?.() })
}

/**
 * The overlay and the bar arrive as lazy chunks (see `mica.surfaces.tsx`). A
 * carer warms them by hovering or pressing the orb before the tap, and
 * `fireEvent.click` fires neither, so fetch them once here: these tests are about
 * routing, and a module fetch on a cold cache would otherwise be what `say`'s
 * waitFor was really waiting for.
 */
beforeAll(async () => {
  await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar')])
})

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <Routes>
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/emedication" element={<div>emedication page</div>} />
        <Route path="/scheduling" element={<div>scheduling page</div>} />
      </Routes>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

describe('MicaProvider — a spoken destination becomes a real route', () => {
  beforeEach(() => {
    setupVoiceStack()
    FakeRecognition.last = null
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url === '/ai/mica/ask') {
        return {
          data: {
            answer: "Here's Evan Turner's March 2026 MAR chart.",
            navigate: {
              destination: 'mar-chart',
              path: '/emedication?personId=p1&month=2026-03',
              label: "Evan Turner's March 2026 MAR chart",
              person: { id: 'p1', name: 'Evan Turner' },
            },
          },
        } as never
      }
      // /ai/tts fails, which drops the reply to browser speech synthesis.
      throw new Error('no tts')
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('opens the destination and keeps the session live in the bar', async () => {
    renderShell()

    // Start the session the way a carer does: the orb.
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())

    const rec = FakeRecognition.last as FakeRecognition
    await say(rec, "give me Evan Turner's mar chart for march")

    // The route changed, and it carried the person and the month.
    expect(await screen.findByText('emedication page')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/ai/mica/ask', expect.objectContaining({
      question: "give me Evan Turner's mar chart for march",
    }))

    // The modal is gone and the bar is up: Mica got out of the way of the page
    // it opened, but the microphone is still on.
    expect(await screen.findByRole('status', { name: 'Mica — listening while you work' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Listening resumed by itself — no second tap.
    await waitFor(() => expect(FakeRecognition.last).not.toBe(rec))
  })

  it('opens the page a list answer offered, when the carer says yes', async () => {
    // The exchange this covers is the one a carer actually has: the answer to
    // "who is on shift today" ends by offering the rota, and the next word opens
    // it. The routing half matters as much as the route — a bare "yes" reaches
    // the ask endpoint here instead of the care-note draft it would otherwise be.
    vi.mocked(api.post).mockImplementation(async (url: string, body?: unknown) => {
      if (url === '/ai/mica/ask') {
        const question = (body as { question?: string } | undefined)?.question
        if (question === 'yes') {
          return {
            data: {
              answer: 'Opening the rota planner.',
              navigate: { destination: 'rota', path: '/scheduling', label: 'the rota planner' },
            },
          } as never
        }
        return {
          data: {
            answer: 'One staff member is on shift today: Fatima Iqbal (day shift, Oak House, 8am to 8pm). '
              + 'Want me to open the rota planner?',
            offer: { destination: 'rota', path: '/scheduling', label: 'the rota planner' },
            sessionId: 's1',
          },
        } as never
      }
      throw new Error('no tts')
    })

    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())

    const rec = FakeRecognition.last as FakeRecognition
    await say(rec, 'who is on shift today?')

    // Nothing opened on the offer itself, and the session is still live: the
    // offer is a question, and Mica waits for the answer.
    expect(await screen.findByText(/Want me to open the rota planner\?/)).toBeInTheDocument()
    expect(screen.queryByText('scheduling page')).toBeNull()

    // Listening resumed on its own, so the carer's answer needs no second tap.
    await waitFor(() => expect(FakeRecognition.last).not.toBe(rec))
    await say(FakeRecognition.last as FakeRecognition, 'yes')

    expect(await screen.findByText('scheduling page')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/ai/mica/ask', expect.objectContaining({
      question: 'yes',
      sessionId: 's1',
    }))
    expect(await screen.findByRole('status', { name: 'Mica — listening while you work' })).toBeInTheDocument()
  })

  it('answers a training-expiry question instead of drafting a renewal task', async () => {
    // The client's own write intent used to win here: "whose training is expiring"
    // contains the training and expiry words the renewal-task regex anchors on, so
    // the sentence was drafted as a generic "Training renewal follow-up" and the
    // answer never arrived. Two things have to hold: the question reaches the
    // endpoint that answers it, and the care-note and draft endpoints are not
    // touched at all.
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url === '/ai/mica/ask') {
        return {
          data: {
            answer: '2 training records are expiring soon: Priya Sharma — Fire Safety, expired on 1 October.',
            sessionId: 's1',
          },
        } as never
      }
      throw new Error('no tts')
    })

    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())

    await say(FakeRecognition.last as FakeRecognition, 'whose training is expiring')

    expect(await screen.findByText(/2 training records are expiring soon/)).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/ai/mica/ask', expect.objectContaining({
      question: 'whose training is expiring',
    }))
    // Neither the note nor the action draft: a question is not a write.
    expect(api.post).not.toHaveBeenCalledWith('/ai/voice/notes', expect.anything())
    expect(api.post).not.toHaveBeenCalledWith('/ai/mica/actions', expect.anything())
  })

  it('ends the session when the carer says bye', async () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
    const rec = FakeRecognition.last as FakeRecognition
    await say(rec, 'bye')

    // The session closes: no bar, no dialog, and the resting orb is back.
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Mica — listening while you work' })).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('button', { name: 'Mica assistant' })).toBeInTheDocument()
    // A stop phrase is not a question: the ask endpoint is never called.
    expect(api.post).not.toHaveBeenCalledWith('/ai/mica/ask', expect.anything())
  })
})
