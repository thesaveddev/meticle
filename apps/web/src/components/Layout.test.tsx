import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ThemeModeProvider } from '../context/ThemeContext'
import Layout from './Layout'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('../services/socket', () => ({
  connectSocket: () => ({ on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
  getSocket: () => null,
  onReconnect: vi.fn(() => vi.fn()),
}))
vi.mock('./SubscriptionGuard', () => ({
  useSubscriptionStatus: () => ({ status: 'active', isActive: true, loading: false }),
}))
vi.mock('./OfflineBanner', () => ({ default: () => null }))
vi.mock('./RouteLoadingIndicator', () => ({ default: () => null }))

import api from '../services/api'

function renderLayout(initialPath = '/dashboard') {
  return render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Layout>
          <Routes>
            <Route path="/dashboard" element={<div data-testid="page-dashboard">Dashboard Page</div>} />
            <Route path="/mission-control" element={<div data-testid="page-mission-control">Mission Control Page</div>} />
            <Route path="/people" element={<div data-testid="page-people">People Page</div>} />
            <Route path="/tasks" element={<div data-testid="page-tasks">Tasks Page</div>} />
          </Routes>
        </Layout>
      </MemoryRouter>
    </ThemeModeProvider>
  )
}

const ORG_ADMIN = {
  id: 'u1',
  first_name: 'Ada',
  email: 'ada@test.care',
  role: 'ORG_ADMIN',
}

// The sidebar is fail-closed: Layout filters an item out unless
// `modulePermissions[item.module]` is present and not 'none'. An empty
// permission map therefore renders an empty sidebar, which is the right
// behaviour — an admin whose permissions fail to load should not be shown the
// whole product — but it means a mock returning `{ permissions: [] }` produces
// a page with no navigation at all and every assertion below fails for a reason
// that has nothing to do with what is being tested.
const GRANT_ALL_MODULES = [
  'dashboard', 'people', 'care', 'staffing', 'homecare', 'call_scheduling',
  'medication', 'compliance', 'reporting', 'incidents', 'training', 'finance',
  'communication', 'my_space', 'settings',
].map((module) => ({ module, permission_level: 'view' }))

beforeEach(() => {
  window.localStorage.setItem('user', JSON.stringify(ORG_ADMIN))
  window.localStorage.setItem('accessToken', 'test-token')
  window.localStorage.removeItem('sidebarCollapsedGroups')
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/notifications/unread-count')) return Promise.resolve({ data: { count: 0 } })
    if (url.includes('/chat/unread')) return Promise.resolve({ data: {} })
    if (url.includes('/notifications')) return Promise.resolve({ data: [] })
    if (url.includes('/permissions/')) return Promise.resolve({ data: { permissions: GRANT_ALL_MODULES } })
    if (url.includes('/auth/me')) {
      return Promise.resolve({ data: { user: ORG_ADMIN, organization: { name: 'Test Org' } } })
    }
    // The service-type list gates the nav too, and a nav with no service types
    // hides every item carrying a serviceTypes restriction. Supported living
    // rather than domiciliary: a domiciliary org relabels the nav to its own
    // vocabulary ("People" becomes "Clients", "Staff Directory" becomes
    // "Carers"), which is correct behaviour and irrelevant to what these four
    // tests are about — focus handling and collapse persistence.
    if (url.includes('/settings/org')) {
      return Promise.resolve({ data: { service_types: ['supported_living'], primary_service_type: 'supported_living' } })
    }
    if (url.includes('/homecare/settings/location-tracking')) {
      return Promise.resolve({ data: { location_tracking_enabled: true } })
    }
    return Promise.resolve({ data: {} })
  })
})

describe('Layout carer-location requests', () => {
  it('does not request the domiciliary-only carer-location setting for a supported-living organisation', async () => {
    renderLayout('/dashboard')

    // Nav items render only once service types have loaded, so the carer-location
    // effect (which waits on the same state) has had its chance to run by then.
    await screen.findAllByRole('button', { name: 'People' })
    const requested = vi.mocked(api.get).mock.calls.map(call => call[0])
    expect(requested).toContain('/settings/org')
    expect(requested).not.toContain('/homecare/settings/location-tracking')
  })

  it('requests the carer-location setting for a domiciliary organisation', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/permissions/')) return Promise.resolve({ data: { permissions: GRANT_ALL_MODULES } })
      if (url.includes('/settings/org')) {
        return Promise.resolve({ data: { service_types: ['domiciliary'], primary_service_type: 'domiciliary' } })
      }
      if (url.includes('/homecare/settings/location-tracking')) {
        return Promise.resolve({ data: { location_tracking_enabled: true } })
      }
      return Promise.resolve({ data: {} })
    })
    renderLayout('/dashboard')

    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/homecare/settings/location-tracking'))
  })
})

