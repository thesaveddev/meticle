/**
 * The compliance page's own view of one Update Service subscription.
 *
 * Its read-only half — the consent, the two things DBS requires before a check, the
 * certificate and the checks recorded against it — was moved into
 * `components/UpdateServiceRecord.tsx` so a staff member's profile can show the same
 * record. This file is the other end of that move: it pins the compliance page's
 * dialog to the shared record, which is the surface no other test covers, and pins
 * that the acts stay here — a status check is recorded from this list and from
 * nowhere else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { UpdateServiceSectionWithCollapse } from './CompliancePage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

const SUBSCRIPTION = {
  id: 'us1',
  staff_id: 's1',
  staff_user_id: 'u1',
  staff_name: 'Priya Sharma',
  staff_email: 'priya.sharma@example.com',
  level: 'enhanced',
  workforce: 'adult',
  update_service_id: 'US-770021',
  certificate_reference: 'CERT-4821',
  certificate_issued_on: '2025-11-20',
  consent_given_on: '2025-11-22',
  consent_method: 'written',
  consent_recorded_by_name: 'Alex Doe',
  paper_certificate_seen_on: '2025-11-22',
  identity_verified_on: '2025-11-22',
  identity_method: 'manual_document_check',
  check_interval_months: 12,
  next_check_due_on: '2026-11-22',
  days_until_check: 37,
  last_checked_on: '2025-11-22',
  renewal_due_on: null,
  renewal_completed_on: null,
  renewal_note: null,
  consent_withdrawn_on: null,
  consent_withdrawn_reason: null,
  status: 'active',
  checks_recorded: 1,
  due_state: 'current',
}

const CHECK = {
  id: 'c1',
  checked_on: '2025-11-22',
  outcome: 'no_change',
  level: 'enhanced',
  workforce: 'adult',
  checked_by_name: 'Alex Doe',
  notes: 'Status shown as unchanged on the Update Service',
  next_check_due_on: '2026-11-22',
}

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <UpdateServiceSectionWithCollapse expanded onToggle={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'boss', role: 'MANAGER' }))
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/dbs/update-service') return Promise.resolve({ data: [SUBSCRIPTION] })
    if (url === '/dbs/update-service/stats') {
      return Promise.resolve({
        data: { total: 1, active: 1, due_soon: 0, overdue: 0, withdrawn: 0, renewals_due: 0, checks_last_30_days: 1, changes_found: 0 },
      })
    }
    if (url === `/dbs/update-service/${SUBSCRIPTION.id}`) {
      return Promise.resolve({ data: { ...SUBSCRIPTION, checks: [CHECK] } })
    }
    if (url === '/staff/org-members') return Promise.resolve({ data: { staff: [] } })
    return Promise.resolve({ data: [] })
  })
})

describe('the compliance page still administers the subscription', () => {
  /**
   * The record belongs to a person, so the row reaches that person's own record.
   *
   * `/staff/<userId>?tab=compliance&record=<subscriptionId>` is the same target the
   * Update Service reminder and the document reminders use — one helper
   * (`utils/staffRecordLink.ts`), so the four surfaces cannot send a manager to four
   * places. The id in it is the *user* id: the row carries `staff_id` too, and a
   * profile id in this URL answers 404, which is a link that reads exactly like one
   * that worked.
   */
  it('links the staff member to their own record rather than the compliance page', async () => {
    renderSection()

    const link = await screen.findByRole('link', { name: 'Priya Sharma' })
    expect(link).toHaveAttribute('href', `/staff/${SUBSCRIPTION.staff_user_id}?tab=compliance&record=${SUBSCRIPTION.id}`)
    // The row's own click is the read-only record here, so the link has to stop it.
    fireEvent.click(link)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a name without a link when the row carries no user id', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/dbs/update-service') return Promise.resolve({ data: [{ ...SUBSCRIPTION, staff_user_id: null }] })
      if (url === '/dbs/update-service/stats') {
        return Promise.resolve({
          data: { total: 1, active: 1, due_soon: 0, overdue: 0, withdrawn: 0, renewals_due: 0, checks_last_30_days: 1, changes_found: 0 },
        })
      }
      return Promise.resolve({ data: [] })
    })
    renderSection()

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument()
    // A guessed id would be a link to nobody; the name is text instead.
    expect(screen.queryByRole('link', { name: 'Priya Sharma' })).not.toBeInTheDocument()
  })

  it('lists the subscription with its reference and how soon the check is due', async () => {
    renderSection()

    expect(await screen.findByText('US-770021')).toBeInTheDocument()
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.getByText(/in 37 days/i)).toBeInTheDocument()
  })

  it('opens the shared read-only record, with the acts to check, renew and withdraw', async () => {
    renderSection()
    fireEvent.click(await screen.findByText('US-770021'))

    const dialog = await screen.findByRole('dialog', { name: /Priya Sharma/ })

    // The record itself, which is now rendered by `components/UpdateServiceRecord`.
    expect(await within(dialog).findByText('Consent')).toBeInTheDocument()
    expect(within(dialog).getByText('Before each check')).toBeInTheDocument()
    expect(within(dialog).getByText('Status checks')).toBeInTheDocument()
    expect(within(dialog).getByText('No change')).toBeInTheDocument()
    expect(within(dialog).getByText(CHECK.notes)).toBeInTheDocument()

    // And the acts, which this screen keeps: a check, a renewal and a withdrawal.
    expect(within(dialog).getByRole('button', { name: 'Record status check' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Set renewal date' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Complete renewal' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Withdraw consent' })).toBeInTheDocument()
  })
})
