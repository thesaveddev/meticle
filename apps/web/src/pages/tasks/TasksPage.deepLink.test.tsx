import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TasksPage from './TasksPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setOnApiError: vi.fn(),
}))

import api from '../../services/api'

/**
 * The deep link a Mica write ends on: `?task=<id>`.
 *
 * The task has to open either way — when the row is already in the list the page
 * has fetched, and when it is not, which is the common case: the list on screen is
 * status-filtered and the record Mica has just written can be any status. A link
 * that only worked for a row you could already see would be no better than a link
 * to the tasks page. The assertions are on text only the dialog renders, since the
 * table shows the title and description too.
 */
const TASK_IN_LIST = {
  id: 't1',
  title: 'Order grip rails',
  description: 'For the bathroom',
  notes: 'Notes only the dialog shows',
  status: 'pending',
  priority: 'high',
  recurrence: 'once',
  due_date: '2026-10-20',
}

const TASK_OUTSIDE_THE_LIST = {
  id: 't9',
  title: 'Check the fire doors',
  description: 'Whole home',
  notes: 'Fetched by id, not a row in the list',
  status: 'completed',
  priority: 'medium',
  recurrence: 'once',
}

function renderTasks(initialEntry: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tasks" element={<TasksPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/tasks') return Promise.resolve({ data: { tasks: [TASK_IN_LIST] } })
    if (url.startsWith('/staff/org-members')) return Promise.resolve({ data: [] })
    if (url.startsWith('/people')) return Promise.resolve({ data: { people: [] } })
    if (url === `/tasks/${TASK_OUTSIDE_THE_LIST.id}`) return Promise.resolve({ data: TASK_OUTSIDE_THE_LIST })
    return Promise.resolve({ data: {} })
  })
})

describe('TasksPage deep links', () => {
  it('opens the task a link names when it is a row the page already has', async () => {
    renderTasks('/tasks?task=t1')

    expect(await screen.findByText('Notes only the dialog shows')).toBeInTheDocument()
    // Read from the list: no second request for the record.
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith('/tasks/t1')
  })

  it('fetches and opens a task the list on screen does not hold', async () => {
    renderTasks(`/tasks?task=${TASK_OUTSIDE_THE_LIST.id}`)

    expect(await screen.findByText('Fetched by id, not a row in the list')).toBeInTheDocument()
    expect(vi.mocked(api.get)).toHaveBeenCalledWith(`/tasks/${TASK_OUTSIDE_THE_LIST.id}`)
  })

  it('opens nothing when no link is present', async () => {
    renderTasks('/tasks')

    // The list itself renders, and no record dialog was opened by a stray param.
    expect(await screen.findByText('Order grip rails')).toBeInTheDocument()
    expect(screen.queryByText('Notes only the dialog shows')).not.toBeInTheDocument()
    expect(vi.mocked(api.get)).not.toHaveBeenCalledWith('/tasks/t1')
  })
})
