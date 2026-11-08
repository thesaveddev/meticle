import { Suspense } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ComplianceIndexRoute } from './ComplianceIndexRoute'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

// The real pages are heavy; the route decision is the unit under test, so both
// sides render a marker and nothing else.
vi.mock('../pages/marketing/CompliancePage', () => ({ default: () => 'marketing-overview' }))
vi.mock('../pages/compliance/CompliancePage', () => ({ default: () => 'app-compliance-hub' }))

// The shell itself is not what this file decides, but *that the hub is inside
// it* is: the top-level route has to out-rank the marketing page, so it renders
// the Layout itself rather than inheriting it from the route tree. Rendering the
// real Layout here would drag its session, socket and theme providers into a
// unit test about one decision, so the shell is a marker that records the fact.
vi.mock('../components/Layout', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}))

import api from '../services/api'

const COMPLIANCE_ALLOWED = { data: { permissions: [{ module: 'compliance', permission_level: 'view' }] } }

function mockSignedIn(role = 'ORG_ADMIN') {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/auth/me') {
      return Promise.resolve({
        data: { user: { id: 'u1', role }, organization: { onboarding_completed: true } },
      })
    }
    if (typeof url === 'string' && url.startsWith('/permissions/')) return Promise.resolve(COMPLIANCE_ALLOWED)
    return Promise.resolve({ data: {} })
  })
}

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/compliance']}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/compliance" element={<ComplianceIndexRoute />} />
          <Route path="/unauthorized" element={<div>not-allowed</div>} />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
})

/**
 * `/compliance` used to render the marketing overview for everyone: the two
 * identical static paths tie in the router's ranking and the marketing one is
 * declared first. The index route now asks `/auth/me` first, so the sidebar
 * link opens the in-app hub for a signed-in team member and the public page
 * for a visitor.
 */
describe('ComplianceIndexRoute', () => {
  it('renders the in-app hub for a signed-in team member', async () => {
    mockSignedIn('ORG_ADMIN')
    renderIndex()

    expect(await screen.findByText('app-compliance-hub')).toBeInTheDocument()
    expect(screen.queryByText('marketing-overview')).not.toBeInTheDocument()
  })

  it('renders the hub inside the app shell, not loose on the page', async () => {
    // The regression: the route answered the session question correctly but
    // rendered the hub outside the Layout, so a signed-in visitor got the page
    // with no sidebar and no page padding — content flush against the window.
    mockSignedIn('ORG_ADMIN')
    renderIndex()

    const shell = await screen.findByTestId('app-shell')
    // The hub is lazy, so wait for it inside the shell rather than assuming it
    // painted in the same tick the shell did.
    expect(await within(shell).findByText('app-compliance-hub')).toBeInTheDocument()
  })

  it('renders the marketing overview for a signed-out visitor', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.reject({ response: { status: 401 } })
      return Promise.resolve({ data: {} })
    })
    renderIndex()

    expect(await screen.findByText('marketing-overview')).toBeInTheDocument()
    expect(screen.queryByText('app-compliance-hub')).not.toBeInTheDocument()
    // The public page keeps its own chrome; the app shell is for signed-in users.
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
  })

  it('treats an unreachable server as still signed in when a user is cached', async () => {
    // AuthGuard's offline rule: no response is not a sign-out.
    window.localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'MANAGER' }))
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.reject({})
      if (typeof url === 'string' && url.startsWith('/permissions/')) return Promise.resolve(COMPLIANCE_ALLOWED)
      return Promise.resolve({ data: {} })
    })
    renderIndex()

    expect(await screen.findByText('app-compliance-hub')).toBeInTheDocument()
    expect(screen.queryByText('marketing-overview')).not.toBeInTheDocument()
  })

  it('keeps the role gate: a signed-in role the hub excludes is refused', async () => {
    mockSignedIn('SUPER_ADMIN')
    renderIndex()

    expect(await screen.findByText('not-allowed')).toBeInTheDocument()
    expect(screen.queryByText('app-compliance-hub')).not.toBeInTheDocument()
    expect(screen.queryByText('marketing-overview')).not.toBeInTheDocument()
  })

  it('still answers the marketing page when the session check itself fails to load', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network down'))
    renderIndex()

    // No cached user and no server answer: a visitor, not a broken page.
    expect(await screen.findByText('marketing-overview')).toBeInTheDocument()
  })
})
