import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import LenisBridge from './LenisBridge'
import { getLenisInstance } from './lenisStore'

/**
 * A stopped Lenis keeps its window wheel listener and preventDefaults every
 * gesture, so `stop()` on app routes killed scrolling across the whole
 * signed-in application. The bridge must destroy off public paths instead.
 * The mock records every instance so the tests can assert on exactly that.
 */
vi.mock('lenis', () => {
  const MockLenis = vi.fn(function (this: unknown) {
    return {
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(() => () => {}),
    }
  })
  return { default: MockLenis }
})

import Lenis from 'lenis'

type FakeLenis = { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }
const MockedLenis = Lenis as unknown as { mock: { results: Array<{ value: FakeLenis }> }; mockClear: () => void }
const created = () => MockedLenis.mock.results.map((r) => r.value)

function go(path: string) {
  window.history.pushState({}, '', path)
}

beforeEach(() => {
  // requestAnimationFrame is the bridge's route poller; drive it with timers.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  go('/')
  document.documentElement.removeAttribute('data-lenis-enabled')
  document.documentElement.removeAttribute('data-lenis-prevent')
  MockedLenis.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LenisBridge', () => {
  it('smooth-scrolls public pages: constructs, starts and flags the document', () => {
    go('/pricing')
    const { unmount } = render(<LenisBridge />)

    expect(created()).toHaveLength(1)
    expect(created()[0].start).toHaveBeenCalled()
    expect(getLenisInstance()).not.toBeNull()
    expect(document.documentElement.dataset.lenisEnabled).toBe('true')

    unmount()
    expect(created()[0].destroy).toHaveBeenCalled()
    expect(getLenisInstance()).toBeNull()
    expect(document.documentElement.hasAttribute('data-lenis-enabled')).toBe(false)
  })

  it('never constructs on app routes, so the browser keeps native scroll', () => {
    go('/dashboard')
    const { unmount } = render(<LenisBridge />)

    expect(created()).toHaveLength(0)
    expect(getLenisInstance()).toBeNull()
    expect(document.documentElement.hasAttribute('data-lenis-enabled')).toBe(false)

    unmount()
  })

  it('destroys — never stops — the instance when leaving public pages', async () => {
    go('/')
    const { unmount } = render(<LenisBridge />)
    expect(created()).toHaveLength(1)

    go('/dashboard')

    await waitFor(() => expect(created()[0].destroy).toHaveBeenCalled())
    // stop() is the call that killed app-wide scrolling; it must not come back.
    expect(created()[0].stop).not.toHaveBeenCalled()
    expect(getLenisInstance()).toBeNull()
    expect(document.documentElement.hasAttribute('data-lenis-enabled')).toBe(false)

    unmount()
  })

  it('recreates when returning to a public page', async () => {
    go('/dashboard')
    const { unmount } = render(<LenisBridge />)
    expect(created()).toHaveLength(0)

    go('/about')

    await waitFor(() => expect(created()).toHaveLength(1))
    expect(created()[0].start).toHaveBeenCalled()
    expect(document.documentElement.dataset.lenisEnabled).toBe('true')

    unmount()
  })

  it('keeps /compliance on native scroll for signed-in users (the in-app hub)', () => {
    window.localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'ORG_ADMIN' }))
    go('/compliance')
    const { unmount } = render(<LenisBridge />)

    expect(created()).toHaveLength(0)
    expect(getLenisInstance()).toBeNull()

    unmount()
  })

  it('still smooth-scrolls /compliance for signed-out visitors (marketing page)', () => {
    go('/compliance')
    const { unmount } = render(<LenisBridge />)

    expect(created()).toHaveLength(1)
    expect(document.documentElement.dataset.lenisEnabled).toBe('true')

    unmount()
  })
})
