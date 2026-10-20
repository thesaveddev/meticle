import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MarketplacePage from './MarketplacePage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

const openShift = {
  id: '11111111-1111-4111-8111-111111111111',
  location_name: 'Oak House',
  start_time: '2026-10-21T07:00:00.000Z',
  end_time: '2026-10-21T15:00:00.000Z',
  status: 'open',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MarketplacePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MarketplacePage apply', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
    mockedApi.post.mockReset()
    mockedApi.get.mockResolvedValue({ data: [openShift] } as any)
  })

  /**
   * The page used to post `staffId: 'mock-id'`, which the API's uuid validator
   * rejected — so the only button on the page could not succeed. Who is applying
   * is the session's business; the request must not name a staff id at all.
   */
  it('applies without naming a staff id, and says so when it works', async () => {
    mockedApi.post.mockResolvedValue({ data: { id: 'assignment-1' } } as any)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /apply for shift/i }))

    // The mutation runs on a microtask, so wait for its outcome before reading the call.
    expect(await screen.findByText(/you have applied for this shift/i)).toBeInTheDocument()
    expect(mockedApi.post).toHaveBeenCalledWith(`/marketplace/apply/${openShift.id}`, {})
    const body = mockedApi.post.mock.calls[0][1] as Record<string, unknown>
    expect(body).not.toHaveProperty('staffId')
  })

  it('shows the server’s reason when the application is refused', async () => {
    mockedApi.post.mockRejectedValue({
      response: { data: { statusCode: 400, message: 'Your account has no staff profile yet.' } },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /apply for shift/i }))

    expect(await screen.findByText('Your account has no staff profile yet.')).toBeInTheDocument()
    expect(screen.queryByText(/you have applied for this shift/i)).not.toBeInTheDocument()
  })
})
