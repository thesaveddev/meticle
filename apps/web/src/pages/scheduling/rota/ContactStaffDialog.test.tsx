import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ContactStaffDialog from './ContactStaffDialog'
import api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const showSnackbar = vi.fn()
vi.mock('../../../context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar }),
}))

const STAFF = {
  userId: 'u-koch',
  firstName: 'Kemi',
  lastName: 'Okafor',
  onDuty: false,
  clockedOnAt: null,
}

function renderDialog(staff: any = STAFF) {
  return render(
    <ContactStaffDialog
      open
      onClose={vi.fn()}
      staff={staff}
      locationName="Elm House"
      shiftStart="2026-11-03T07:00:00"
      shiftEnd="2026-11-03T15:00:00"
      shiftType="day"
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: { phone: '07700 900123' } } as any)
  vi.mocked(api.post).mockImplementation(async (url: string) => {
    if (url.startsWith('/chat/channels/dm/')) return { data: { id: 'ch-1' } } as any
    return { data: { id: 'm-1' } } as any
  })
})

describe('ContactStaffDialog (Figma 8)', () => {
  it('names the worker, the shift and the clock state, and prefills the message', async () => {
    renderDialog()
    const d = await screen.findByRole('dialog')
    expect(within(d).getByText('Contact KO')).toBeInTheDocument()
    expect(within(d).getByText(/Support worker · Elm House · 07:00–15:00 · not clocked in/)).toBeInTheDocument()
    expect(within(d).getByText(/Call/)).toBeInTheDocument()
    expect(await within(d).findByText(/07700 900123/)).toBeInTheDocument()
    const box = within(d).getByPlaceholderText('Write to them directly…') as HTMLTextAreaElement
    expect(box.value).toMatch(/Hi Kemi, you're due for the 07:00 shift at Elm House/)
  })

  it('says so in the dialog when sending is attempted with no message', async () => {
    renderDialog()
    const d = await screen.findByRole('dialog')
    fireEvent.change(within(d).getByPlaceholderText('Write to them directly…'), { target: { value: '   ' } })
    fireEvent.click(within(d).getByRole('button', { name: 'Send message' }))
    expect(await within(d).findByText(/Write a message first/)).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('opens the direct channel, posts the message and confirms with a toast', async () => {
    const onClose = vi.fn()
    render(
      <ContactStaffDialog
        open
        onClose={onClose}
        staff={STAFF}
        locationName="Elm House"
        shiftStart="2026-11-03T07:00:00"
        shiftEnd="2026-11-03T15:00:00"
        shiftType="day"
      />,
    )
    const d = await screen.findByRole('dialog')
    fireEvent.click(within(d).getByRole('button', { name: 'Send message' }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/chat/channels/dm/u-koch', {}, expect.anything())
      expect(api.post).toHaveBeenCalledWith('/chat/channels/ch-1/messages', expect.objectContaining({ content: expect.stringMatching(/Hi Kemi/) }), expect.anything())
    })
    expect(onClose).toHaveBeenCalled()
    expect(showSnackbar).toHaveBeenCalledWith(expect.stringMatching(/straight away in Chat/), 'success', 'Message sent')
  })

  it('explains when there is no phone number on the record', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} } as any)
    renderDialog()
    const d = await screen.findByRole('dialog')
    expect(await within(d).findByText(/No phone number on their record/)).toBeInTheDocument()
  })
})
