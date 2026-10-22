import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
  },
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

const setupVoiceStack = () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
  })
  class FakeUtterance {
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(public text: string) {}
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      cancel: vi.fn(),
      speak: (u: { onend?: (() => void) | null }) => { queueMicrotask(() => u.onend?.()) },
    },
    configurable: true,
  })
}

beforeAll(async () => {
  await Promise.all([import('./MicaOverlay'), import('./MicaMiniBar')])
})

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <Routes>
        <Route path="/dashboard" element={<div>dashboard page</div>} />
      </Routes>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

describe('Mica — an empty utterance never stalls the session', () => {
  beforeEach(() => {
    setupVoiceStack()
    FakeRecognition.last = null
    vi.mocked(api.post).mockRejectedValue(new Error('no tts'))
  })

  afterEach(() => { vi.clearAllMocks() })

  it('a whitespace-only turn listens again instead of going silent', async () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
    await waitFor(() => expect(FakeRecognition.last).not.toBeNull())

    const rec = FakeRecognition.last as FakeRecognition
    // Interim noise with no words: truthy, but trims to nothing.
    rec.hear('   ')
    await act(async () => { rec.onend?.() })

    // Nothing was sent anywhere — and the session is still listening with a
    // fresh recogniser, rather than stuck with none.
    expect(api.post).not.toHaveBeenCalledWith('/ai/mica/ask', expect.anything())
    await waitFor(() => expect(FakeRecognition.last).not.toBe(rec))
  })
})
