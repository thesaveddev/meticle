import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MicaOrb from './MicaOrb'
import { MICA_LABEL, MICA_STATES } from './mica.identity'

/**
 * Orb structure by state. The orb keeps one identity across every state — same
 * gradient, same eyes, same ambient glow — and each state adds exactly one
 * signal, so a state can never be mistaken for a different assistant:
 *
 * - every state: one ambient glow (the orb's resting signal)
 * - idle: interactive; one orbit svg; no waveform bars, no ring
 * - listening / thinking / responding: disabled; outer + inner orbit, the inner
 *   energy wave (3 svgs) and the 11-bar voice waveform
 * - error: disabled; same 3 svgs but **no** waveform — an error has nothing to
 *   meter — plus the danger ring as its one distinguishing signal
 *
 * Counts are asserted through the component's own `data-mica-*` hooks rather
 * than by matching colour literals: an earlier version of this file matched
 * `rgb(16, 191, 165)`, which silently stopped matching when the orb's cyan was
 * re-pointed at the brand token, so the test went on passing for the wrong
 * reason and then failed for the wrong one.
 */
const EXPECT = {
  idle: { enabled: true, svgs: 1, bars: 0, ring: false },
  listening: { enabled: false, svgs: 3, bars: 11, ring: false },
  thinking: { enabled: false, svgs: 3, bars: 11, ring: false },
  responding: { enabled: false, svgs: 3, bars: 11, ring: false },
  error: { enabled: false, svgs: 3, bars: 0, ring: true },
} as const

describe('MicaOrb', () => {
  // The state list is shared with the mobile app; a state added there without a
  // rendering contract here fails rather than silently rendering as idle.
  it('covers exactly the states in the identity contract', () => {
    expect(Object.keys(EXPECT).sort()).toEqual([...MICA_STATES].sort())
  })

  it.each(MICA_STATES)('renders the %s state', state => {
    const expected = EXPECT[state]
    const { container } = render(<MicaOrb state={state} />)

    const orb = screen.getByRole('button', { name: MICA_LABEL.orb })
    expect(orb).toBeInTheDocument()
    if (expected.enabled) {
      expect(orb).toBeEnabled()
    } else {
      expect(orb).toBeDisabled()
    }

    expect(container.querySelectorAll('svg')).toHaveLength(expected.svgs)
    // One ambient glow in every state, and bars only while metering speech.
    expect(container.querySelectorAll('[data-mica-glow]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-mica-bar]')).toHaveLength(expected.bars)
    expect(container.querySelector('[data-mica-waveform]') !== null).toBe(expected.bars > 0)
    expect(container.querySelector('[data-mica-ring="error"]') !== null).toBe(expected.ring)
  })

  it('invokes onPress only in the idle state', () => {
    const onPress = vi.fn()
    const idle = render(<MicaOrb state="idle" audioLevel={0} onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: MICA_LABEL.orb }))
    expect(onPress).toHaveBeenCalledTimes(1)
    idle.unmount()

    render(<MicaOrb state="listening" audioLevel={0.5} onPress={onPress} />)
    // Disabled button: the click must not trigger a new listening session.
    fireEvent.click(screen.getByRole('button', { name: MICA_LABEL.orb }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not offer a retry path from the orb itself in the error state', () => {
    // Recovery is the overlay's job (it owns the message and the close action);
    // tapping the orb must not silently restart a failed session.
    const onPress = vi.fn()
    render(<MicaOrb state="error" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: MICA_LABEL.orb }))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('clamps out-of-range audio levels without throwing', () => {
    expect(() => render(<MicaOrb state="listening" audioLevel={5} />)).not.toThrow()
    expect(() => render(<MicaOrb state="listening" audioLevel={-2} />)).not.toThrow()
  })
})
