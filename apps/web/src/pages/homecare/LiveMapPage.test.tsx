import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import LiveMapPage from './LiveMapPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LiveMapPage /></QueryClientProvider>)
}

describe('LiveMapPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockedApi.get.mockImplementation(() => new Promise(() => {}) as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces the indefinite loading state after the timeout', async () => {
    renderPage()
    // Wording corrected 27 Sep 2026: the map plots check-in positions, so
    // "live visit" / "real-time" overstated it. See
    // docs/DPIA_Live_Active_Visit_Map.md. Asserted with a regex because the
    // copy contains a straight apostrophe, which cannot sit inside a
    // single-quoted string literal.
    expect(screen.getByText(/Loading today's check-in data/)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(12_000)
    })

    expect(screen.getByText('Map unavailable')).toBeInTheDocument()
    expect(screen.getByText('The visit map is taking too long to respond.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })
})
