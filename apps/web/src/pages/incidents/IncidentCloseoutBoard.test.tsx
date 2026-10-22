import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IncidentCloseoutBoard from './IncidentCloseoutBoard'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

const investigation = {
  id: 'inv-1', status: 'open', summary: 'Scope agreed',
  notes: [{ id: 'n-1', note: 'Spoke to night staff', author: 'Sam Lee', created_at: '2026-10-26T10:00:00.000Z' }],
}

function mockBoard({ inv = investigation, reporting = [] }: { inv?: any; reporting?: any[] } = {}) {
  ;(mockedApi.get as any).mockImplementation((url: string) => {
    if (url.endsWith('/investigation')) return inv ? Promise.resolve({ data: inv }) : Promise.reject({ response: { status: 404 } })
    if (url.endsWith('/reporting')) return Promise.resolve({ data: reporting })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function renderBoard(props: { status?: string; canTriage?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <IncidentCloseoutBoard incidentId="inc-1" status={props.status ?? 'investigating'} canTriage={props.canTriage ?? true} />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('IncidentCloseoutBoard', () => {
  beforeEach(() => {
    vi.mocked(mockedApi.get).mockReset()
    vi.mocked(mockedApi.post).mockReset()
  })

  it('opens an investigation when none exists', async () => {
    mockBoard({ inv: null })
    ;(mockedApi.post as any).mockResolvedValue({ data: { id: 'inv-1', status: 'open' } })
    renderBoard()

    expect(await screen.findByText(/no investigation opened yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open investigation/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/incidents/inc-1/investigation', {}))
  })

  it('lists findings and appends a new one', async () => {
    mockBoard()
    ;(mockedApi.post as any).mockResolvedValue({ data: { id: 'n-2' } })
    renderBoard()

    expect(await screen.findByText('Spoke to night staff')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/add a finding/i), { target: { value: 'Checked the rota' } })
    fireEvent.click(screen.getByRole('button', { name: /add finding/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith(
      '/incidents/inc-1/investigation/notes', { note: 'Checked the rota' },
    ))
  })

  it('records a reporting decision and shows it', async () => {
    mockBoard({ reporting: [{ id: 'r-1', reportable: true, channel: 'CQC', reference: 'CQC-9', created_at: '2026-10-26T11:00:00.000Z' }] })
    ;(mockedApi.post as any).mockResolvedValue({ data: { id: 'r-2' } })
    renderBoard()

    expect(await screen.findByText(/CQC-9/)).toBeInTheDocument()
  })

  it('closes the incident and shows the server blockers on 409', async () => {
    mockBoard()
    ;(mockedApi.post as any).mockRejectedValueOnce({ response: { data: { message: 'Cannot close: 1 completed action is not yet verified' } } })
    renderBoard()

    expect(await screen.findByText('Spoke to night staff')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^close incident$/i }))
    expect(await screen.findByText(/not yet verified/i)).toBeInTheDocument()
  })

  it('hides manager actions from non-managers', async () => {
    mockBoard({ inv: null })
    renderBoard({ canTriage: false })

    expect(await screen.findByText(/no investigation opened yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open investigation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^close incident$/i })).not.toBeInTheDocument()
  })
})
