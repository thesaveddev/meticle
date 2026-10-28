import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CustomReportBuilderPage from './CustomReportBuilderPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../components/charts', () => ({
  StatCard: ({ label, value }: { label: string; value: string | number }) => <div>{label}: {String(value)}</div>,
  BarChart: () => <div>bar-chart</div>,
  PieChart: () => <div>pie-chart</div>,
  LineChart: () => <div>line-chart</div>,
  AreaChart: () => <div>area-chart</div>,
  RadarChart: () => <div>radar-chart</div>,
  ReportTable: ({ title, rows }: { title: string; rows: Record<string, any>[] }) => (
    <div>{title}{rows.map((r, i) => <div key={i}>{Object.values(r).join(' | ')}</div>)}</div>
  ),
}))

import api from '../../services/api'

const DATASETS = [
  {
    id: 'staff',
    label: 'Staff',
    description: 'One row per staff profile.',
    columns: [
      { key: 'first_name', label: 'First name', type: 'text', aggregatable: false },
      { key: 'last_name', label: 'Last name', type: 'text', aggregatable: false },
      { key: 'role', label: 'Role', type: 'text', aggregatable: false },
    ],
  },
]

const RUN_RESULT = {
  report: { id: 'custom:staff', title: 'Staff', category: 'custom', generatedAt: new Date().toISOString() },
  summary: { cards: [{ label: 'Records', value: 2 }] },
  series: [],
  table: {
    columns: [
      { key: 'first_name', label: 'First name', type: 'text' },
      { key: 'last_name', label: 'Last name', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
    ],
    rows: [
      { first_name: 'Ada', last_name: 'Admin', role: 'ORG_ADMIN' },
      { first_name: 'Mara', last_name: 'Manager', role: 'MANAGER' },
    ],
  },
}

function renderBuilder(initialEntry = '/reports/builder') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reports/builder" element={<CustomReportBuilderPage />} />
          <Route path="/reports/custom/:id" element={<CustomReportBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/reporting/custom/datasets') return Promise.resolve({ data: { datasets: DATASETS } })
    if (url === '/reporting/custom') return Promise.resolve({ data: { reports: [] } })
    return Promise.resolve({ data: {} })
  })
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.delete).mockReset()
})

