import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  onReconnect: vi.fn(),
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
            <Route path="/people" element={<div data-testid="page-people">People Page</div>} />
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

beforeEach(() => {
  window.localStorage.setItem('user', JSON.stringify(ORG_ADMIN))
  window.localStorage.setItem('accessToken', 'test-token')
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.includes('/notifications/unread-count')) return Promise.resolve({ data: { count: 0 } })
    if (url.includes('/permissions/')) return Promise.resolve({ data: { permissions: [] } })
    if (url.includes('/auth/me')) {
      return Promise.resolve({ data: { user: ORG_ADMIN, organization: { name: 'Test Org' } } })
    }
    return Promise.resolve({ data: {} })
  })
})

describe('Layout sidebar navigation', () => {
  it('focuses the main content area after a sidebar nav click', async () => {
    const { container } = renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const peopleNav = screen.getAllByRole('button', { name: 'People' })[0]
    fireEvent.click(peopleNav)

    await waitFor(() => {
      expect(screen.getByTestId('page-people')).toBeInTheDocument()
      expect(document.activeElement).toBe(container.querySelector('main'))
    })
  })

  it('focuses the main content area even when re-clicking the current route', async () => {
    const { container } = renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Dashboard' })[0])

    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('main'))
    })
  })

  it('persists collapsed sidebar groups to localStorage', async () => {
    renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const groupButton = screen.getByRole('button', { name: /Care Management/i })
    fireEvent.click(groupButton)

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('sidebarCollapsedGroups') || '[]')
      expect(stored).toContain('Care Management')
    })
    expect(screen.getByRole('button', { name: /Care Management/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands a previously collapsed group when toggled again', async () => {
    window.localStorage.setItem('sidebarCollapsedGroups', JSON.stringify(['Staffing']))
    renderLayout('/dashboard')

    await waitFor(() => {
      expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    })

    const groupButton = screen.getByRole('button', { name: /Staffing/i })
    expect(groupButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(groupButton)

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('sidebarCollapsedGroups') || '[]')
      expect(stored).not.toContain('Staffing')
    })
    expect(screen.getByRole('button', { name: /Staffing/i })).toHaveAttribute('aria-expanded', 'true')
  })
})
