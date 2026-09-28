import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationDecisionEvidence from './LocationDecisionEvidence'
import api from '../services/api'

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LocationDecisionEvidence /></QueryClientProvider>)
}

const worker = (overrides: Record<string, unknown> = {}) => ({
  user_id: 'u1', name: 'Joyce Amankwah', decision: 'agreed', notice_version: '1.1',
  decided_at: '2026-09-01T09:00:00.000Z', ...overrides,
})

const summary = (overrides: Record<string, unknown> = {}) => ({
  total: 3, agreed: 1, declined: 1, not_answered: 1,
  workers: [
    worker(),
    worker({ user_id: 'u2', name: 'Fatima Bello', decision: 'declined', decided_at: '2026-09-02T09:00:00.000Z' }),
    worker({ user_id: 'u3', name: 'Eileen Walsh', decision: null, notice_version: null, decided_at: null }),
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("the manager's view of who has agreed", () => {
  it('counts every active worker, not only the ones who answered', async () => {
    // The flattering-reading guard: answering for 1 of 3 must never render as
    // 100%. An organisation could otherwise make the panel look complete by
    // asking fewer people.
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    expect(await screen.findByText('1 of 3 agreed')).toBeInTheDocument()
    // The percentage is rendered from a computed value, so match the sentence
    // around it rather than the number that happens to be in it today.
    expect(screen.getByText(/of active workers have agreed\./)).toHaveTextContent('33%')
  })

  it('names the workers who refused, instead of quietly leaving them out', async () => {
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    expect(await screen.findByText('Fatima Bello')).toBeInTheDocument()
    expect(screen.getAllByText('Declined')).toHaveLength(1)
  })

  it('shows a worker who has not answered as not answered', async () => {
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    expect(await screen.findByText('Eileen Walsh')).toBeInTheDocument()
    expect(screen.getByText('Not answered')).toBeInTheDocument()
  })

  it('says who is actually being collected from', async () => {
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    // The sentence a provider would be asked for in an inspection, and the one
    // that keeps the panel honest about who is excluded.
    expect(await screen.findByText(/only collected from/)).toBeInTheDocument()
    expect(screen.getByText(/the 1 who agreed, and from nobody else/)).toBeInTheDocument()
  })

  it('shows the notice version each answer was recorded against', async () => {
    mockedApi.get.mockResolvedValue({
      data: summary({
        total: 1, agreed: 1, declined: 0, not_answered: 0,
        workers: [worker({ notice_version: '1.0' })],
      }),
    } as any)
    renderPanel()

    // An answer given against a superseded notice is still an answer, and a
    // provider checking the pack needs to see which wording it was given under.
    expect(await screen.findByText('1.0')).toBeInTheDocument()
  })

  it('refuses to present the record as a lawful basis', async () => {
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    // The load-bearing sentence. Meticle Care is a processor and cannot
    // manufacture a lawful basis for an employer's monitoring of its staff.
    expect(await screen.findByText(/It is not a lawful basis for monitoring staff/)).toBeInTheDocument()
  })

  it('does not call the answers consent', async () => {
    mockedApi.get.mockResolvedValue({ data: summary() } as any)
    renderPanel()

    await screen.findByText('1 of 3 agreed')
    // "Consent" in the heading or body would be a claim the record cannot
    // support, and a word a regulator would quote back.
    expect(document.body.textContent).not.toMatch(/\bconsent\b/i)
  })

  it('handles an organisation with nobody to ask without dividing by zero', async () => {
    mockedApi.get.mockResolvedValue({
      data: { total: 0, agreed: 0, declined: 0, not_answered: 0, workers: [] },
    } as any)
    renderPanel()

    expect(await screen.findByText('No active workers to ask.')).toBeInTheDocument()
  })

  it('does not show a success-looking panel when the evidence fails to load', async () => {
    // A summary that failed to load and rendered as "0 agreed" would be
    // evidence of the opposite of what it says.
    mockedApi.get.mockRejectedValue(new Error('offline'))
    renderPanel()

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
    // Scoped to the count, because the panel's own heading says "agreed".
    expect(screen.queryByText(/\d+ of \d+ agreed/)).toBeNull()
  })
})
