import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

/**
 * The write flow, end to end: a spoken request is prepared by the server, the
 * carer approves it on the card, and the record it created is what they end up
 * looking at.
 *
 * This is the joint the product was missing. Every piece either side of it was
 * built and tested — the gateway drafts instead of writing, the confirm endpoint
 * persists and returns the new record's page, the pages open a record from a deep
 * link — but the draft had no surface in the client at all: `useMica` wrote it to
 * `sessionStorage` and nothing ever read that key. So a carer could ask Mica to
 * add a task, hear it read back, and never be able to save it.
 *
 * Three properties are asserted here, and each is a decision:
 *
 *   1. **A tap saves.** The card is the client half of confirm-before-persist, and
 *      the envelope it posts is the one the server issued, not a reconstruction.
 *   2. **\"yes\" saves.** The reply ends by asking \"shall I save it?\", so the word
 *      that answers it writes — and it must not fall through to the care-note path,
 *      which is where a bare \"yes\" used to end up.
 *   3. **The save ends on the record.** The confirm reply's offer is the page the
 *      row lives on, and opening it is the same route the spoken \"yes\" would have
 *      given (a tap and a word are interchangeable, by design).
 *
 * The browser speech stack is stubbed to the minimum the hook touches, exactly as
 * `MicaProvider.navigation.test.tsx` does.
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
  stop = vi.fn()
  constructor() { FakeRecognition.last = this }

  hear(text: string) {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] as unknown as ArrayLike<unknown> })
  }
}

/**
 * Every line Mica spoke, in order.
 *
 * The reply box is transient by design — it holds the sentence being spoken and
 * is cleared when the turn ends — so a test that reads the spoken answer out of
 * the DOM is racing the audio. This is the carer's side of the same event, and it
 * is durable: the reply is what was said, not what happened to still be on screen.
 */
const spoken: string[] = []

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
      speak: (u: { text: string; onend?: (() => void) | null }) => {
        spoken.push(u.text)
        queueMicrotask(() => u.onend?.())
      },
    },
    configurable: true,
  })
}

/** Say something, then end the utterance the way the VAD does. */
const say = async (rec: FakeRecognition, text: string) => {
  rec.hear(text)
  await waitFor(() => expect(screen.getByText(`“${text}”`)).toBeInTheDocument())
  await act(async () => { rec.onend?.() })
}

beforeAll(async () => {
  await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar')])
})

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <Routes>
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/tasks" element={<div>tasks page</div>} />
        <Route path="/appointments" element={<div>appointments page</div>} />
      </Routes>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

/** The draft `/ai/mica/actions` returns for "add a task to order new grip rails". */
const TASK_DRAFT_RESPONSE = {
  draft: true,
  action: 'CREATE_TASK',
  output: {
    title: 'Order new grip rails',
    personName: 'Grace Roberts',
    assigneeName: 'Tom Bradley',
    priority: 'high',
    dueDate: '2026-10-20',
  },
  summary: "I've prepared a task about Grace Roberts, assigned to Tom Bradley, due 2026-10-20, priority high. Shall I save it?",
  context: { organizationId: 'org1', userId: 'u1', source: 'voice' },
}

/** What the confirm endpoint answers with once the task exists. */
const CONFIRMED_RESPONSE = {
  confirmed: true,
  result: { taskId: 't1', title: 'Order new grip rails' },
  sessionId: 's1',
  offer: {
    destination: 'tasks',
    path: '/tasks?task=t1',
    label: 'the new task',
    offer: 'Want me to open the new task?',
  },
}

const startSession = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
  await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
  return FakeRecognition.last as FakeRecognition
}

