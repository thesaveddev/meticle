import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import StaffProfilePage from './StaffProfilePage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The deep link a compliance email hands over:
 * `/staff/<staffId>?tab=compliance&record=<recordId>`.
 *
 * The link has to do two things, and each has its own way of failing quietly:
 *
 *   1. **Land on the right tab.** `/staff/:userId` is a real route, so a link with
 *      the wrong slug opens the profile on Overview — the manager follows a
 *      document-expiry email and sees a phone number.
 *   2. **Open the record, not the person.** The id has to be found among the rows
 *      that tab renders. A parameter the page ignores looks exactly like a link that
 *      worked, which is why the dialog is asserted on text only the dialog renders:
 *      the row behind it shows the name, the status and the expiry date too.
 *
 * Closing is asserted through the URL, because that is the half a reader cannot see:
 * dropping the id is what stops a reload — or a Back from the next page — re-opening
 * a record that has already been read. The tab stays, because it is where the reader
 * is.
 */
const MEMBER = {
  id: 'u1',
  first_name: 'Priya',
  last_name: 'Sharma',
  email: 'priya.sharma@example.com',
  status: 'active',
  staff_id: 's1',
  role: 'MANAGER',
}

const EXPIRING_REQUIREMENT = {
  id: 'r1',
  name: 'Safeguarding Level 2',
  description: 'Annual refresher',
  status: 'expired',
  last_checked_at: '2026-01-05T00:00:00.000Z',
  expires_at: '2026-09-01T00:00:00.000Z',
  notes: 'Notes only the dialog shows',
  file_url: 'https://files.example.com/certificate.pdf',
}

const CURRENT_REQUIREMENT = {
  id: 'r2',
  name: 'Fire Safety',
  description: 'Induction',
  status: 'complete',
  last_checked_at: '2026-08-01T00:00:00.000Z',
  expires_at: '2027-08-01T00:00:00.000Z',
}

const ASSESSMENT = {
  id: 'a1',
  template_name: 'Moving and handling',
  template_category: 'Manual handling',
  passed: true,
  assessed_at: '2026-10-01T00:00:00.000Z',
  assessor_first_name: 'Alex',
  assessor_last_name: 'Doe',
}

/** Prints the current query string, so the URL is assertable from a MemoryRouter. */
function SearchProbe() {
  const location = useLocation()
  return <div data-testid="search">{location.search}</div>
}

function renderStaff(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/staff/:userId"
            element={<><StaffProfilePage /><SearchProbe /></>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  // The page reads the viewer's own role for what it may edit and show (the Access
  // tab), so the reader is a manager looking at someone else's profile.
  localStorage.setItem('user', JSON.stringify({ id: 'boss', role: 'MANAGER' }))

  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/staff/org-members') return Promise.resolve({ data: { staff: [MEMBER] } })
    if (url === `/staff/${MEMBER.id}`) {
      return Promise.resolve({
        data: { first_name: 'Priya', last_name: 'Sharma', employment_type: 'full_time', location_id: null },
      })
    }
    if (url === `/staff/${MEMBER.id}/compliance`) {
      return Promise.resolve({
        data: {
          compliance_rate: 50,
          completed: 1,
          total_requirements: 2,
          requirements: [EXPIRING_REQUIREMENT, CURRENT_REQUIREMENT],
        },
      })
    }
    if (url.startsWith('/competency/assessments')) return Promise.resolve({ data: [ASSESSMENT] })
    if (url === '/competency/templates') return Promise.resolve({ data: [] })
    if (url === '/leave/locations') return Promise.resolve({ data: [] })
    if (url === '/settings/org') return Promise.resolve({ data: {} })
    if (url === `/permissions/${MEMBER.id}`) {
      return Promise.resolve({ data: { permissions: [], role: 'MANAGER', role_defaults: {} } })
    }
    return Promise.resolve({ data: {} })
  })
})

describe('StaffProfilePage deep links', () => {
  it('opens the compliance tab the link names', async () => {
    renderStaff(`/staff/${MEMBER.id}?tab=compliance`)

    expect(await screen.findByText('Safeguarding Level 2')).toBeInTheDocument()
    // The tab it would otherwise have opened on is not the one on screen.
    expect(screen.queryByText('Profile details')).not.toBeInTheDocument()
  })

  it('opens the record the link names, read-only, with its document', async () => {
    renderStaff(`/staff/${MEMBER.id}?tab=compliance&record=${EXPIRING_REQUIREMENT.id}`)

    // Only the dialog renders the notes and the openable document.
    expect(await screen.findByText('Notes only the dialog shows')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open document/i })).toHaveAttribute(
      'href',
      EXPIRING_REQUIREMENT.file_url,
    )
    // Read-only: the record was opened by a link, and a link does not edit. Its
    // button is the dialog's own — the row behind it has one too.
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('drops the record parameter when the record is closed, and keeps the tab', async () => {
    renderStaff(`/staff/${MEMBER.id}?tab=compliance&record=${EXPIRING_REQUIREMENT.id}`)
    await screen.findByText('Notes only the dialog shows')

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).not.toContain('record=')
    })
    // The tab is where the reader is, so it stays.
    expect(screen.getByTestId('search').textContent).toContain('tab=compliance')
    expect(screen.queryByText('Notes only the dialog shows')).not.toBeInTheDocument()
  })

  it('opens a competency assessment on its own tab, since that is where it is listed', async () => {
    renderStaff(`/staff/${MEMBER.id}?tab=compliance&record=${ASSESSMENT.id}`)

    expect(await screen.findByText('Moving and handling')).toBeInTheDocument()
  })

  it('opens no record when the link names none', async () => {
    renderStaff(`/staff/${MEMBER.id}`)

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.queryByText('Notes only the dialog shows')).not.toBeInTheDocument()
  })
})
