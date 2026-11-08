import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
    if (url === '/settings/locations') return Promise.resolve({ data: [{ id: 'loc-1', name: 'Oak House' }] })
    if (url === '/people') return Promise.resolve({ data: [] })
    if (url === '/tasks') return Promise.resolve({ data: [] })
    return Promise.resolve({ data: {} })
  })
  vi.mocked(api.post).mockResolvedValue({ data: { id: 'p-1' } })
})

describe('PersonDirectoryPage add-person wizard', () => {
  it('walks the three steps and creates the person', async () => {
    const user = userEvent.setup()
    renderPeople()

    await user.click((await screen.findAllByRole('button', { name: /add person/i }))[0])
    expect(await screen.findByText('Add a person')).toBeInTheDocument()

    // Step 1 blocks an empty continue with the needs-attention banner.
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/need.*your attention/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/first name/i), 'Daniel')
    await user.type(screen.getByLabelText(/last name/i), 'Price')
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '1986-03-03' } })
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/where they'll live/i)).toBeInTheDocument()

    // Step 2 requires a location.
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/need.*your attention/)).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByLabelText(/location/i))
    await user.click(await screen.findByRole('option', { name: 'Oak House' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/health & contacts/i)).toBeInTheDocument()

    // Step 3 submits; step-3 fields are all optional.
    await user.click(screen.getByRole('button', { name: /^add person$/i }))
    expect(api.post).toHaveBeenCalledWith('/people', expect.objectContaining({
      first_name: 'Daniel',
      last_name: 'Price',
      status: 'active',
      location_id: 'loc-1',
    }))
  })
})
