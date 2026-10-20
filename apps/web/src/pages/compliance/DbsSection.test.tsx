/**
 * The DBS card on the compliance screen, tested for the two claims phase 0 of
 * `docs/DBS_INTEGRATION_PLAN.md` makes about it.
 *
 * The first is honesty about what the product does: the screen has to say that
 * MeticleCare does not submit DBS checks yet, rather than offering a Submit that
 * fails. The wording is not asserted here in the UI's own words — the component
 * renders the API's `stats.submission.message`, and the one assertion that
 * matters is that the sentence a person reads is the refusal the API would give.
 *
 * The second is what a certificate may contribute to a record: a reference, its
 * issue date, the recruitment decision and its date, a renewal marker and a note.
 * The dialog's field list is the guard against that set quietly growing a copy or
 * an image of the certificate, and the payload assertion below pins it.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DbsSectionWithCollapse } from './CompliancePage'
import { localToday } from '../../utils/dateFormat'
import api from '../../services/api'

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

/** The refusal the API gives, which the screen has to be showing. */
const NO_PARTNER_MESSAGE =
  'DBS checks cannot be submitted: this deployment has no vetting partner configured. MeticleCare does not submit checks yet — record the certificate metadata on the staff record instead.'

/** A check inside its six months, holding the permitted metadata. */
const LIVE_CHECK = {
  id: 'dbs-1',
  staff_name: 'Amina Jones',
  level: 'enhanced',
  workforce: 'adult',
  status: 'draft',
  application_reference: null,
  provider_reference: null,
  certificate_number: 'CERT-4821',
  disclosure_date: '2026-05-04',
  recruitment_decision: 'proceed',
  recruitment_decision_on: '2026-05-06',
  renewal_due_on: '2029-05-06',
  purge_after_on: '2026-11-06',
  days_until_purge: 21,
  certificate_purged_on: null,
  created_at: '2026-05-01T09:00:00.000Z',
}

/** A check whose certificate detail the retention purge has already deleted. */
const PURGED_CHECK = {
  ...LIVE_CHECK,
  id: 'dbs-2',
  staff_name: 'Pat Taylor',
  level: 'standard',
  workforce: 'child',
  status: 'clear',
  certificate_number: null,
  disclosure_date: null,
  recruitment_decision: 'proceed_with_conditions',
  recruitment_decision_on: '2025-11-20',
  renewal_due_on: null,
  purge_after_on: '2026-05-20',
  days_until_purge: -149,
  certificate_purged_on: '2026-05-21',
}

/** A check at the provider, which is the only state poll applies to. */
const SUBMITTED_CHECK = {
  ...LIVE_CHECK,
  id: 'dbs-3',
  staff_name: 'Bea Okonkwo',
  status: 'submitted',
  provider_reference: 'REF-9001',
  certificate_number: null,
  certificate_purged_on: null,
}

const CLOSED_STATS = {
  total: 3, clear: 1, in_progress: 0, awaiting_identity: 0, submitted: 1, draft: 1, cancelled: 0, error: 0,
  expiring_soon: 0, expired: 0, cost_total_pounds: 0,
  certificate_retention_months: 6,
  certificate_details_held: 1,
  certificate_details_purged: 1,
  certificate_purge_due: 1,
  submission: { available: false, message: NO_PARTNER_MESSAGE },
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DbsSectionWithCollapse expanded onToggle={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DBS section — submission is closed and it says so', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ role: 'ORG_ADMIN' }))
    mockedApi.get.mockReset()
    mockedApi.patch.mockReset()
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/dbs/checks') return { data: [LIVE_CHECK, PURGED_CHECK, SUBMITTED_CHECK] } as any
      if (url === '/dbs/checks/stats') return { data: CLOSED_STATS } as any
      return { data: [] } as any
    })
  })

  it('states that MeticleCare does not submit checks, in the API’s words', async () => {
    renderSection()

    expect(await screen.findByText('MeticleCare does not submit DBS checks yet')).toBeInTheDocument()
    // The body is the message a refused Submit returns, not a second copy of it.
    expect(screen.getByText(NO_PARTNER_MESSAGE)).toBeInTheDocument()
    // And the alternative is spelled out where the button used to be.
    expect(screen.getByText(/Record what the certificate says on the staff member's DBS record instead/)).toBeInTheDocument()
    expect(screen.getByText(/Metadata only: never a copy, a photo or a scan/)).toBeInTheDocument()
  })

  it('disables Submit and Poll with the reason on the control', async () => {
    renderSection()

    const submit = await screen.findByRole('button', { name: 'Submit to the provider (unavailable)' })
    expect(submit).toBeDisabled()
    const poll = screen.getByRole('button', { name: 'Poll the provider (unavailable)' })
    expect(poll).toBeDisabled()

    // Disabled, but never hidden: the workflow is still visible, and a tooltip on
    // a disabled control only works because it is wrapped.
    fireEvent.mouseOver(submit.parentElement as Element)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('no vetting partner configured')
    expect(mockedApi.post).not.toHaveBeenCalled()
  })
})

