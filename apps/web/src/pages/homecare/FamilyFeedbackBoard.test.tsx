import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FamilyFeedbackBoard from './FamilyFeedbackBoard'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

const mockedApi = vi.mocked(api)

const payload = {
  feedback: [
    {
      id: 'fb-1', visit_id: 'v-1', person_id: 'p-1',
      family_member_name: 'Sarah Ellis', relationship: 'Daughter',
      overall_rating: 5, care_quality_rating: 5, communication_rating: 4, punctuality_rating: null,
      feedback_text: 'Nia was kind and unhurried with Mum.', would_recommend: true,
      submitted_at: '2026-10-19T10:30:00.000Z',
      visit_label: 'Morning call', scheduled_start: '2026-10-19T09:00:00.000Z',
      carer_name: 'Nia Okafor', person_first_name: 'Margaret', person_last_name: 'Ellis',
    },
    {
      id: 'fb-2', visit_id: 'v-2', person_id: 'p-2',
      family_member_name: 'Tom Reed', relationship: 'Son',
      overall_rating: 2, care_quality_rating: 2, communication_rating: 3, punctuality_rating: 2,
      feedback_text: null, would_recommend: false,
      submitted_at: '2026-10-18T18:00:00.000Z',
      visit_label: 'Tea call', scheduled_start: '2026-10-18T17:00:00.000Z',
      carer_name: 'Sam Lee', person_first_name: 'Ruth', person_last_name: 'Reed',
    },
  ],
  stats: { total_feedback: 2, avg_overall: 3.5, avg_care_quality: 3.5, avg_communication: 3.5, avg_punctuality: 2, would_recommend_count: 1 },
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <FamilyFeedbackBoard />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('FamilyFeedbackBoard', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
  })

  it('shows the averages and every submission, and opens the full reading on click', async () => {
    mockedApi.get.mockResolvedValue({ data: payload } as any)
    renderBoard()

    expect(await screen.findByText('Margaret Ellis')).toBeInTheDocument()
    expect(screen.getByText('Ruth Reed')).toBeInTheDocument()
    expect(screen.getByText('1 of 2', { exact: false })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Margaret Ellis'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Nia was kind and unhurried/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Would recommend/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))
  })

  it('says so when there is nothing to read yet', async () => {
    mockedApi.get.mockResolvedValue({ data: { feedback: [], stats: { total_feedback: 0 } } } as any)
    renderBoard()

    expect(await screen.findByText(/no family feedback yet/i)).toBeInTheDocument()
  })

  it('keeps the failure inside the board', async () => {
    mockedApi.get.mockRejectedValue(new Error('network down'))
    renderBoard()

    expect(await screen.findByText(/could not load family feedback/i)).toBeInTheDocument()
  })
})
