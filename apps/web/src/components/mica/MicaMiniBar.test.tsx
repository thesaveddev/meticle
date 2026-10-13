import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaMiniBar from './MicaMiniBar'
import { createMicaAudioChannel } from './mica.audio'

/**
 * The bar is the surface Mica lives in after it opens a page, so what is pinned
 * here is that it always says something true and that both of its exits work:
 * expanding goes back to the overlay, ending closes the session (and with it the
 * microphone).
 */
const baseProps = {
  state: 'listening' as const,
  // The amplitude channel, not a level — see MicaOverlay.test.tsx.
  audio: createMicaAudioChannel(),
  transcript: '',
  responseMessage: null,
  lastNavigation: null,
  onExpand: vi.fn(),
  onEnd: vi.fn(),
}

describe('MicaMiniBar', () => {
  it('announces itself as the live session rather than as a second assistant', () => {
    render(<MicaMiniBar {...baseProps} />)
    const bar = screen.getByRole('status', { name: 'Mica — listening while you work' })
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('data-mica-mini', 'listening')
  })

  it('prioritises the reply, then the live words, then the page it opened', () => {
    const { rerender } = render(<MicaMiniBar {...baseProps} />)
    // Nothing said yet: the state's own copy, so the bar is never blank.
    expect(screen.getByText('is listening…')).toBeInTheDocument()

    rerender(<MicaMiniBar {...baseProps} transcript="and February" />)
    expect(screen.getByText('“and February”')).toBeInTheDocument()

    rerender(
      <MicaMiniBar
        {...baseProps}
        state="responding"
        responseMessage="Here's Evan Turner's March 2026 MAR chart."
        lastNavigation={{ path: '/emedication?personId=p1&month=2026-03', label: "Evan Turner's March 2026 MAR chart" }}
      />,
    )
    expect(screen.getByText("Here's Evan Turner's March 2026 MAR chart.")).toBeInTheDocument()

    // With the reply gone, the destination is what the bar reports — the carer
    // needs to see where they have been taken.
    rerender(
      <MicaMiniBar
        {...baseProps}
        state="responding"
        lastNavigation={{ path: '/emedication?personId=p1&month=2026-03', label: "Evan Turner's March 2026 MAR chart" }}
      />,
    )
    expect(screen.getByText(/Opened Evan Turner's March 2026 MAR chart/)).toBeInTheDocument()
  })

  it('expands or ends the conversation from its two controls, and on Escape', () => {
    const onExpand = vi.fn()
    const onEnd = vi.fn()
    render(<MicaMiniBar {...baseProps} onExpand={onExpand} onEnd={onEnd} />)

    fireEvent.click(screen.getByRole('button', { name: /expand mica/i }))
    expect(onExpand).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /end the conversation with mica/i }))
    expect(onEnd).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEnd).toHaveBeenCalledTimes(2)
  })
})