describe('DBS section — certificate metadata and the six-month rule', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ role: 'ORG_ADMIN' }))
    mockedApi.get.mockReset()
    mockedApi.patch.mockReset()
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/dbs/checks') return { data: [LIVE_CHECK, PURGED_CHECK, SUBMITTED_CHECK] } as any
      if (url === '/dbs/checks/stats') return { data: CLOSED_STATS } as any
      return { data: [] } as any
    })
  })

  it('shows what is still held and what the retention rule has already deleted', async () => {
    renderSection()

    // Held: the reference, the decision taken on it, and when it goes. Read per
    // row, because "Proceed" is a prefix of "Proceed with conditions" and one of
    // these rows is showing each.
    const held = (await screen.findByText('Amina Jones')).closest('tr') as HTMLElement
    expect(within(held).getByText('CERT-4821')).toBeInTheDocument()
    expect(within(held).getByText('Proceed')).toBeInTheDocument()
    expect(within(held).getByText(/Automatically deleted 6 Nov 2026/)).toBeInTheDocument()

    // Purged: an empty reference that explains itself rather than reading as
    // missing data, and the decision that outlived it.
    const purged = screen.getByText('Pat Taylor').closest('tr') as HTMLElement
    expect(within(purged).queryByText(/CERT-/)).toBeNull()
    expect(within(purged).getByText(/Details deleted 21 May 2026/)).toBeInTheDocument()
    expect(within(purged).getByText('Proceed with conditions')).toBeInTheDocument()
  })

  it('records the permitted metadata, and dates a decision recorded without a date', async () => {
    mockedApi.patch.mockResolvedValue({ data: LIVE_CHECK } as any)
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Record certificate metadata for Amina Jones' }))
    const dialog = await screen.findByRole('dialog', { name: 'Certificate metadata' })

    // What was recorded comes back into the form, so a correction is a correction
    // rather than a re-entry.
    expect(within(dialog).getByDisplayValue('CERT-4821')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('2026-05-04')).toBeInTheDocument()

    // The decision date is the retention clock, so clearing it and saving dates
    // the decision today rather than storing a decision with no date on it.
    fireEvent.change(within(dialog).getByLabelText('Decision taken on'), { target: { value: '' } })
    fireEvent.change(within(dialog).getByDisplayValue('CERT-4821'), { target: { value: 'CERT-4821-B' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save metadata' }))

    // The permitted set, and nothing else — no file, no image, no URL.
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/dbs/checks/dbs-1/certificate', {
      certificateNumber: 'CERT-4821-B',
      certificateIssuedOn: '2026-05-04',
      recruitmentDecision: 'proceed',
      recruitmentDecisionOn: localToday(),
      renewalDueOn: '2029-05-06',
      notes: null,
    }))

    // And the fields the dialog offers are exactly that set.
    const labels = ['Certificate reference', 'Certificate issued', 'Recruitment decision', 'Decision taken on', 'Reconsider on (optional)', 'Note (optional)']
    for (const label of labels) expect(within(dialog).getByLabelText(label)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/upload|photo|scan|image|copy/i)).toBeNull()
  })

  it('shows a refusal inside the dialog, where the person who typed it is looking', async () => {
    mockedApi.patch.mockRejectedValue({
      response: { data: { message: 'The recruitment decision recorded on 2025-11-20 puts this certificate’s information past its retention date (2026-05-20).' } },
    } as any)
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Record certificate metadata for Pat Taylor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Certificate metadata' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save metadata' }))

    expect(await within(dialog).findByText(/past its retention date/)).toBeInTheDocument()
    // Still open, so the message is not thrown away with the form.
    expect(screen.getByRole('dialog', { name: 'Certificate metadata' })).toBeInTheDocument()
  })
})
