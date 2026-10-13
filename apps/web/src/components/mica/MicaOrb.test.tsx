import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import MicaOrb from './MicaOrb'
import { createMicaAudioChannel } from './mica.audio'
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
    const idle = render(<MicaOrb state="idle" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: MICA_LABEL.orb }))
    expect(onPress).toHaveBeenCalledTimes(1)
    idle.unmount()

    render(<MicaOrb state="listening" onPress={onPress} />)
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

  it('clamps out-of-range audio levels instead of throwing or overscaling', () => {
    // The level reaches the orb through the session's channel, not as a prop, so
    // this is also the test that the orb listens at all: a level published for a
    // live state has to land on the elements that are supposed to move.
    const audio = createMicaAudioChannel()
    const { container } = render(<MicaOrb state="listening" audio={audio} />)
    const core = container.querySelector('.mica-core-scale') as HTMLElement
    const waveform = container.querySelector('[data-mica-waveform]') as HTMLElement

    act(() => audio.publish(5))
    expect(core.style.transform).toBe('scale(1.0600)')

    act(() => audio.publish(-2))
    expect(core.style.transform).toBe('scale(1.0000)')

    act(() => audio.publish(Number.NaN))
    expect(core.style.transform).toBe('scale(1.0000)')

    act(() => audio.publish(0.5))
    expect(core.style.transform).toBe('scale(1.0300)')
    // Straight onto the transform, and only ever the transform: nothing here
    // triggers a React render, which is the whole point of the channel.
    expect(waveform.style.transform).toBe('scaleY(1.1250)')
  })

  it('stalls its motion when the tab is hidden', () => {
    const { container } = render(<MicaOrb state="idle" />)
    const root = container.querySelector('.mica-root') as HTMLElement
    expect(root).toHaveAttribute('data-mica-paused', 'false')

    // Hiding the document pauses the animation at the animation layer, so the
    // cost disappears without a render and resumes exactly where it stopped.
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(root).toHaveAttribute('data-mica-paused', 'true')

    visibility.mockReturnValue('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(root).toHaveAttribute('data-mica-paused', 'false')
  })

  it('goes still under prefers-reduced-motion, and stays responsive', () => {
    const media = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })

    try {
      const audio = createMicaAudioChannel()
      const onPress = vi.fn()
      const { container } = render(<MicaOrb state="idle" audio={audio} onPress={onPress} />)

      // Flagged for the CSS, which is where "still" is actually implemented —
      // the states, the gradient, the eyes and the glow all stay exactly as they
      // are, so nothing is lost but the movement.
      expect(container.querySelector('.mica-root')).toHaveAttribute('data-mica-motion', 'reduced')
      // And the orb is still the way in.
      fireEvent.click(screen.getByRole('button', { name: MICA_LABEL.orb }))
      expect(onPress).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: media })
    }
  })

  afterEach(() => { vi.restoreAllMocks() })
})
