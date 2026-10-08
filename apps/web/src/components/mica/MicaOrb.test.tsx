import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaOrb from './MicaOrb'

const STATES = ['idle', 'listening', 'thinking', 'responding'] as const

/**
 * Orb structure by state:
 * - every state renders the "MICA AI assistant" button
 * - idle: interactive, one orbit svg, no inner counter-orbit, no waveform
 * - active: disabled, outer + inner orbit + inner energy wave (3 svgs), and the
 *   11-bar voice waveform container
 */
describe('MicaOrb', () => {
  it.each(STATES)('renders the %s state', state => {
    const { container } = render(<MicaOrb state={state} />)

    const orb = screen.getByRole('button', { name: 'MICA AI assistant' })
    expect(orb).toBeInTheDocument()

    if (state === 'idle') {
      expect(orb).toBeEnabled()
      // Outer orbit only.
      expect(container.querySelectorAll('svg')).toHaveLength(1)
      // No voice waveform bars while resting — only the ambient glow carries
      // the cyan background.
      expect(container.querySelectorAll('div[style*="rgb(16, 191, 165)"]')).toHaveLength(1)
    } else {
      expect(orb).toBeDisabled()
      // Outer orbit + inner counter-orbit + inner energy wave.
      expect(container.querySelectorAll('svg')).toHaveLength(3)
      // 11 waveform bars plus the ambient glow share the cyan background.
      expect(container.querySelectorAll('div[style*="rgb(16, 191, 165)"]')).toHaveLength(12)
    }
  })

  it('invokes onPress only in the idle state', () => {
    const onPress = vi.fn()
    const idle = render(<MicaOrb state="idle" audioLevel={0} onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'MICA AI assistant' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    idle.unmount()

    render(<MicaOrb state="listening" audioLevel={0.5} onPress={onPress} />)
    // Disabled button: the click must not trigger a new listening session.
    fireEvent.click(screen.getByRole('button', { name: 'MICA AI assistant' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('clamps out-of-range audio levels without throwing', () => {
    expect(() => render(<MicaOrb state="listening" audioLevel={5} />)).not.toThrow()
    expect(() => render(<MicaOrb state="listening" audioLevel={-2} />)).not.toThrow()
  })
})
