import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationRetentionCard from './LocationRetentionCard'
import api from '../services/api'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const mockedApi = vi.mocked(api)

/** The snackbar, which the card uses for every outcome. */
vi.mock('../context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: vi.fn() }),
}))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LocationRetentionCard /></QueryClientProvider>)
}

const summary = (overrides: Record<string, unknown> = {}) => ({
  data: {
    retention_days: null,
    configured_at: null,
    configured_by_name: null,
    is_configured: false,
    positions_stored: 41382,
    oldest_position_at: '2025-07-01T09:00:00.000Z',
    next_deletion_due_at: null,
    tracking_enabled: true,
    unconfigured_warning:
      'No retention period set. 41,382 carer positions are being held with no deletion date. ' +
      'The oldest is from 1 Jul 2025. Set a period or switch collection off.',
    ...overrides,
  },
})

const configured = () => summary({
  retention_days: 90,
  configured_at: '2026-01-15T10:00:00.000Z',
  configured_by_name: 'Alex Admin',
  is_configured: true,
  unconfigured_warning: null,
  next_deletion_due_at: '2026-10-01T00:00:00.000Z',
})

const noRuns = { data: { runs: [] } }

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url.includes('/runs')) return noRuns as any
    return summary() as any
  })
})

describe('the retention card makes the unconfigured state impossible to miss', () => {
  it('shows the warning in the server\'s own words, with the numbers in it', async () => {
    renderCard()
    const warning = await screen.findByTestId('retention-unconfigured')
    // Verbatim from the server rather than assembled here, so there is one
    // sentence that has to be true and it lives in one place. "No retention
    // period set" without the count is the thing people scroll past.
    expect(warning).toHaveTextContent('41,382 carer positions are being held with no deletion date')
    expect(screen.getByText('No period set')).toBeInTheDocument()
  })

  it('does not claim a period is being enforced when none is set', async () => {
    renderCard()
    await screen.findByTestId('location-retention-card')
    // "Set a period and it is enforced" reads to a manager like "it is
    // enforced", and the cost of assuming that is a provider who believes their
    // positions are being deleted when they are not.
    expect(screen.queryByText(/\d+ days/)).not.toBeInTheDocument()
    expect(screen.getByText('41,382 positions held')).toBeInTheDocument()
  })

  it('hides the warning once a period is set, and names who set it', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) return noRuns as any
      return configured() as any
    })
    renderCard()
    await screen.findByTestId('location-retention-card')
    expect(screen.queryByTestId('retention-unconfigured')).not.toBeInTheDocument()
    expect(screen.getByText(/Set by Alex Admin/)).toBeInTheDocument()
    expect(screen.getByText(/the next is due from/)).toBeInTheDocument()
  })

  it('says the card could not be read rather than showing a blank policy', async () => {
    mockedApi.get.mockRejectedValue(new Error('down'))
    renderCard()
    await screen.findByText(/This could not be loaded/)
    // Failing to a warning, not to an empty field: a card that renders blank
    // looks exactly like a provider with nothing set and nothing held.
    expect(screen.queryByTestId('retention-unconfigured')).not.toBeInTheDocument()
  })
})

describe('setting a period', () => {
  it('says plainly that setting it deletes nothing', async () => {
    renderCard()
    await screen.findByTestId('location-retention-card')
    expect(screen.getByText(/Setting this does not delete anything/)).toBeInTheDocument()
    // Typing 1 instead of 365 is a keystroke, and a decade of attendance should
    // not be the consequence of it.
    expect(screen.getByRole('button', { name: /Set period/ })).toBeInTheDocument()
  })

  it('refuses a period that is not a whole number of days in range', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) return noRuns as any
      return configured() as any
    })
    mockedApi.put.mockResolvedValue({ data: configured() } as any)
    renderCard()
    await screen.findByTestId('location-retention-card')
    // Zero is the dangerous one: it looks like "no period" and would mean
    // "delete everything immediately" to anything that read it as a number.
    await userEvent.type(screen.getByLabelText(/Keep for \(days\)/), '0')
    await userEvent.click(screen.getByRole('button', { name: /Change period/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Change period/ })).toBeEnabled())
    expect(mockedApi.put).not.toHaveBeenCalled()
  })

  it('sends a valid period as a number of days', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) return noRuns as any
      return configured() as any
    })
    mockedApi.put.mockResolvedValue({ data: configured() } as any)
    renderCard()
    await screen.findByTestId('location-retention-card')
    await userEvent.type(screen.getByLabelText(/Keep for \(days\)/), '90')
    await userEvent.click(screen.getByRole('button', { name: /Change period/ }))
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/homecare/settings/location-retention', { retention_days: 90 }))
  })

  it('offers removing the period as a normal action, not a hidden one', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) return noRuns as any
      return configured() as any
    })
    mockedApi.delete.mockResolvedValue({ data: summary() } as any)
    renderCard()
    await screen.findByTestId('location-retention-card')
    await userEvent.click(screen.getByRole('button', { name: /Remove period/ }))
    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/homecare/settings/location-retention'))
  })
})

