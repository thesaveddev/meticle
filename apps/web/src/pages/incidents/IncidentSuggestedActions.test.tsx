import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentSuggestedActions from './IncidentSuggestedActions'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

const proposed = [
  { id: 's-1', action: 'Review the falls risk assessment', due_date: '2026-11-02', source: 'rules', rule_key: 'falls_review', status: 'proposed' },
  { id: 's-2', action: 'Reassess the moving and handling plan', due_date: '2026-11-02', source: 'ai', rule_key: 'ai_triage_recommendation', status: 'proposed' },
]

function mockApi(list: any[] = proposed) {
  ;(mockedApi.get as any).mockImplementation((url: string) => {
    if (url.endsWith('/actions/suggestions')) return Promise.resolve({ data: list })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderBoard(canTriage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <IncidentSuggestedActions incidentId="inc-1" canTriage={canTriage} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('IncidentSuggestedActions', () => {
  beforeEach(() => {
    vi.mocked(mockedApi.get).mockReset()
    vi.mocked(mockedApi.post).mockReset()
  })

  it('proposes drafts from a manager press, keeping AI provenance visible', async () => {
    mockApi([])
    ;(mockedApi.post as any).mockResolvedValue({ data: proposed })
    renderBoard()

    expect(await screen.findByText(/no suggested actions yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /suggest actions/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/incidents/inc-1/actions/suggest', {}))
  })

  it('lists drafts with provenance and approves one into work', async () => {
    mockApi()
    ;(mockedApi.post as any).mockResolvedValue({ data: { suggestion: { ...proposed[0], status: 'approved' }, action: { id: 'a-1' } } })
    renderBoard()

    expect(await screen.findByText('Review the falls risk assessment')).toBeInTheDocument()
    expect(screen.getByText('AI suggestion')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^approve$/i })[0])
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
      '/incidents/inc-1/actions/suggestions/s-1/decide', { decision: 'approved' },
    ))
  })

  it('rejects with a recorded reason', async () => {
    mockApi()
    ;(mockedApi.post as any).mockResolvedValue({ data: { suggestion: { ...proposed[1], status: 'rejected' }, action: null } })
    renderBoard()

    expect(await screen.findByText('Reassess the moving and handling plan')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^reject$/i })[1])
    fireEvent.change(screen.getByLabelText(/why reject/i), { target: { value: 'Already covered' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm reject/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
      '/incidents/inc-1/actions/suggestions/s-2/decide', { decision: 'rejected', reason: 'Already covered' },
    ))
  })

  it('hides manager affordances from non-managers', async () => {
    mockApi()
    renderBoard(false)

    expect(await screen.findByText('Review the falls risk assessment')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /suggest actions|refresh suggestions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()
  })

  it('keeps load failures inside the board', async () => {
    ;(mockedApi.get as any).mockRejectedValue(new Error('network down'))
    renderBoard()
    expect(await screen.findByText(/could not load suggestions/i)).toBeInTheDocument()
  })
})
