/**
 * A staff member's DBS Update Service subscription on their profile's compliance tab.
 *
 * The re-check belongs with the rest of a person's compliance evidence, and it is
 * asserted here the way a manager meets it: on the tab, for that person, read-only,
 * and only for the roles that may read DBS data at all.
 *
 * The last of those is the one that fails quietly. `/dbs/update-service` is
 * ORG_ADMIN/MANAGER only, so a care worker looking at their own profile has to be
 * shown nothing — and asked nothing — rather than being shown an error where the
 * record should be. That is asserted as an absence of the request, not an absence of
 * the panel, because a panel that renders an empty state from a 403 looks identical
 * to one that correctly found nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StaffProfilePage from './StaffProfilePage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

const MEMBER = {
  id: 'u1',
  first_name: 'Priya',
  last_name: 'Sharma',
  email: 'priya.sharma@example.com',
  status: 'active',
  staff_id: 's1',
  role: 'MANAGER',
}

const REQUIREMENT = {
  id: 'r1',
  name: 'Safeguarding Level 2',
  description: 'Annual refresher',
  status: 'complete',
  last_checked_at: '2026-08-01T00:00:00.000Z',
  expires_at: '2027-08-01T00:00:00.000Z',
}

const SUBSCRIPTION = {
  id: 'us1',
  organization_id: 'org1',
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

function renderProfile(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/staff/:userId" element={<StaffProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ id: 'boss', role: 'MANAGER' }))
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()

  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/staff/org-members') return Promise.resolve({ data: { staff: [MEMBER] } })
    if (url === `/staff/${MEMBER.id}`) {
      return Promise.resolve({ data: { first_name: 'Priya', last_name: 'Sharma', employment_type: 'full_time', location_id: null } })
    }
    if (url === `/staff/${MEMBER.id}/compliance`) {
      return Promise.resolve({
        data: { compliance_rate: 100, completed: 1, total_requirements: 1, requirements: [REQUIREMENT] },
      })
    }
    if (url === '/dbs/update-service') return Promise.resolve({ data: [SUBSCRIPTION] })
    if (url === `/dbs/update-service/${SUBSCRIPTION.id}`) {
      return Promise.resolve({ data: { ...SUBSCRIPTION, checks: [CHECK] } })
    }
    if (url.startsWith('/competency/assessments')) return Promise.resolve({ data: [] })
    if (url === '/competency/templates') return Promise.resolve({ data: [] })
    if (url === '/leave/locations') return Promise.resolve({ data: [] })
    if (url === '/settings/org') return Promise.resolve({ data: {} })
    if (url === `/permissions/${MEMBER.id}`) return Promise.resolve({ data: { permissions: [], role: 'MANAGER', role_defaults: {} } })
    return Promise.resolve({ data: {} })
  })
})

describe('the compliance tab shows the Update Service record', () => {
  it('asks for this staff member\'s subscriptions, and lists what the API returns', async () => {
    renderProfile(`/staff/${MEMBER.id}?tab=compliance`)

    // The other evidence on the tab is still there, and the re-check sits beside it.
    expect(await screen.findByText('Safeguarding Level 2')).toBeInTheDocument()
    expect(await screen.findByText('DBS Update Service')).toBeInTheDocument()

    // One person's subscriptions, not the organisation's list.
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/dbs/update-service', { params: { staffId: MEMBER.staff_id } })

    expect(screen.getByText('Enhanced certificate · Adult workforce')).toBeInTheDocument()
    expect(screen.getByText('US-770021')).toBeInTheDocument()
    expect(screen.getByText(/Next check 22 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText(/1 status check recorded/)).toBeInTheDocument()
    // Urgency is named in days rather than left to a colour, and a subscription
    // that is in date is never called late.
    expect(screen.getByText(/in 37 days/i)).toBeInTheDocument()
    expect(screen.queryByText(/overdue/i)).toBeNull()
  })

  it('opens the record read-only, with the consent it rests on and the checks recorded against it', async () => {
    renderProfile(`/staff/${MEMBER.id}?tab=compliance`)
    fireEvent.click(await screen.findByText('US-770021'))

    const dialog = await screen.findByRole('dialog', { name: 'Update Service subscription' })

    // The dialog opens before the record it will show has arrived, so the first
    // assertion waits for it.
    expect(await within(dialog).findByText('Consent')).toBeInTheDocument()
    expect(within(dialog).getByText('Given on')).toBeInTheDocument()
    expect(within(dialog).getByText('Recorded as')).toBeInTheDocument()
    // Twice, and both times it is the answer to a question an inspection asks: who
    // took the consent, and who recorded the check.
    expect(within(dialog).getAllByText('Alex Doe')).toHaveLength(2)
    expect(within(dialog).getByText('Before each check')).toBeInTheDocument()
    expect(within(dialog).getByText('Paper certificate seen')).toBeInTheDocument()
    expect(within(dialog).getByText('Document checked in person')).toBeInTheDocument()

    // The checks themselves, which are the re-check record.
    expect(within(dialog).getByText('Status checks')).toBeInTheDocument()
    expect(within(dialog).getByText('No change')).toBeInTheDocument()
    expect(within(dialog).getByText(CHECK.notes)).toBeInTheDocument()

    // Read-only: nothing here records a check, a renewal or a withdrawal.
    expect(within(dialog).queryByRole('button', { name: /record status check/i })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: /withdraw/i })).toBeNull()
    expect(vi.mocked(api.post)).not.toHaveBeenCalled()
  })

  it('shows a withdrawal as the end of checking rather than as an overdue date', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/dbs/update-service') {
        return Promise.resolve({
          data: [{
            ...SUBSCRIPTION,
            status: 'withdrawn',
            due_state: 'not_active',
            consent_withdrawn_on: '2026-02-03',
            consent_withdrawn_reason: 'No longer consents to status checks',
            days_until_check: -21,
          }],
        })
      }
      if (url === `/dbs/update-service/${SUBSCRIPTION.id}`) {
        return Promise.resolve({
          data: {
            ...SUBSCRIPTION,
            status: 'withdrawn',
            due_state: 'not_active',
            consent_withdrawn_on: '2026-02-03',
            consent_withdrawn_reason: 'No longer consents to status checks',
            checks: [],
          },
        })
      }
      if (url === '/staff/org-members') return Promise.resolve({ data: { staff: [MEMBER] } })
      if (url === `/staff/${MEMBER.id}/compliance`) return Promise.resolve({ data: { compliance_rate: 0, completed: 0, total_requirements: 0, requirements: [] } })
      if (url === `/staff/${MEMBER.id}`) return Promise.resolve({ data: { first_name: 'Priya', last_name: 'Sharma' } })
      return Promise.resolve({ data: [] })
    })

    renderProfile(`/staff/${MEMBER.id}?tab=compliance`)

    expect(await screen.findByText('Not active')).toBeInTheDocument()
    expect(screen.queryByText(/overdue/i)).toBeNull()

    fireEvent.click(screen.getByText('US-770021'))
    const dialog = await screen.findByRole('dialog', { name: 'Update Service subscription' })
    expect(await within(dialog).findByText(/Consent was withdrawn on 3 Feb 2026 — No longer consents to status checks/)).toBeInTheDocument()
    expect(within(dialog).getByText('No status checks recorded yet.')).toBeInTheDocument()
  })

  it('says so, and where to record one, when nothing is recorded for the person', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/dbs/update-service') return Promise.resolve({ data: [] })
      if (url === '/staff/org-members') return Promise.resolve({ data: { staff: [MEMBER] } })
      if (url === `/staff/${MEMBER.id}/compliance`) return Promise.resolve({ data: { compliance_rate: 0, completed: 0, total_requirements: 0, requirements: [] } })
      if (url === `/staff/${MEMBER.id}`) return Promise.resolve({ data: { first_name: 'Priya', last_name: 'Sharma' } })
      return Promise.resolve({ data: [] })
    })

    renderProfile(`/staff/${MEMBER.id}?tab=compliance`)

    expect(await screen.findByText('No DBS Update Service subscription is recorded for this member of staff.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record one on the compliance page' })).toBeInTheDocument()
  })

  /**
   * A link the compliance page hands over opens the subscription, not the person.
   *
   * `/staff/<id>?tab=compliance&record=<subscriptionId>` is what the compliance
   * page's Update Service row — and the reminder that carries the same target —
   * sends a manager. The subscription is neither a compliance requirement nor a
   * competency assessment, so the page's own record lookup does not know it; the
   * panel does, and without this the parameter would be silently ignored, which
   * looks exactly like a link that worked.
   */
  it('opens the subscription a record link names', async () => {
    renderProfile(`/staff/${MEMBER.id}?tab=compliance&record=${SUBSCRIPTION.id}`)

    const dialog = await screen.findByRole('dialog', { name: 'Update Service subscription' })
    expect(await within(dialog).findByText('Consent')).toBeInTheDocument()
    expect(within(dialog).getByText('Status checks')).toBeInTheDocument()
    // Opened by a link, so read-only: the acts stay on the compliance page.
    expect(within(dialog).queryByRole('button', { name: /record status check/i })).toBeNull()
  })

  it('ignores a record id that is not this person\'s subscription', async () => {
    renderProfile(`/staff/${MEMBER.id}?tab=compliance&record=not-a-subscription`)

    expect(await screen.findByText('US-770021')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not ask for DBS data on behalf of a care worker looking at their own profile', async () => {
    localStorage.setItem('user', JSON.stringify({ id: MEMBER.id, role: 'CARE_WORKER' }))

    renderProfile(`/staff/${MEMBER.id}?tab=compliance`)

    expect(await screen.findByText('Safeguarding Level 2')).toBeInTheDocument()
    // Nothing is rendered, and — the half that matters — nothing was requested:
    // `/dbs/update-service` is a manager's route, and a 403 would have looked like
    // an empty record here.
    expect(screen.queryByText('DBS Update Service')).toBeNull()
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === '/dbs/update-service')).toBe(false)
  })
})
