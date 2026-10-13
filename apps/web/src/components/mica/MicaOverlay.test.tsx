import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaOverlay from './MicaOverlay'
import { createMicaAudioChannel } from './mica.audio'

/**
 * The overlay is deliberately smaller than it was: the typing box and the
 * "who is this about?" picker are gone. Both removals are asserted here, because
 * a regression that quietly re-adds either one would put a data-entry step back
 * in the middle of a spoken conversation.
 */
const baseProps = {
  // The amplitude channel, not a level: a number here would be state changing
  // sixty times a second, and this dialog must not re-render for any of them.
  audio: createMicaAudioChannel(),
  transcript: '',
  responseMessage: null,
  lastNavigation: null,
  onMinimise: vi.fn(),
  onCancel: vi.fn(),
}

describe('MicaOverlay', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<MicaOverlay {...baseProps} state="idle" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the listening dialog with the live transcript and no data entry', () => {
    render(<MicaOverlay {...baseProps} state="listening" transcript="Grace had a good lunch" />)

    const dialog = screen.getByRole('dialog', { name: 'Mica voice assistant' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('“Grace had a good lunch”')).toBeInTheDocument()

    // No typing box and no person picker: voice is the only entry point, and a
    // note's subject comes from what was said (useMica asks aloud if it cannot
    // tell who the note is about).
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByLabelText(/who is this note about/i)).toBeNull()

    // Both exits are present: minimise (keep listening over the page) and end.
    expect(screen.getByRole('button', { name: /minimise mica and keep listening/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end the conversation with mica/i })).toBeInTheDocument()
  })

  it('minimises without ending the session, and ends it when asked', () => {
    const onMinimise = vi.fn()
    const onCancel = vi.fn()
    render(<MicaOverlay {...baseProps} state="listening" onMinimise={onMinimise} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: /minimise mica and keep listening/i }))
    expect(onMinimise).toHaveBeenCalledTimes(1)
    // Minimising is not closing: the session continues in the bar.
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /end the conversation with mica/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ends on Escape, since that is the keyboard exit from a live session', () => {
    const onCancel = vi.fn()
    render(<MicaOverlay {...baseProps} state="responding" responseMessage="Here's the rota." onCancel={onCancel} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('says where Mica just took the user', () => {
    render(
      <MicaOverlay
        {...baseProps}
        state="responding"
        responseMessage="Here's Evan Turner's March 2026 MAR chart."
        lastNavigation={{ path: '/emedication?personId=p9&month=2026-03', label: "Evan Turner's March 2026 MAR chart" }}
      />,
    )

    expect(screen.getAllByText(/Here's Evan Turner's March 2026 MAR chart\./).length).toBeGreaterThan(0)
    expect(screen.getByText(/Opened Evan Turner's March 2026 MAR chart/)).toBeInTheDocument()
    expect(document.querySelector('[data-mica-destination="/emedication?personId=p9&month=2026-03"]')).not.toBeNull()
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

    // A failure is not minimisable — there is nothing left to listen for — and
    // it is announced for screen-reader users.
    expect(screen.queryByRole('button', { name: /minimise mica/i })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('could not reach the AI service')

    fireEvent.click(screen.getByRole('button', { name: /end the conversation with mica/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
