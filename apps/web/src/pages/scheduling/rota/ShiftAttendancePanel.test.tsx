import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShiftAttendancePanel from './ShiftAttendancePanel'
import api from '../../../services/api'
import { queueShiftAction, readPendingShiftActions } from './pendingShiftActions'

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const mockedApi = vi.mocked(api)

const rosterRow = (overrides: Record<string, unknown> = {}) => ({
  staff_id: 'staff-1',
  user_id: 'user-1',
  first_name: 'Ada',
  last_name: 'Bell',
  assignment_status: 'assigned',
  is_overtime: false,
  is_me: true,
  clocked_on_at: null,
  clocked_off_at: null,
  worked_minutes: 0,
  on_duty: false,
  ...overrides,
})

const attendance = (overrides: Record<string, unknown> = {}) => ({
  shift_id: 'shift-1',
  location_id: 'loc-1',
  location_name: 'Willow House',
  status: 'filled',
  shift_type: 'day',
  start_time: '2026-10-16T08:00:00.000Z',
  end_time: '2026-10-16T16:00:00.000Z',
  actual_start_at: null,
  actual_end_at: null,
  unattended: true,
  rostered: [rosterRow()],
  events: [],
  ...overrides,
})

const handoverView = (overrides: Record<string, unknown> = {}) => ({
  handover: null,
  revisions: [],
  viewer_acknowledged: false,
  viewer_is_author: false,
  ...overrides,
})

/** The panel loads attendance and handover together, so the mock answers by URL. */
function respondWith(state: { attendance: any; handover: any }) {
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/attendance')) return { data: state.attendance } as any
    if (url.endsWith('/handover')) return { data: state.handover } as any
    throw new Error(`unexpected GET ${url}`)
  })
}

function renderPanel(props: Partial<React.ComponentProps<typeof ShiftAttendancePanel>> = {}) {
  return render(
    <ShiftAttendancePanel
      shiftId="shift-1"
      isAssignedToMe
      isManager={false}
      {...props}
    />
  )
}

describe('ShiftAttendancePanel — attendance', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
    mockedApi.post.mockReset()
  })

  it('offers the clock-on to the worker rostered on the shift, and none to anyone else', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    const { unmount } = renderPanel()
    expect(await screen.findByRole('button', { name: /clock on/i })).toBeInTheDocument()
    expect(screen.getByText(/no one clocked on/i)).toBeInTheDocument()
    unmount()

    // A manager reads the attendance; the API would refuse them anyway.
    state.attendance = attendance({ rostered: [rosterRow({ is_me: false })] })
    renderPanel({ isAssignedToMe: false, isManager: true })
    expect(await screen.findByText('No one clocked on')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clock on/i })).not.toBeInTheDocument()
  })

  it('clocks the worker on and then shows them on duty, with a clock-off', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    // The clock-on is what changes the record, so the mock applies it — the
    // panel reloads straight afterwards and has to see the shift as open.
    mockedApi.post.mockImplementation(async () => {
      state.attendance = attendance({
        unattended: false,
        actual_start_at: '2026-10-16T08:00:00.000Z',
        rostered: [rosterRow({ on_duty: true, clocked_on_at: '2026-10-16T08:00:00.000Z' })],
      })
      return { data: { replayed: false } } as any
    })

    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /clock on/i }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled())
    const [url, body] = mockedApi.post.mock.calls[0] as [string, any]
    expect(url).toBe('/shifts/shift-1/clock-on')
    // The key travels on the online route too, so a double press is one clock-on.
    expect(typeof body.action_key).toBe('string')
    expect(body.action_key.length).toBeGreaterThan(0)

    expect(await screen.findByRole('button', { name: /clock off/i })).toBeInTheDocument()
    expect(screen.getByText('On duty')).toBeInTheDocument()
  })

  it('keeps a clock-on that never reached the server, and resends it under the same key', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    // No `response` property at all: the request never left the device.
    mockedApi.post.mockRejectedValue(new Error('Network Error'))

    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /clock on/i }))

    // Two different places say "saved on this device" — the notice and the queue
    // banner — so this names the notice.
    expect(await screen.findByText(/No connection\. Saved on this device/i)).toBeInTheDocument()
    const saved = readPendingShiftActions()
    expect(saved).toHaveLength(1)
    expect(saved[0].action).toBe('clock-on')

    fireEvent.click(screen.getByRole('button', { name: /try now/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(2))

    const [firstUrl, firstBody] = mockedApi.post.mock.calls[0] as [string, any]
    const [retryUrl, retryBody] = mockedApi.post.mock.calls[1] as [string, any]
    expect(firstUrl).toBe('/shifts/shift-1/clock-on')
    // The retry goes to the offline route with the key the press generated.
    expect(retryUrl).toBe('/shifts/shift-1/offline/clock-on')
    expect(retryBody.action_key).toBe(firstBody.action_key)
    // Still no connection, so it stays queued rather than being lost.
    expect(readPendingShiftActions()).toHaveLength(1)
  })

  it('sends a queue left by a previous visit as soon as the panel opens', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    mockedApi.post.mockResolvedValue({ data: { replayed: true } } as any)
    queueShiftAction({ shiftId: 'shift-1', action: 'clock-on', payload: { recorded_at: 'then' }, key: 'saved-key' })

    renderPanel()

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled())
    const [url, body] = mockedApi.post.mock.calls[0] as [string, any]
    expect(url).toBe('/shifts/shift-1/offline/clock-on')
    expect(body.action_key).toBe('saved-key')
    expect(body.recorded_at).toBe('then')
    await waitFor(() => expect(readPendingShiftActions()).toHaveLength(0))
  })
})

