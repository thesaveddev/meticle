import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeModeProvider } from '../../context/ThemeContext'
import BillingPage from './BillingPage'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import api from '../../services/api'

const ADDONS = {
  catalog: [
    {
      slug: 'extra_location',
      name: 'Additional location',
      description: 'One more registered location.',
      amountDisplay: '£49.00 / month',
    },
  ],
  active: [] as string[],
}

function mockBilling(active: string[] = []) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/billing/subscription') {
      return Promise.resolve({
        data: { plan: 'starter', subscriptionStatus: 'active', trialEndsAt: null, currentPeriodEnd: new Date().toISOString() },
      })
    }
    if (url === '/billing/invoices') return Promise.resolve({ data: [] })
    if (url === '/billing/payment-methods') return Promise.resolve({ data: [] })
    if (url === '/billing/addons') return Promise.resolve({ data: { ...ADDONS, active } })
    if (url === '/settings/org') return Promise.resolve({ data: { service_types: ['supported_living'] } })
    return Promise.resolve({ data: null })
  })
}

function renderPage() {
  window.localStorage.setItem('user', JSON.stringify({ role: 'ORG_ADMIN', organization_id: 'org-1' }))
  return render(
    <ThemeModeProvider>
      <BillingPage />
    </ThemeModeProvider>,
  )
}

describe('BillingPage add-ons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBilling()
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Additional location added.', addons: ['extra_location'] } })
  })

  it('lists the catalog with a purchase button for an inactive add-on', async () => {
    renderPage()
    expect(await screen.findByText('Additional location')).toBeTruthy()
    expect(screen.getByText('£49.00 / month')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Purchase' })).toBeTruthy()
  })

  it('confirms before purchasing and posts the slug', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Purchase' }))
    expect(await screen.findByText(/billed together with your plan/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => {
      expect(vi.mocked(api.post)).toHaveBeenCalledWith('/billing/addons/purchase', { addon: 'extra_location' })
    })
    expect(await screen.findByText('Additional location added.')).toBeTruthy()
  })

  it('shows a cancel button for an active add-on and posts the cancel', async () => {
    mockBilling(['extra_location'])
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Additional location cancelled.', addons: [] } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(vi.mocked(api.post)).toHaveBeenCalledWith('/billing/addons/cancel', { addon: 'extra_location' })
    })
    expect(await screen.findByText('Additional location cancelled.')).toBeTruthy()
  })

  it('shows the server error when the purchase fails', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'Subscribe to a plan first' } } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Purchase' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(await screen.findByText('Subscribe to a plan first')).toBeTruthy()
  })
})