describe('deleting is confirmed, and says what it will do', () => {
  it('does not delete all carer location on one click', async () => {
    renderCard()
    await screen.findByTestId('location-retention-card')
    await userEvent.click(screen.getByRole('button', { name: /Delete all carer location/ }))
    expect(await screen.findByTestId('retention-confirm-delete')).toBeInTheDocument()
    // The confirmation is where the count and the scope belong, not on a button
    // a manager is aiming at while thinking about the future. The count also
    // appears in the card behind it, hence the plural.
    expect(screen.getAllByText(/41,382/).length).toBeGreaterThan(0)
    expect(screen.getByText(/audit log/)).toBeInTheDocument()
    expect(mockedApi.post).not.toHaveBeenCalled()
  })

  it('states that visits, timesheets and pay survive, before the click', async () => {
    renderCard()
    await screen.findByTestId('location-retention-card')
    await userEvent.click(screen.getByRole('button', { name: /Delete all carer location/ }))
    await screen.findByTestId('retention-confirm-delete')
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument()
    expect(screen.getAllByText(/Visits, timesheets and pay are not affected/).length).toBeGreaterThan(0)
  })

  it('cannot offer to apply a period when there is not one', async () => {
    renderCard()
    await screen.findByTestId('location-retention-card')
    // "Run the deletion now" enforces the configured period. With no period
    // there is nothing to enforce, and offering the button would be offering an
    // error.
    expect(screen.getByRole('button', { name: /Run the deletion now/ })).toBeDisabled()
  })

  it('runs the configured period when one exists', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) return noRuns as any
      return configured() as any
    })
    mockedApi.post.mockResolvedValue({ data: { run: { positions_removed: 12 }, remaining: { positions_stored: 0 } } } as any)
    renderCard()
    await screen.findByTestId('location-retention-card')
    await userEvent.click(screen.getByRole('button', { name: /Run the deletion now/ }))
    await userEvent.click(await screen.findByTestId('retention-confirm-delete'))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/homecare/settings/location-retention/run', { all: false }))
  })
})

describe('the deletion history', () => {
  it('lists runs that removed nothing, and says why that is shown', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) {
        return {
          data: {
            runs: [
              {
                id: 'r1', trigger: 'scheduled', retention_days: 90,
                cutoff: '2026-09-01T00:00:00.000Z', visit_rows_updated: 0, positions_removed: 0,
                audit_rows_cleaned: 0, mobile_check_ins_deleted: 0,
                triggered_by_name: null, started_at: '2026-09-29T02:00:00.000Z',
              },
            ],
          },
        } as any
      }
      return configured() as any
    })
    renderCard()
    await screen.findByTestId('retention-run-r1')
    expect(screen.getByText('Nightly job')).toBeInTheDocument()
    // A run that found zero is the evidence the rule is holding. Omitting it
    // would make the headline total impossible to reconcile.
    expect(screen.getByText(/evidence/)).toBeInTheDocument()
  })

  it('names what caused a run and who caused it', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) {
        return {
          data: {
            runs: [
              {
                id: 'r2', trigger: 'switch_off', retention_days: null,
                cutoff: '2026-09-29T10:00:00.000Z', visit_rows_updated: 7, positions_removed: 9,
                audit_rows_cleaned: 6, mobile_check_ins_deleted: 2,
                triggered_by_name: 'Alex Admin', started_at: '2026-09-29T10:00:01.000Z',
              },
            ],
          },
        } as any
      }
      return configured() as any
    })
    renderCard()
    await screen.findByTestId('retention-run-r2')
    expect(screen.getByText(/When collection was switched off/)).toBeInTheDocument()
    // Also named in the "set by" caption above the table, hence the plural.
    expect(screen.getAllByText(/Alex Admin/).length).toBeGreaterThan(0)
    expect(screen.getByText('Everything')).toBeInTheDocument()
  })

  it('shows all three stores being cleaned, so a partial purge would be visible', async () => {
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/runs')) {
        return {
          data: {
            runs: [
              {
                id: 'r3', trigger: 'manual', retention_days: 30,
                cutoff: '2026-08-30T00:00:00.000Z', visit_rows_updated: 5, positions_removed: 8,
                audit_rows_cleaned: 4, mobile_check_ins_deleted: 1,
                triggered_by_name: 'Sam Manager', started_at: '2026-08-31T09:00:00.000Z',
              },
            ],
          },
        } as any
      }
      return configured() as any
    })
    renderCard()
    await screen.findByTestId('location-retention-card')
    expect(screen.getByText('Visit rows')).toBeInTheDocument()
    expect(screen.getByText('Audit copies cleaned')).toBeInTheDocument()
    expect(screen.getByText('Check-ins deleted')).toBeInTheDocument()
  })
})
