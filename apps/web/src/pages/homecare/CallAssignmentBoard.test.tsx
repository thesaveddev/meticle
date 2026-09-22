import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallAssignmentBoard from './CallAssignmentBoard'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../../services/socket', () => ({ getSocket: () => null }))

const mockedApi = vi.mocked(api)
const dataTransfer = () => ({ effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn() })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CallAssignmentBoard /></QueryClientProvider>)
}

const staff = [{ id: 'carer-1', first_name: 'Jordan', last_name: 'Smith' }, { id: 'carer-2', first_name: 'Taylor', last_name: 'Jones' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.patch.mockResolvedValue({ data: {} } as any)
  mockedApi.post.mockResolvedValue({ data: { results: [] } } as any)
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/homecare/staff') return Promise.resolve({ data: staff })
    if (url === '/homecare/visits') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: [] })
  })
})

describe('CallAssignmentBoard drag workflows', () => {
  it('assigns an unassigned call when dragged onto a carer', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/homecare/staff') return Promise.resolve({ data: [staff[0]] })
      if (url === '/homecare/visits') return Promise.resolve({ data: [{
        id: 'visit-1', label: 'Morning call', person_name: 'Alex Jones', person_address: null,
        assigned_staff_id: null, status: 'scheduled', scheduled_start: '2026-09-21T09:00:00.000Z', scheduled_end: '2026-09-21T09:30:00.000Z',
      }] })
      return Promise.resolve({ data: [] })
    })

    renderPage()
    const call = await screen.findByText('Alex Jones')
    fireEvent.dragStart(call.closest('[draggable="true"]')!, { dataTransfer: dataTransfer() })
    fireEvent.drop(screen.getByTestId('carer-drop-zone-carer-1'), { dataTransfer: dataTransfer() })

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/homecare/visits/visit-1', { assigned_staff_id: 'carer-1' }))
  })

  it('unassigns an assigned call when dragged to the unassigned drop zone', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/homecare/staff') return Promise.resolve({ data: [staff[0]] })
      if (url === '/homecare/visits') return Promise.resolve({ data: [{
        id: 'visit-2', label: 'Lunch call', person_name: 'Morgan Lee', person_address: null,
        assigned_staff_id: 'carer-1', carer_name: 'Jordan Smith', status: 'scheduled', scheduled_start: '2026-09-21T12:00:00.000Z', scheduled_end: '2026-09-21T12:30:00.000Z',
      }] })
      return Promise.resolve({ data: [] })
    })

    renderPage()
    const call = await screen.findByText('Morgan Lee')
    fireEvent.dragStart(call.closest('[draggable="true"]')!, { dataTransfer: dataTransfer() })
    fireEvent.drop(screen.getByTestId('unassigned-drop-zone'), { dataTransfer: dataTransfer() })

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/homecare/visits/visit-2', { assigned_staff_id: null }))
  })
})