describe('CustomReportBuilderPage', () => {
  it('loads datasets, runs the default configuration and previews rows', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValue({ data: RUN_RESULT })
    renderBuilder()

    expect(await screen.findByText('Staff')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /run report/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reporting/custom/run', expect.objectContaining({
      config: expect.objectContaining({ dataset: 'staff' }),
    })))
    expect(await screen.findByText(/Ada \| Admin \| ORG_ADMIN/)).toBeInTheDocument()
    expect(screen.getByText('Records: 2')).toBeInTheDocument()
  })

  it('blocks a grouped run until only the group-by column is selected', async () => {
    const user = userEvent.setup()
    renderBuilder()
    expect(await screen.findByText('Staff')).toBeInTheDocument()

    // Group by role while three columns are ticked: the builder warns and refuses.
    await user.click(await screen.findByLabelText('Group by'))
    await user.click(await screen.findByRole('option', { name: 'Role' }))
    expect((await screen.findAllByText(/untick the other columns/i)).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: /run report/i }))
    expect((await screen.findAllByText(/untick the other columns/i)).length).toBeGreaterThanOrEqual(1)
    expect(api.post).not.toHaveBeenCalledWith('/reporting/custom/run', expect.anything())
  })

  it('opens the delivery schedule for a saved report and creates one', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/reporting/custom/datasets') return Promise.resolve({ data: { datasets: DATASETS } })
      if (url === '/reporting/custom/saved-1') {
        return Promise.resolve({
          data: {
            report: {
              id: 'saved-1', name: 'My staff list', description: '', dataset: 'staff',
              columns: ['first_name', 'role'], filters: [], group_by: null, aggregations: [],
              sort_by: null, sort_dir: 'desc', row_limit: 500, chart_type: 'table',
            },
          },
        })
      }
      if (url === '/reporting/custom/saved-1/schedules') return Promise.resolve({ data: { schedules: [] } })
      if (url === '/reporting/custom/recipients') {
        return Promise.resolve({ data: { recipients: [{ id: 'u1', name: 'Ada Admin', email: 'ada@test.com', role: 'MANAGER' }] } })
      }
      return Promise.resolve({ data: {} })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { schedule: { id: 'sched-1' } } })
    renderBuilder('/reports/custom/saved-1')

    await user.click(await screen.findByRole('button', { name: /email delivery schedule/i }))
    expect(await screen.findByText('No schedules yet — add one below.')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Recipients'))
    await user.click(await screen.findByRole('option', { name: /ada admin/i }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /add schedule/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reporting/custom/saved-1/schedules', {
      frequency: 'daily', day_of_week: null, day_of_month: null,
      send_time: '08:00', recipient_ids: ['u1'], enabled: true,
    }))
  })

  it('sends a saved report to the requester on demand', async () => {
    const user = userEvent.setup()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/reporting/custom/datasets') return Promise.resolve({ data: { datasets: DATASETS } })
      if (url === '/reporting/custom/saved-1') {
        return Promise.resolve({
          data: {
            report: {
              id: 'saved-1', name: 'My staff list', description: '', dataset: 'staff',
              columns: ['first_name', 'role'], filters: [], group_by: null, aggregations: [],
              sort_by: null, sort_dir: 'desc', row_limit: 500, chart_type: 'table',
            },
          },
        })
      }
      if (url === '/reporting/custom/saved-1/schedules') return Promise.resolve({ data: { schedules: [] } })
      if (url === '/reporting/custom/recipients') return Promise.resolve({ data: { recipients: [] } })
      return Promise.resolve({ data: {} })
    })
    vi.mocked(api.post).mockResolvedValue({ data: { sent: true, to: 'ada@test.com', rows: 2 } })
    renderBuilder('/reports/custom/saved-1')

    await user.click(await screen.findByRole('button', { name: /email delivery schedule/i }))
    await user.click(await screen.findByRole('button', { name: /email me now/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reporting/custom/saved-1/send-now'))
    expect(await screen.findByText(/emailed to ada@test\.com/)).toBeInTheDocument()
  })

  it('shows recent runs for a delivery schedule', async () => {
    const user = userEvent.setup()
    const schedule = {
      id: 'sched-1', frequency: 'daily', day_of_week: null, day_of_month: null,
      send_time: '08:00', recipient_ids: ['u1'], enabled: true,
      last_run_at: new Date().toISOString(), next_run_at: new Date().toISOString(), last_error: null,
    }
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/reporting/custom/datasets') return Promise.resolve({ data: { datasets: DATASETS } })
      if (url === '/reporting/custom/saved-1') {
        return Promise.resolve({
          data: {
            report: {
              id: 'saved-1', name: 'My staff list', description: '', dataset: 'staff',
              columns: ['first_name', 'role'], filters: [], group_by: null, aggregations: [],
              sort_by: null, sort_dir: 'desc', row_limit: 500, chart_type: 'table',
            },
          },
        })
      }
      if (url === '/reporting/custom/saved-1/schedules') return Promise.resolve({ data: { schedules: [schedule] } })
      if (url === '/reporting/custom/recipients') {
        return Promise.resolve({ data: { recipients: [{ id: 'u1', name: 'Ada Admin', email: 'ada@test.com', role: 'MANAGER' }] } })
      }
      if (url.startsWith('/reporting/custom/saved-1/schedules/sched-1/deliveries')) {
        return Promise.resolve({
          data: {
            deliveries: [
              { id: 'd1', status: 'sent', recipient_count: 1, row_count: 4, error: null, ran_at: new Date().toISOString() },
              { id: 'd2', status: 'failed', recipient_count: 0, row_count: 0, error: 'No active recipients left on this schedule.', ran_at: new Date().toISOString() },
            ],
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderBuilder('/reports/custom/saved-1')

    await user.click(await screen.findByRole('button', { name: /email delivery schedule/i }))
    expect(await screen.findByText('RECENT RUNS')).toBeInTheDocument()
    expect(await screen.findByText('1 recipient · 4 rows')).toBeInTheDocument()
    expect(await screen.findByText(/Failed — No active recipients/)).toBeInTheDocument()
  })

  it('saves a new configuration and navigates to it', async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === '/reporting/custom') return Promise.resolve({ data: { report: { id: 'saved-1' } } })
      return Promise.resolve({ data: RUN_RESULT })
    })
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/reporting/custom/datasets') return Promise.resolve({ data: { datasets: DATASETS } })
      if (url === '/reporting/custom') return Promise.resolve({ data: { reports: [] } })
      if (url === '/reporting/custom/saved-1') {
        return Promise.resolve({
          data: {
            report: {
              id: 'saved-1', name: 'My staff list', description: '', dataset: 'staff',
              columns: ['first_name', 'role'], filters: [], group_by: null, aggregations: [],
              sort_by: null, sort_dir: 'desc', row_limit: 500, chart_type: 'table',
            },
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
    renderBuilder()
    expect(await screen.findByText('Staff')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'My staff list')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reporting/custom', expect.objectContaining({ name: 'My staff list' })))
    expect(await screen.findByText('My staff list')).toBeInTheDocument()
  })
})
