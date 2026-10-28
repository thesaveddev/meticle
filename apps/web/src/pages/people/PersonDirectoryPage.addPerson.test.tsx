import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PersonDirectoryPage from './PersonDirectoryPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

vi.mock('../../context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: vi.fn() }),
}))

import api from '../../services/api'

function renderPeople() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/people']}>
        <Routes>
          <Route path="/people" element={<PersonDirectoryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/settings/org') return Promise.resolve({ data: { service_types: [] } })
    if (url === '/settings/locations') return Promise.resolve({ data: [] })
    if (url === '/people') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: {} })
  })
})

describe('PersonDirectoryPage add-person modal', () => {
  it('opens the new-person modal when Add person is clicked', async () => {
    const user = userEvent.setup()
    renderPeople()

    // The form lives in the modal now, not inline on the page.
    expect(await screen.findByRole('button', { name: /add person/i })).toBeInTheDocument()
    expect(screen.queryByText('Add a new client')).not.toBeInTheDocument()
    expect(screen.queryByText('Add New Person')).not.toBeInTheDocument()

    await user.click((await screen.findAllByRole('button', { name: /add person/i }))[0])

    expect(await screen.findByText('Add New Person')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create person/i })).toBeInTheDocument()
  })
})