describe('ShiftAttendancePanel — handover', () => {
  beforeEach(() => {
    mockedApi.get.mockReset()
    mockedApi.post.mockReset()
  })

  it('says when there is no handover, and lets the worker on the shift record one', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    mockedApi.post.mockResolvedValue({ data: { created: true } } as any)

    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /record handover/i }))

    fireEvent.change(screen.getByLabelText(/what happened during the shift/i), {
      target: { value: 'Pat had two seizures, both self-limiting.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save handover/i }))

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled())
    const [url, body] = mockedApi.post.mock.calls[0] as [string, any]
    expect(url).toBe('/shifts/shift-1/handover')
    expect(body.what_happened).toBe('Pat had two seizures, both self-limiting.')
  })

  it('shows the handover, who acknowledged it, and offers the acknowledgement to a colleague', async () => {
    const state = {
      attendance: attendance({ unattended: false }),
      handover: handoverView({
        handover: {
          id: 'handover-1', shift_id: 'shift-1', author_id: 'user-2', author_name: 'Sam Okafor',
          what_happened: 'Settled shift, slept through.', outstanding: null, who_is_aware: 'Duty manager',
          version: 1, recorded_at: '2026-10-15T22:00:00.000Z', updated_at: '2026-10-15T22:00:00.000Z',
          acknowledgements: [],
        },
        revisions: [{ id: 'rev-1', version: 1, what_happened: 'Settled shift, slept through.', outstanding: null, author_name: 'Sam Okafor', recorded_at: '2026-10-15T22:00:00.000Z', source: 'online' }],
      }),
    }
    respondWith(state)
    mockedApi.post.mockResolvedValue({ data: { acknowledgement: {}, replayed: false } } as any)

    renderPanel()
    expect(await screen.findByText('Settled shift, slept through.')).toBeInTheDocument()
    expect(screen.getByText(/nobody has acknowledged this yet/i)).toBeInTheDocument()
    // The author is not offered their own acknowledgement.
    expect(screen.queryByRole('button', { name: /^acknowledge$/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^acknowledge$/i }))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/shifts/shift-1/handover/acknowledge', {}, { silentError: true }))
  })

  it('keeps the earlier wording available once a handover has been amended', async () => {
    const state = {
      attendance: attendance({ unattended: false }),
      handover: handoverView({
        viewer_is_author: true,
        handover: {
          id: 'handover-1', shift_id: 'shift-1', author_id: 'user-1', author_name: 'Ada Bell',
          what_happened: 'Quiet shift, bed at 22:00.', outstanding: 'Water low — reported to maintenance.',
          who_is_aware: null, version: 2, recorded_at: '2026-10-15T22:10:00.000Z', updated_at: '2026-10-15T22:10:00.000Z',
          acknowledgements: [],
        },
        revisions: [
          { id: 'rev-2', version: 2, what_happened: 'Quiet shift, bed at 22:00.', outstanding: 'Water low — reported to maintenance.', author_name: 'Ada Bell', recorded_at: '2026-10-15T22:10:00.000Z', source: 'online' },
          { id: 'rev-1', version: 1, what_happened: 'Quiet shift, bed at 22:00.', outstanding: null, author_name: 'Ada Bell', recorded_at: '2026-10-15T22:00:00.000Z', source: 'online' },
        ],
      }),
    }
    respondWith(state)

    renderPanel()
    expect(await screen.findByText(/version 2/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show 1 earlier version/i }))
    expect(await screen.findByText(/version 1 · Ada Bell/i)).toBeInTheDocument()
    // The author cannot acknowledge their own handover, so no such button.
    expect(screen.queryByRole('button', { name: /^acknowledge$/i })).not.toBeInTheDocument()
  })

  it('reports a refusal instead of silently pretending the handover was saved', async () => {
    const state = { attendance: attendance(), handover: handoverView() }
    respondWith(state)
    mockedApi.post.mockRejectedValue({ response: { status: 403, data: { message: 'Only staff on this shift can record its handover' } } })

    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: /record handover/i }))
    fireEvent.change(screen.getByLabelText(/what happened during the shift/i), { target: { value: 'Something.' } })
    fireEvent.click(screen.getByRole('button', { name: /save handover/i }))

    expect(await screen.findByText(/only staff on this shift can record its handover/i)).toBeInTheDocument()
    expect(readPendingShiftActions()).toHaveLength(0)
  })
})
