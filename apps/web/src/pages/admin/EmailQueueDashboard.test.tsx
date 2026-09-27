/**
 * The email-queue dashboard is the only view an owner has of mail that never
 * arrived, so the failure *breakdown* is the part that matters: it answers
 * "whose problem is this?" instead of printing a wall of raw SMTP strings.
 *
 * This renders the page against a fixed response and asserts the breakdown
 * reaches the screen, including the line that escalates the failures we can fix
 * ourselves. The classification rules themselves are tested on the API side;
 * what is fragile here is the wiring — a renamed response field, or a panel
 * added but never rendered, would both leave this page quietly useless.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import api from '../../services/api'
import EmailQueueDashboard from './EmailQueueDashboard'

const STATS = {
  counts: { sent: 900, failed: 4, pending: 2, sending: 0 },
  total: 906,
  recentFailures: [
    {
      id: 'f1', to_email: 'alice@example.com', subject: 'Password reset',
      error_message: 'EENVELOPE: No recipients defined',
      retry_count: 3, max_retries: 3, created_at: new Date().toISOString(), sent_at: null,
      cause: 'envelope', owner: 'code', label: 'Malformed message envelope', retryable: false,
    },
    {
      id: 'f2', to_email: 'gone@example.com', subject: 'Invoice 1042',
      error_message: 'Message failed: 550 5.1.1 <gone@example.com>: User unknown',
      retry_count: 3, max_retries: 3, created_at: new Date().toISOString(), sent_at: null,
      cause: 'address', owner: 'recipient', label: 'Recipient address does not exist', retryable: false,
    },
  ],
  hourlyTrend: [{ hour: new Date().toISOString(), status: 'failed', count: 4 }],
  topRecipients: [],
  failureBreakdown: [
    { cause: 'address', owner: 'recipient', label: 'Recipient address does not exist or refuses mail', retryable: false, count: 3 },
    { cause: 'envelope', owner: 'code', label: 'Malformed message envelope — a defect in how we build the email', retryable: false, count: 1 },
  ],
  failureSummary: { total: 4, analysed: 4, truncated: false, ours: 1, worthRetrying: 0, needsReading: 0 },
}

function renderDashboard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <EmailQueueDashboard />
    </ThemeProvider>,
  )
}

describe('EmailQueueDashboard failure breakdown', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: STATS } as never)
  })

  it('groups the failures by cause and names who owns each', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Why deliveries failed')).toBeInTheDocument()
    })
    expect(screen.getByText(/Recipient address does not exist or refuses mail/)).toBeInTheDocument()
    expect(screen.getByText(/Malformed message envelope/)).toBeInTheDocument()
  })

  it('escalates the failures that are ours rather than the recipient’s', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('1 of these are ours to fix')).toBeInTheDocument()
    })
  })

  it('says so when the breakdown could not cover every failure', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...STATS, failureSummary: { ...STATS.failureSummary, total: 2500, analysed: 2000, truncated: true } },
    } as never)
    renderDashboard()

    // A truncated breakdown that looks complete is worse than none, because
    // the numbers read as totals.
    await waitFor(() => {
      expect(screen.getByText(/Showing 2000 of 2500 failures/)).toBeInTheDocument()
    })
  })

  it('labels each row with the cause so a wall of SMTP text is not the only clue', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('our code').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('recipient').length).toBeGreaterThan(0)
  })
})
