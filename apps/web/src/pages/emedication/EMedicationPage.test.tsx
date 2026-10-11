import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import EMedicationPage from './EMedicationPage'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const now = new Date()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const chartTitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()} MAR`

const PERSON = {
  id: 'p1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  date_of_birth: '1990-01-02',
  nhs_number: '1234567890',
  location_name: 'Maple House',
  status: 'active',
}

const RECORD = {
  id: 'r1',
  title: chartTitle,
  person_id: 'p1',
  person_name: 'Ada Lovelace',
  start_date: `${monthKey}-01`,
  end_date: `${monthKey}-28`,
  status: 'active',
}

beforeEach(() => {
  window.localStorage.setItem('user', JSON.stringify({ id: 'u1', first_name: 'Sam', last_name: 'Admin', role: 'ORG_ADMIN', email: 'sam@test.care' }))
  window.localStorage.setItem('accessToken', 'test-token')

  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === '/people') return { data: [PERSON] } as any
    if (url.startsWith('/emedication/records/r1/chart')) return { data: { record: RECORD, days: [`${monthKey}-01`], items: [], adminMap: {} } } as any
    if (url.startsWith('/emedication/records')) return { data: [RECORD] } as any
    if (url === '/emedication/stock') return { data: [] } as any
    if (url === '/staff/org-members') return { data: { staff: [], admins: [] } } as any
    if (url === '/emedication/overdue/count') return { data: { count: 0 } } as any
    if (url === '/emedication/overdue') return { data: [] } as any
    return { data: {} } as any
  })
  vi.mocked(api.post).mockImplementation(async () => ({ data: {} }) as any)
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/emedication']}>
        <EMedicationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openAddMedicationDialog() {
  renderPage()
  fireEvent.click(await screen.findByText('Ada Lovelace'))
  // The button renders only once the MAR chart query resolves; allow a cold-start window.
  fireEvent.click(await screen.findByRole('button', { name: 'Add Medication' }, { timeout: 5000 }))
  return screen.findByRole('dialog')
}

describe('Add Medication dialog', () => {
  it('shows the header, person summary, four numbered sections and a disabled primary action until required fields are complete', async () => {
    const dialog = await openAddMedicationDialog()

    expect(within(dialog).getByRole('heading', { name: 'Add Medication' })).toBeInTheDocument()
    expect(within(dialog).getByText("Add a new medication to the person's record")).toBeInTheDocument()
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(dialog).getByText(/NHS 1234567890/)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '1. Medication source' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '2. Medication details' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '3. Administration' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '4. Prescriber information (optional)' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add Medication' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  it('switches the medication source with an accessible pressed state', async () => {
    const dialog = await openAddMedicationDialog()
    const fromStock = within(dialog).getByRole('button', { name: /From stock/ })
    const newMedication = within(dialog).getByRole('button', { name: /New medication/ })

    expect(fromStock).toHaveAttribute('aria-pressed', 'true')
    expect(newMedication).toHaveAttribute('aria-pressed', 'false')
    expect(await within(dialog).findByText(/No stock available for Ada Lovelace/)).toBeInTheDocument()

    fireEvent.click(newMedication)

    expect(newMedication).toHaveAttribute('aria-pressed', 'true')
    expect(fromStock).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByLabelText(/Medication name/)).toBeEnabled()
  })

  it('blocks saving when the end date is before the start date', async () => {
    const dialog = await openAddMedicationDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: /New medication/ }))
    fireEvent.change(within(dialog).getByLabelText(/Medication name/), { target: { value: 'Paracetamol' } })
    fireEvent.change(within(dialog).getByLabelText(/Dosage/), { target: { value: '500' } })
    fireEvent.change(within(dialog).getByLabelText(/Start date/), { target: { value: '2026-10-10' } })
    fireEvent.change(within(dialog).getByLabelText(/End date/), { target: { value: '2026-10-01' } })

    expect(await within(dialog).findByText('End date must be on or after the start date')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add Medication' })).toBeDisabled()
  })

  it('keeps the entered data and shows the API error inside the modal when saving fails', async () => {
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url.includes('/items')) throw { response: { data: { message: 'Medication could not be saved' } } }
      return { data: {} } as any
    })
    const dialog = await openAddMedicationDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: /New medication/ }))
    fireEvent.change(within(dialog).getByLabelText(/Medication name/), { target: { value: 'Paracetamol' } })
    fireEvent.change(within(dialog).getByLabelText(/Dosage/), { target: { value: '500' } })
    // "once daily" (the default frequency) requires exactly one administration time.
    const timeInput = within(dialog).getByPlaceholderText('e.g. 08:00')
    fireEvent.change(timeInput, { target: { value: '08:00' } })
    fireEvent.keyDown(timeInput, { key: 'Enter' })

    const save = within(dialog).getByRole('button', { name: 'Add Medication' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    expect(await within(dialog).findByText('Medication could not be saved')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Medication name/)).toHaveValue('Paracetamol')
    expect(within(dialog).getByLabelText(/Dosage/)).toHaveValue('500')
    expect(within(dialog).getByRole('button', { name: 'Add Medication' })).toBeEnabled()
  })
})
