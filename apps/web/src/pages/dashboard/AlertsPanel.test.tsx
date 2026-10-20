/**
 * The dashboard's right-rail reminders, and where each one sends the reader.
 *
 * A reminder is only worth the space it takes if the click lands on the thing it is
 * about. The background-check reminder used to be a bare count that opened the
 * compliance page, where a manager had to find the person again; it now names the
 * earliest expiring check and opens that staff member's own record — the same target
 * the document-expiry email in the inbox carries. The count and the named staff come
 * from one endpoint, so the number above the reminder and the record behind it cannot
 * disagree, and the fallback is the staff directory rather than a page that cannot
 * show the check at all.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AlertsPanel } from './DailyOverview'

/** Prints the current location, so a navigation is assertable from a MemoryRouter. */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function widgets(overrides: Record<string, unknown> = {}) {
  return {
    overdue_medications: 0,
    open_severe_incidents: 0,
    dbs_expiring_soon: 0,
    training_expiring_soon: 0,
    competency_due: 0,
    staff_below_threshold: 0,
    pending_leave_requests: 0,
    ...overrides,
  } as any
}

const NAMED_CHECK = {
  document_id: 'doc-1',
  staff_user_id: 'u1',
  staff_name: 'Nadia Khan',
  document_type: 'DBS',
  expires_on: '2026-10-23',
  days_until: 6,
}

function renderPanel(data: any) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="*" element={<><AlertsPanel widgets={data} loading={false} error={false} onRetry={() => {}} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AlertsPanel — the background-check reminder', () => {
  it('names the check that expires and opens that staff record, not the compliance page', async () => {
    renderPanel(widgets({ dbs_expiring_soon: 1, dbs_expiring_staff: [NAMED_CHECK] }))

    expect(screen.getByText("Nadia Khan's DBS expires in 6 days")).toBeInTheDocument()
    expect(screen.getByText('Open the record to check it or renew it')).toBeInTheDocument()

    fireEvent.click(screen.getByText("Nadia Khan's DBS expires in 6 days"))
    expect(screen.getByTestId('location').textContent).toBe('/staff/u1?tab=compliance&record=doc-1')
  })

  it('names the earliest when several are expiring, and opens that one', async () => {
    renderPanel(widgets({
      dbs_expiring_soon: 3,
      dbs_expiring_staff: [
        NAMED_CHECK,
        { ...NAMED_CHECK, document_id: 'doc-2', staff_user_id: 'u2', staff_name: 'Tom Abara', days_until: 19 },
        { ...NAMED_CHECK, document_id: 'doc-3', staff_user_id: 'u3', staff_name: 'Alex Reed', days_until: 27 },
      ],
    }))

    expect(screen.getByText('3 background checks expiring')).toBeInTheDocument()
    expect(screen.getByText('Earliest: Nadia Khan, expires in 6 days')).toBeInTheDocument()

    fireEvent.click(screen.getByText('3 background checks expiring'))
    expect(screen.getByTestId('location').textContent).toBe('/staff/u1?tab=compliance&record=doc-1')
  })

  it('says "expires today" rather than "in 0 days"', async () => {
    renderPanel(widgets({ dbs_expiring_soon: 1, dbs_expiring_staff: [{ ...NAMED_CHECK, days_until: 0 }] }))

    expect(screen.getByText("Nadia Khan's DBS expires today")).toBeInTheDocument()
  })

  it('opens the staff directory when a count arrives without the staff behind it', async () => {
    renderPanel(widgets({ dbs_expiring_soon: 2 }))

    // The count is real and the reminder stays; the destination is where staff
    // records live, never a compliance page the reader would have to search.
    expect(screen.getByText('2 background checks expiring')).toBeInTheDocument()
    fireEvent.click(screen.getByText('2 background checks expiring'))
    expect(screen.getByTestId('location').textContent).toBe('/staff')
  })

  it('stays quiet when nothing is expiring', () => {
    renderPanel(widgets())

    expect(screen.getByText('Nothing needs attention. Everything is up to date.')).toBeInTheDocument()
  })
})
