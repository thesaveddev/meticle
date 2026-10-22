import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentLifecycleBoard from './IncidentLifecycleBoard'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const mockedApi = vi.mocked(api)

const candidate = {
  id: 'inc-twin', title: 'Fall in lounge again', status: 'reported',
  severity: 'medium', incident_date: '2026-10-26', location: 'Lounge', category_name: 'Falls',
}

function mockBoard({ duplicates = [candidate], links = [] }: { duplicates?: any[]; links?: any[] }) {
  ;(mockedApi.get as any).mockImplementation((url: string) => {
    if (url.endsWith('/duplicates')) return Promise.resolve({ data: duplicates })
    if (url.endsWith('/links')) return Promise.resolve({ data: links })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderBoard(canTriage = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <IncidentLifecycleBoard incidentId="inc-1" canTriage={canTriage} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('IncidentLifecycleBoard', () => {
  beforeEach(() => {
    vi.mocked(mockedApi.get).mockReset()
    vi.mocked(mockedApi.post).mockReset()
    vi.mocked(mockedApi.delete).mockReset()
  })

  it('lists duplicate candidates and records a link through the dialog', async () => {
    mockBoard({})
    ;(mockedApi.post as any).mockResolvedValue({ data: { id: 'link-1' } })
    renderBoard()

    expect(await screen.findByText('Fall in lounge again')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /link/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /record link/i }))
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/incidents/inc-1/links',
        expect.objectContaining({ linked_incident_id: 'inc-twin', link_type: 'duplicate' }),
      ),
    )
  })

  it('shows recorded links with an unlink affordance for managers', async () => {
    mockBoard({ duplicates: [], links: [{ id: 'link-9', linked_incident_id: 'inc-old', link_type: 'duplicate', linked_title: 'Earlier fall', linked_status: 'closed', reason: 'Same event' }] })
    ;(mockedApi.delete as any).mockResolvedValue({ data: {} })
    renderBoard()

    expect(await screen.findByText('Earlier fall')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /unlink/i }))
    await waitFor(() =>
      expect(mockedApi.delete).toHaveBeenCalledWith('/incidents/inc-1/links/link-9'),
    )
  })

  it('hides link and unlink affordances from non-managers', async () => {
    mockBoard({ links: [{ id: 'link-9', linked_incident_id: 'inc-old', link_type: 'related', linked_title: 'Earlier fall' }] })
    renderBoard(false)

    expect(await screen.findByText('Earlier fall')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /link/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlink/i })).not.toBeInTheDocument()
  })

  it('says so when there is nothing similar, and keeps failures visible', async () => {
    mockBoard({ duplicates: [] })
    renderBoard()
    expect(await screen.findByText(/no similar reports/i)).toBeInTheDocument()
  })

  it('keeps load failures inside the board', async () => {
    ;(mockedApi.get as any).mockRejectedValue(new Error('network down'))
    renderBoard()
    expect(await screen.findByText(/could not load related reports/i)).toBeInTheDocument()
  })
})
