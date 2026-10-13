import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MicaProvider } from './MicaProvider'
import MicaFab from './MicaFab'

/**
 * A press has to be visible before the assistant's surface has loaded.
 *
 * ## Why this file exists
 *
 * Splitting the overlay and the bar out of the shell bundle is what stops every
 * page in the product parsing the whole assistant — modal, transcript,
 * destination chip — before the orb can paint. It also opens a gap: the entry
 * point removes itself the moment a session exists, so with a bare
 * `fallback={null}` the first tap on a cold cache put *nothing* on screen for as
 * long as the chunk took to arrive. A tap that looks dead is the complaint this
 * body of work started from, so the boundary draws the live orb itself.
 *
 * The chunk here never arrives at all — the worst case, and the one a slow
 * connection actually produces — and the press still has to be acknowledged: the
 * orb in its live state, plus a state announcement for a screen reader.
 *
 * The browser speech stack is stubbed to the minimum `useMica` touches.
 */
vi.mock('./mica.surfaces', async () => {
  const { lazy } = await import('react')
  // A promise that never settles, so `lazy` renders the boundary's fallback for
  // the whole test.
  const never = () => new Promise<never>(() => {})
  return {
    MicaOverlaySurface: lazy(never),
    MicaMiniBarSurface: lazy(never),
    preloadMicaSurfaces: () => {},
  }
})

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

const setupVoiceStack = () => {
  Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
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

const renderShell = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <MicaProvider>
      <div>dashboard page</div>
      <MicaFab />
    </MicaProvider>
  </MemoryRouter>,
)

const press = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Mica assistant' }))
  })
  await waitFor(() => expect(FakeRecognition.last).not.toBeNull())
}

describe('Mica surfaces, while the lazy chunk is still in flight', () => {
  beforeEach(() => {
    setupVoiceStack()
    FakeRecognition.last = null
  })

  afterEach(() => { vi.clearAllMocks() })

  it('shows the live orb instead of an empty screen until the surface arrives', async () => {
    const { container } = renderShell()

    // At rest: the entry point's own orb, idle.
    expect(container.querySelector('[data-mica-state="idle"]')).not.toBeNull()

    await press()

    // The overlay — the thing that normally says a session is live — is never
    // going to arrive, and the screen must not be empty because of it.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[data-mica-state="listening"]')).not.toBeNull()
  })

  it('announces the state, since the overlay that usually does is the missing part', async () => {
    renderShell()

    await press()

    expect(screen.getByRole('status')).toHaveTextContent('Mica is listening')
  })

  it('draws no second control to press while the surface is missing', async () => {
    const { container } = renderShell()

    await press()

    // The stand-in is a report of the current state, not another button: the
    // session is already live, and the surface on its way brings the real
    // controls (minimise, end) with it.
    const liveOrbButton = container.querySelector('[data-mica-state="listening"] button')
    expect(liveOrbButton).not.toBeNull()
    expect(liveOrbButton).toBeDisabled()
  })
})