describe('MicaProvider — a spoken request becomes a saved record', () => {
  beforeEach(() => {
    setupVoiceStack()
    FakeRecognition.last = null
    spoken.length = 0
    window.sessionStorage.clear()
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url === '/ai/mica/actions') return { data: TASK_DRAFT_RESPONSE } as never
      if (url === '/ai/mica/actions/confirm') return { data: CONFIRMED_RESPONSE } as never
      // /ai/tts fails, which drops the reply to browser speech synthesis.
      throw new Error('no tts')
    })
  })

  afterEach(() => { vi.clearAllMocks() })

  it('prepares a draft, saves it on the card, then opens the record it saved', async () => {
    renderShell()
    const rec = await startSession()
    await say(rec, 'add a task to order new grip rails')

    // Nothing is written by the utterance itself: the server answered with a
    // draft, and the card is where it waits.
    expect(await screen.findByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })).toBeInTheDocument()
    expect(document.querySelector('[data-mica-draft="CREATE_TASK"]')).toHaveTextContent('Order new grip rails')
    expect(api.post).not.toHaveBeenCalledWith('/ai/mica/actions/confirm', expect.anything())

    fireEvent.click(screen.getByRole('button', { name: /save task/i }))

    // The envelope the server issued goes back verbatim, under the key it expects.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/mica/actions/confirm', expect.objectContaining({
      draft: expect.objectContaining({ action: 'CREATE_TASK', draft: true }),
    })))
    // And the card is finished with: a saved draft is not still waiting.
    await waitFor(() => expect(document.querySelector('[data-mica-draft]')).toBeNull())

    // The write ends where a read answer ends — with the sentence a list answer
    // ends with, which is what a carer hears.
    await waitFor(() => expect(spoken).toContain('Saved. Want me to open the new task?'))
    const control = await waitFor(() => {
      const el = document.querySelector('[data-mica-offer="/tasks?task=t1"]')
      expect(el).not.toBeNull()
      return el as Element
    })

    fireEvent.click(control)

    // The carer is looking at the task row, and Mica has moved out of its way.
    expect(await screen.findByText('tasks page')).toBeInTheDocument()
    expect(await screen.findByRole('status', { name: 'Mica — listening while you work' })).toBeInTheDocument()
  })

  it('saves the draft when the carer says yes instead of tapping', async () => {
    renderShell()
    const rec = await startSession()
    await say(rec, 'add a task to order new grip rails')
    await screen.findByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })

    // Listening resumed on its own, so the answer needs no second tap.
    await waitFor(() => expect(FakeRecognition.last).not.toBe(rec))
    await say(FakeRecognition.last as FakeRecognition, 'yes')

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/mica/actions/confirm', expect.anything()))
    // The word answered Mica's own question. Were it routed as an utterance, it
    // would have been drafted into a care note about nobody instead.
    expect(api.post).not.toHaveBeenCalledWith('/ai/voice/notes', expect.anything())
    await waitFor(() => expect(spoken).toContain('Saved. Want me to open the new task?'))
  })

  it('carries the session the draft was prepared in, so the offer is answerable', async () => {
    renderShell()
    const rec = await startSession()

    // A first turn that returns a session id (any answered question does).
    vi.mocked(api.post).mockImplementation(async (url: string, _body?: unknown) => {
      if (url === '/ai/mica/ask') {
        return { data: { answer: 'One staff member is on shift today: Fatima Iqbal.', sessionId: 's1' } } as never
      }
      if (url === '/ai/mica/actions') return { data: TASK_DRAFT_RESPONSE } as never
      if (url === '/ai/mica/actions/confirm') return { data: CONFIRMED_RESPONSE } as never
      throw new Error('no tts')
    })

    await say(rec, 'who is on shift today?')
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/mica/ask', expect.anything()))

    await waitFor(() => expect(FakeRecognition.last).not.toBe(rec))
    await say(FakeRecognition.last as FakeRecognition, 'add a task to order new grip rails')
    await screen.findByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })

    fireEvent.click(screen.getByRole('button', { name: /save task/i }))

    // The server holds the offer on the conversation, and a bare "yes" opens it
    // only if the confirm arrived in that same conversation.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/mica/actions/confirm', expect.objectContaining({
      sessionId: 's1',
    })))
  })

  it('keeps a prepared draft through a reload instead of losing it', async () => {
    // What the hook wrote to the tab on the previous page load.
    window.sessionStorage.setItem('mica.pendingDraft', JSON.stringify({
      action: 'CREATE_TASK',
      summary: TASK_DRAFT_RESPONSE.summary,
      output: TASK_DRAFT_RESPONSE.output,
      envelope: TASK_DRAFT_RESPONSE,
    }))

    renderShell()
    await startSession()

    // Nothing was asked for in this session, and the card is there anyway: the
    // record the carer asked for is not thrown away by a page load.
    expect(await screen.findByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })).toBeInTheDocument()
    expect(document.querySelector('[data-mica-draft="CREATE_TASK"]')).toHaveTextContent('Order new grip rails')
  })

  it('drops the draft on Discard, and writes nothing', async () => {
    renderShell()
    const rec = await startSession()
    await say(rec, 'add a task to order new grip rails')
    await screen.findByRole('group', { name: 'Draft prepared by Mica, waiting to be saved' })

    fireEvent.click(screen.getByRole('button', { name: /discard/i }))

    await waitFor(() => expect(document.querySelector('[data-mica-draft]')).toBeNull())
    expect(api.post).not.toHaveBeenCalledWith('/ai/mica/actions/confirm', expect.anything())
    // The only copy is gone from the tab too, so a reload cannot resurrect it.
    expect(window.sessionStorage.getItem('mica.pendingDraft')).toBeNull()
  })

  it('books an appointment from its own card, and lands on the appointment', async () => {
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url === '/ai/mica/actions') {
        return {
          data: {
            draft: true,
            action: 'CREATE_APPOINTMENT',
            output: {
              title: 'Podiatry clinic',
              personName: 'Grace Roberts',
              staffName: 'Tom Bradley',
              startTime: '2026-10-21T13:00:00.000Z',
              endTime: '2026-10-21T14:00:00.000Z',
            },
            summary: 'I\'ve prepared "Podiatry clinic" for Grace Roberts on Wednesday 21 October at 2pm. Shall I book it?',
            context: { organizationId: 'org1', userId: 'u1', source: 'voice' },
          },
        } as never
      }
      if (url === '/ai/mica/actions/confirm') {
        return {
          data: {
            confirmed: true,
            result: { appointmentId: 'a1' },
            sessionId: 's1',
            offer: {
              destination: 'appointments',
              path: '/appointments?appointment=a1',
              label: 'the new appointment',
              offer: 'Want me to open the new appointment?',
            },
          },
        } as never
      }
      throw new Error('no tts')
    })

    renderShell()
    const rec = await startSession()
    await say(rec, 'book a podiatry clinic appointment for Grace Roberts tomorrow at 2pm')

    const card = await waitFor(() => {
      const el = document.querySelector('[data-mica-draft="CREATE_APPOINTMENT"]')
      expect(el).not.toBeNull()
      return el as Element
    })
    expect(card).toHaveTextContent('Podiatry clinic')
    expect(card).toHaveTextContent('Tom Bradley')

    // The action's own vocabulary, carried through the whole flow: the card books
    // rather than saves, and the word it invites books too.
    const book = screen.getByRole('button', { name: /book appointment/i })
    expect(card).toHaveTextContent(/say “yes” to book it/i)
    fireEvent.click(book)

    // The same reply shape as a saved task, with the appointment's own verb.
    await waitFor(() => expect(spoken).toContain('Booked. Want me to open the new appointment?'))
    fireEvent.click(await waitFor(() => {
      const el = document.querySelector('[data-mica-offer="/appointments?appointment=a1"]')
      expect(el).not.toBeNull()
      return el as Element
    }))
    expect(await screen.findByText('appointments page')).toBeInTheDocument()
  })
})
