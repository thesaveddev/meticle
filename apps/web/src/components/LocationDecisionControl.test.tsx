import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationDecisionControl from './LocationDecisionControl'
import api from '../services/api'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

function renderControl() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><LocationDecisionControl /></QueryClientProvider>)
}

/** What the API returns for a worker in the state each test needs. */
const status = (overrides: Record<string, unknown> = {}) => ({
  data: {
    decision: null,
    notice_version: null,
    app_version: null,
    decided_at: null,
    organisation_collects_location: true,
    collects_location: false,
    current_notice_key: 'staff_location',
    current_notice_version: '1.1',
    ...overrides,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("a carer's own location decision", () => {
  it('offers both answers, and neither is pre-selected', async () => {
    mockedApi.get.mockResolvedValue(status() as any)
    renderControl()

    // No implied default. A care worker who has not answered has not agreed,
    // and a control that opens looking ticked invites a tap that is not consent.
    const agree = await screen.findByRole('button', { name: /yes, record my location/i })
    const decline = screen.getByRole('button', { name: /no, don't record my location/i })
    expect(agree).toBeEnabled()
    expect(decline).toBeEnabled()
    expect(screen.getByText('Not answered yet')).toBeInTheDocument()
  })

  it('says plainly that nothing is recorded until they answer', async () => {
    mockedApi.get.mockResolvedValue(status() as any)
    renderControl()

    expect(await screen.findByText(/Until you answer, your position is not being recorded/)).toBeInTheDocument()
  })

  it('states the cost of refusing, so "no" is a real choice rather than a trap', async () => {
    mockedApi.get.mockResolvedValue(status() as any)
    renderControl()

    // The trap this avoids: a decline that quietly turned off timesheets would
    // make the refusal pointless and would be coerced consent in practice.
    expect(await screen.findByText(/does not affect your visits, care notes, timesheets or pay/i)).toBeInTheDocument()
    expect(screen.getByText(/address/i)).toBeInTheDocument()
  })

  it('records a decline without sending any position', async () => {
    mockedApi.get.mockResolvedValue(status() as any)
    mockedApi.post.mockResolvedValue({ data: { decision: 'declined' } } as any)
    renderControl()

    await userEvent.click(await screen.findByRole('button', { name: /no, don't record my location/i }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1))
    const [url, body] = mockedApi.post.mock.calls[0]
    expect(url).toBe('/homecare/location-decision')
    expect(body.decision).toBe('declined')
    // Stamped with the version the server called current, so the record says
    // which notice the answer belongs to even though the text lives in the app.
    expect(body.notice_version).toBe('1.1')
    expect(body.notice_key).toBe('staff_location')
    // No coordinates anywhere in a decision write.
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude/)
  })

  it('cannot be changed back to the answer already given', async () => {
    mockedApi.get.mockResolvedValue(status({ decision: 'declined', collects_location: false, notice_version: '1.1' }) as any)
    renderControl()

    const agree = await screen.findByRole('button', { name: /yes, record my location/i })
    expect(agree).toBeEnabled()
    expect(screen.getByRole('button', { name: /no, don't record my location/i })).toBeDisabled()
  })

  it('leaves the worker a way back in either direction', async () => {
    mockedApi.get.mockResolvedValue(status({ decision: 'agreed', collects_location: true, notice_version: '1.1' }) as any)
    renderControl()

    expect(await screen.findByRole('button', { name: /yes, record my location/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /no, don't record my location/i })).toBeEnabled()
  })

  it('tells a worker whose employer has switched location off that the answer still matters', async () => {
    mockedApi.get.mockResolvedValue(status({ organisation_collects_location: false, collects_location: false }) as any)
    renderControl()

    expect(await screen.findByText(/switched location recording off/)).toBeInTheDocument()
    // Without this, a worker would reasonably think their answer did nothing
    // and never revisit it if the employer switched it back on.
    expect(screen.getByText(/if they switch it back on/i)).toBeInTheDocument()
  })

  it('shows the notice version their answer is recorded against', async () => {
    mockedApi.get.mockResolvedValue(status({ decision: 'agreed', collects_location: true, notice_version: '1.0' }) as any)
    renderControl()

    expect(await screen.findByText(/version 1\.0/)).toBeInTheDocument()
  })

  it('hides the buttons rather than offering a blind toggle when the answer cannot be read', async () => {
    // A worker who cannot see their current answer cannot know what changing it
    // means. Fails closed on the write as well as the read.
    mockedApi.get.mockRejectedValue(new Error('offline'))
    renderControl()

    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record my location/i })).toBeNull()
  })

  it('never offers to write a decision for somebody else', async () => {
    mockedApi.get.mockResolvedValue(status() as any)
    renderControl()

    await screen.findByRole('button', { name: /yes, record my location/i })
    // One endpoint, the worker's own, and no user id in the path. Asserted
    // against the rendered component because a manager path is the failure
    // that turns this into an employer's tick-box.
    expect(document.body.textContent).toMatch(/nobody else can make it for you/i)
    const paths = mockedApi.get.mock.calls.map(c => c[0])
    expect(paths).toEqual(['/homecare/location-decision'])
  })
})
