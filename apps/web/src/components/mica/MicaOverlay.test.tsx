import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaOverlay from './MicaOverlay'

// The overlay fetches person options whenever it is open; keep the request
// local to the test so no XHR escapes into jsdom.
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: [{ id: 'p1', first_name: 'Grace', last_name: 'Roberts', room_number: '4' }],
    }),
  },
}))

const baseProps = {
  audioLevel: 0,
  transcript: '',
  responseMessage: null,
  person: null,
  onPersonChange: vi.fn(),
  onCancel: vi.fn(),
}

describe('MicaOverlay', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<MicaOverlay {...baseProps} state="idle" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the listening dialog with the live transcript and person picker', () => {
    render(<MicaOverlay {...baseProps} state="listening" transcript="Grace had a good lunch" />)

    const dialog = screen.getByRole('dialog', { name: 'Mica voice assistant' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('“Grace had a good lunch”')).toBeInTheDocument()
    expect(screen.getByLabelText(/who is this note about/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel Mica/ })).toBeInTheDocument()
  })

  it('cancels cleanly: the cancel button calls onCancel and the unmount is silent', () => {
    const onCancel = vi.fn()
    const active = render(
      <MicaOverlay
        {...baseProps}
        state="responding"
        responseMessage="Care note drafted."
        person={{ id: 'p1', name: 'Grace Roberts' }}
        onCancel={onCancel}
      />,
    )

    // The visible response card carries the message; the screen-reader live
    // region duplicates it (a11y), so assert on the visible card only.
    expect(screen.getAllByText('Care note drafted.').length).toBeGreaterThan(0)
    expect(screen.getByText('Note about Grace Roberts')).toBeInTheDocument()

    // The responding-state action doubles as the cancel affordance.
    fireEvent.click(screen.getByRole('button', { name: /Cancel Mica/ }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    // Returning to idle (what stopListening triggers) tears the overlay down
    // to nothing, and unmounting mid-session must not throw.
    active.rerender(<MicaOverlay {...baseProps} state="idle" onCancel={onCancel} />)
    expect(active.container.innerHTML).toBe('')
    expect(() => active.unmount()).not.toThrow()
  })

  it('offers the typing box only while listening and when a text handler is wired', () => {
    const onSendText = vi.fn()
    const { unmount } = render(
      <MicaOverlay {...baseProps} state="listening" onSendText={onSendText} />,
    )
    expect(screen.getByRole('textbox', { name: /type to mica/i })).toBeInTheDocument()
    unmount()

    // Once thinking/responding the entry window has closed.
    render(<MicaOverlay {...baseProps} state="thinking" onSendText={onSendText} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    unmount()

    // No handler wired (defensive mount paths) → no textbox, no dead input.
    render(<MicaOverlay {...baseProps} state="listening" />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('sends typed text through the text entry point and clears the input', () => {
    const onSendText = vi.fn()
    render(
      <MicaOverlay {...baseProps}
        state="listening"
        transcript="Aisha's medication training expires next month"
        onSendText={onSendText}
      />,
    )
    const box = screen.getByRole('textbox', { name: /type to mica/i }) as HTMLInputElement
    fireEvent.change(box, { target: { value: "Aisha's medication training expires next month" } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: false })
    expect(onSendText).toHaveBeenCalledTimes(1)
    expect(onSendText).toHaveBeenCalledWith("Aisha's medication training expires next month")
    // The controlled value clears after send so the next sentence starts fresh.
    expect(box.value).toBe('')

    // Shift+Enter is a newline, not a send.
    fireEvent.change(box, { target: { value: 'line one' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSendText).toHaveBeenCalledTimes(1)

    // Empty input cannot send — Enter on whitespace is a no-op.
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: false })
    expect(onSendText).toHaveBeenCalledTimes(1)
  })

  it('renders a failure as the error state, not as a calm response', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <MicaOverlay
        {...baseProps}
        state="error"
        responseMessage="Mica could not reach the AI service. Check AI settings."
        onCancel={onCancel}
      />,
    )

    // Still one labelled modal dialog, and still dismissable.
    expect(screen.getByRole('dialog', { name: 'Mica voice assistant' })).toBeInTheDocument()

    // The message is shown with the error treatment rather than the ordinary card.
    const card = container.querySelector('[data-mica-message="error"]')
    expect(card).not.toBeNull()
    expect(card).toHaveTextContent('could not reach the AI service')
    expect(screen.queryByText('responding…')).toBeNull()

    // The orb carries the danger ring and no speech waveform.
    expect(container.querySelector('[data-mica-ring="error"]')).not.toBeNull()
    expect(container.querySelector('[data-mica-waveform]')).toBeNull()

    // And the failure is announced for screen-reader users.
    expect(screen.getByRole('status')).toHaveTextContent('could not reach the AI service')

    fireEvent.click(screen.getByRole('button', { name: /Cancel Mica/ }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
