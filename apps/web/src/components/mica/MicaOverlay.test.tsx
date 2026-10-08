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

    const dialog = screen.getByRole('dialog', { name: 'MICA voice assistant' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('“Grace had a good lunch”')).toBeInTheDocument()
    expect(screen.getByLabelText(/who is this note about/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Mica' })).toBeInTheDocument()
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

    expect(screen.getByText('Care note drafted.')).toBeInTheDocument()
    expect(screen.getByText('Note about Grace Roberts')).toBeInTheDocument()

    // The responding-state action doubles as the cancel affordance.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Mica' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    // Returning to idle (what stopListening triggers) tears the overlay down
    // to nothing, and unmounting mid-session must not throw.
    active.rerender(<MicaOverlay {...baseProps} state="idle" onCancel={onCancel} />)
    expect(active.container.innerHTML).toBe('')
    expect(() => active.unmount()).not.toThrow()
  })
})