describe('Layout sidebar navigation', () => {
  it('shows a single Mission Control overview entry for managers instead of two dashboards', async () => {
    window.localStorage.setItem('user', JSON.stringify({ ...ORG_ADMIN, role: 'MANAGER' }))
    renderLayout('/mission-control')

    await waitFor(() => expect(screen.getByTestId('page-mission-control')).toBeInTheDocument())
    const sidebar = within(screen.getByRole('navigation'))
    expect(sidebar.getByRole('button', { name: 'Mission Control' })).toHaveAttribute('aria-current', 'page')
    expect(sidebar.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
  })

  it('focuses the main content area after a sidebar nav click', async () => {
    const { container } = renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const peopleNav = (await screen.findAllByRole('button', { name: 'People' }))[0]
    fireEvent.click(peopleNav)

    await waitFor(() => {
      expect(screen.getByTestId('page-people')).toBeInTheDocument()
      expect(document.activeElement).toBe(container.querySelector('main'))
    })
  })

  it('focuses the main content area even when re-clicking the current Mission Control route', async () => {
    window.localStorage.setItem('user', JSON.stringify({ ...ORG_ADMIN, role: 'MANAGER' }))
    const { container } = renderLayout('/mission-control')

    await waitFor(() => {
      expect(screen.getByTestId('page-mission-control')).toBeInTheDocument()
    })

    fireEvent.click((await screen.findAllByRole('button', { name: 'Mission Control' }))[0])

    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('main'))
    })
  })

  it('persists collapsed sidebar groups to localStorage', async () => {
    renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const groupButton = await screen.findByRole('button', { name: 'Care' })
    fireEvent.click(groupButton)

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('sidebarCollapsedGroups') || '[]')
      expect(stored).toContain('Care')
    })
    expect(screen.getByRole('button', { name: 'Care' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides supported-living navigation and keeps notifications in the top bar for domiciliary organisations', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/settings/org') return Promise.resolve({ data: { service_types: ['domiciliary'] } })
      if (url.includes('/notifications/unread-count')) return Promise.resolve({ data: { count: 0 } })
      if (url.includes('/chat/unread')) return Promise.resolve({ data: {} })
      if (url.includes('/permissions/')) return Promise.resolve({ data: { permissions: [] } })
      if (url.includes('/auth/me')) return Promise.resolve({ data: { user: ORG_ADMIN, organization: { name: 'Homecare Org' } } })
      return Promise.resolve({ data: {} })
    })

    renderLayout('/dashboard')
    await waitFor(() => expect(screen.getByTestId('page-dashboard')).toBeInTheDocument())

    const sidebar = within(screen.getByRole('navigation'))
    expect(sidebar.queryByText('Mission Control')).not.toBeInTheDocument()
    expect(sidebar.queryByText('Appointments')).not.toBeInTheDocument()
    expect(sidebar.queryByText('Expenses')).not.toBeInTheDocument()
    expect(sidebar.queryByText('Tasks')).not.toBeInTheDocument()
    expect(sidebar.queryByText('My Profile')).not.toBeInTheDocument()
    expect(sidebar.queryByText('Notifications')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument()
  })

  it('opens the record a notification names, inside the app', async () => {
    // The bell used to be a dead end: it told the carer they had work and left them
    // to find it. A notification now carries the record's own link — the same path
    // Mica speaks back and an email's button points at — and tapping the row opens
    // it through the router, so the reader stays in the client they are signed into
    // instead of a new tab that reloads the whole app.
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/notifications/unread-count')) return Promise.resolve({ data: { count: 1 } })
      if (url.includes('/chat/unread')) return Promise.resolve({ data: {} })
      if (url.includes('/notifications')) {
        return Promise.resolve({
          data: [{
            id: 'n1',
            title: 'New Task Assigned',
            message: 'You have been assigned: "Order new grip rails" (high)',
            type: 'general',
            read: false,
            created_at: new Date().toISOString(),
            link: '/tasks?task=t1',
          }],
        })
      }
      if (url.includes('/permissions/')) return Promise.resolve({ data: { permissions: GRANT_ALL_MODULES } })
      if (url.includes('/auth/me')) return Promise.resolve({ data: { user: ORG_ADMIN, organization: { name: 'Test Org' } } })
      if (url.includes('/settings/org')) {
        return Promise.resolve({ data: { service_types: ['supported_living'], primary_service_type: 'supported_living' } })
      }
      return Promise.resolve({ data: {} })
    })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })

    renderLayout('/dashboard')
    await screen.findByTestId('page-dashboard')

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    fireEvent.click(await screen.findByText('New Task Assigned'))

    // The task's own page, reached by the router — and the row is read on the way,
    // because a carer who tapped it has plainly seen it.
    await waitFor(() => expect(screen.getByTestId('page-tasks')).toBeInTheDocument())
    await waitFor(() => expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/notifications/n1/read'))
  })

  it('expands a previously collapsed group when toggled again', async () => {
    window.localStorage.setItem('sidebarCollapsedGroups', JSON.stringify(['Staffing']))
    renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const groupButton = await screen.findByRole('button', { name: /Staffing/i })
    expect(groupButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(groupButton)

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('sidebarCollapsedGroups') || '[]')
      expect(stored).not.toContain('Staffing')
    })
    expect(screen.getByRole('button', { name: /Staffing/i })).toHaveAttribute('aria-expanded', 'true')
  })
})
