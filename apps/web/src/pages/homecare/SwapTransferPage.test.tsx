import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SwapTransferPage from './SwapTransferPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

const mockedApi = vi.mocked(api)
const sent = { id: 'sent-1', request_type: 'swap', status: 'pending', visit_label: 'Morning call', client_name: 'Ada', scheduled_start: '2026-09-17T09:00:00Z', scheduled_end: '2026-09-17T09:30:00Z', created_at: '2026-09-16T10:00:00Z', requested_by_name: 'Me', is_requested_by_me: true, is_target_for_me: false }
const received = { id: 'received-1', request_type: 'transfer', status: 'pending', visit_label: 'Evening call', client_name: 'Grace', scheduled_start: '2026-09-17T18:00:00Z', scheduled_end: '2026-09-17T18:30:00Z', created_at: '2026-09-16T11:00:00Z', requested_by_name: 'Another carer', target_name: 'Me', is_requested_by_me: false, is_target_for_me: true }

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/homecare/swap-requests') return Promise.resolve({ data: [sent, received] })
    if (url === '/homecare/my-visits') return Promise.resolve({ data: [] })
    if (url === '/homecare/staff') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
})

describe('SwapTransferPage', () => {
  it('filters requests by explicit sent and received ownership flags', async () => {
    render(<SwapTransferPage />)
    expect(await screen.findByRole('heading', { name: 'Swap & Transfer' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sent' }))
    expect(screen.getByText('Morning call')).toBeInTheDocument()
    expect(screen.queryByText('Evening call')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Received' }))
    expect(screen.getByText('Evening call')).toBeInTheDocument()
    expect(screen.queryByText('Morning call')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('surfaces a load error instead of leaving the page blank', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<SwapTransferPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Swap & Transfer' })).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable')
  })
})
