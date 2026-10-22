import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FamilyFeedbackBoard from './FamilyFeedbackBoard'
import HomecarePage from './HomecarePage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))

const mockedApi = vi.mocked(api)

const payload = {
  feedback: [
    {
      id: 'fb-1', visit_id: 'v-1', person_id: 'p-1',
      family_member_name: 'Sarah Ellis', relationship: 'Daughter',
      overall_rating: 5, care_quality_rating: 5, communication_rating: 4, punctuality_rating: null,
      feedback_text: 'Nia was kind and unhurried with Mum.',
      would_recommend: true,
      submitted_at: '2026-10-19T10:30:00.000Z',
      visit_label: 'Morning call', scheduled_start: '2026-10-19T09:00:00.000Z',
      carer_name: 'Nia Okafor', person_first_name: 'Margaret', person_last_name: 'Ellis',
    },
  ],
  stats: { total_feedback: 1, avg_overall: 5, avg_care_quality: 5, avg_communication: 4, avg_punctuality: null, would_recommend_count: 1 },
}

/** Shows the URL the page is actually on, so dropping a parameter is observable. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="url">{location.search}</div>
}

function renderBoard(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/homecare" element={<><FamilyFeedbackBoard /><LocationProbe /></>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

function renderPage(initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/homecare" element={<HomecarePage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedApi.get.mockReset()
  localStorage.clear()
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/family-feedback') return Promise.resolve({ data: payload })
    return Promise.resolve({ data: [] })
  })
})

describe('FamilyFeedbackBoard deep links', () => {
  it('opens the submission a link names, in the dialog a card opens', async () => {
    renderBoard('/homecare?tab=feedback&feedback=fb-1')

    // The card names the client; only the dialog carries the recommend chip and
    // the quoted comment together, which is what makes this dialog-only.
    expect(await screen.findByText('Margaret Ellis')).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Nia was kind and unhurried/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Would recommend/)).toBeInTheDocument()
  })

  it('opens nothing when the link names feedback this caller cannot see', async () => {
    renderBoard('/homecare?tab=feedback&feedback=missing')

    expect(await screen.findByText('Margaret Ellis')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('drops the link when the reading is closed, so a reload cannot reopen it', async () => {
    renderBoard('/homecare?tab=feedback&feedback=fb-1')
    await screen.findByRole('dialog')
    expect(screen.getByTestId('url').textContent).toBe('?tab=feedback&feedback=fb-1')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Only `feedback` is dropped: `tab` still says where the manager came from.
    expect(screen.getByTestId('url').textContent).toBe('?tab=feedback')
  })
})

describe('HomecarePage feedback tab routing', () => {
  it('a manager following a feedback link lands on the feedback board', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'manager-1', role: 'MANAGER' }))
    renderPage('/homecare?tab=feedback')

    expect(await screen.findByText('Margaret Ellis')).toBeInTheDocument()
    expect(screen.getByText('Submissions')).toBeInTheDocument()
  })

  it('a carer following a feedback link stays on their own visits', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'carer-1', role: 'CARE_WORKER' }))
    renderPage('/homecare?tab=feedback')

    expect(await screen.findByText(/no visits in this view/i)).toBeInTheDocument()
    expect(screen.queryByText('Margaret Ellis')).not.toBeInTheDocument()
  })
})
