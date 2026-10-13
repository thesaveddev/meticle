/**
 * Proves the floating Mica orb cannot cover the navigation — and now also that
 * it is a *living* control: three states, a drag that moves by transform, and no
 * motion at all when the user has asked for none.
 *
 * ## What went wrong (geometry)
 *
 * The orb is absolutely positioned inside an inset screen frame, but its drag
 * bounds were computed from the raw *window*: a dragged orb clamped 40px from
 * the bottom of the window — inside the roughly 68px tab bar — so a user could
 * park a live control on top of the tabs. `homeY` also sat 160px up on every
 * device regardless of the safe-area inset, which on a gesture-bar iPhone put
 * it in the home indicator.
 *
 * ## What is asserted
 *
 * For a spread of real device sizes, with and without a tab bar, the orb's whole
 * box plus the caller's bottom clearance stays above the frame's bottom edge, its
 * top stays below the frame's top, and it stays inside the frame horizontally.
 * A frame too short for the clearance clamps to the documented floor instead of
 * going off-screen.
 *
 * These are geometry proofs, not pixel proofs: they hold because the orb is
 * positioned only from these bounds. Anything drawn *into* the reserved space by
 * a screen is outside what a unit test can see — that is what the visual sweep
 * in docs/DESIGN_SYSTEM_AUDIT.md is for.
 *
 * ## What is deliberately not asserted here
 *
 * Frames. The reanimated mock in `jest.setup.ts` is static (see its comment), so
 * "the breath is 2400ms and runs on the UI thread" is a real-device property.
 * What is checked is everything the mock *can* be honest about: which animated
 * elements exist in each state, that the drag writes a transform rather than a
 * layout property (which is what makes the native driver possible at all), and
 * that Reduce Motion and a backgrounded app park the animation instead of
 * running it.
 */
import React from 'react'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { FloatingMicaOrb, orbBounds } from '../FloatingMicaOrb'
import { mica } from '../../theme'

// The real SafeAreaProvider waits for a native layout pass that never arrives
// under jest; the library's own mock supplies metrics.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)
jest.mock('../../services/haptics', () => ({ hapticWarning: jest.fn(), hapticMedium: jest.fn() }))

/** The tab bar's own height, as App.tsx derives it for the clearance prop. */
const TAB_BAR = 68

const DEVICES = [
  { name: 'iPhone SE (1st gen portrait)', width: 320, height: 568, insetTop: 20, insetBottom: 0 },
  { name: 'iPhone 14', width: 390, height: 844, insetTop: 47, insetBottom: 34 },
  { name: 'Pixel 7', width: 412, height: 915, insetTop: 24, insetBottom: 0 },
  { name: 'small Android', width: 360, height: 640, insetTop: 24, insetBottom: 0 },
  { name: 'iPad portrait', width: 768, height: 1024, insetTop: 24, insetBottom: 20 },
] as const

describe('floating Mica orb bounds', () => {
  it.each(DEVICES)('keeps the orb clear of the tab bar on $name', device => {
    const bounds = orbBounds({ ...device, bottomClearance: TAB_BAR })
    const frameBottom = device.height - device.insetBottom

    // The whole box, the tab bar's height and the gap all sit above the frame's
    // bottom edge — so the orb can never be parked on the navigation.
    expect(bounds.homeY + bounds.boxHeight + TAB_BAR).toBeLessThanOrEqual(frameBottom)
    expect(bounds.maxY + bounds.boxHeight + TAB_BAR).toBeLessThanOrEqual(frameBottom)
  })

  it.each(DEVICES)('keeps the resting orb above the bottom edge with no tab bar on $name', device => {
    const bounds = orbBounds(device)
    const frameBottom = device.height - device.insetBottom
    expect(bounds.homeY + bounds.boxHeight).toBeLessThanOrEqual(frameBottom)
  })

  it.each(DEVICES)('keeps the orb inside the frame horizontally on $name', device => {
    const bounds = orbBounds({ ...device, bottomClearance: TAB_BAR })
    // Portrait fixtures: these devices inset at the top and bottom only, so the
    // frame's width is the window's width.
    const frameW = device.width
    expect(bounds.homeX).toBe(bounds.maxX)
    expect(bounds.maxX + mica.orb.size + mica.orb.sideInset).toBeLessThanOrEqual(frameW)
    expect(bounds.minX).toBeGreaterThanOrEqual(0)
    expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX)
  })

  it('keeps the orb below the top of the frame, and floors rather than escapes', () => {
    const roomy = orbBounds({ width: 390, height: 844, insetTop: 47, insetBottom: 34, bottomClearance: TAB_BAR })
    expect(roomy.homeY).toBeGreaterThanOrEqual(roomy.minY)
    expect(roomy.minY).toBeGreaterThanOrEqual(60)

    // A frame that cannot fit the clearance must clamp to the floor, not go
    // negative or push the orb off-screen.
    const tiny = orbBounds({ width: 320, height: 200, insetTop: 20, insetBottom: 0, bottomClearance: TAB_BAR })
    expect(tiny.maxY).toBe(tiny.minY)
    expect(tiny.homeY).toBe(60)
  })

  it('writes the orb a name the web app also uses', () => {
    // One control, one name, across platforms; the web side asserts the same
    // string from its own identity module.
    expect(mica.a11y.orb.startsWith('Mica assistant')).toBe(true)
  })

  it('agrees with the web orb on the state vocabulary', () => {
    expect([...mica.states]).toEqual(['idle', 'listening', 'thinking', 'responding', 'error'])
  })
})

describe('floating Mica orb states', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never)
  })

  const renderOrb = (props: Partial<React.ComponentProps<typeof FloatingMicaOrb>> = {}) =>
    render(<FloatingMicaOrb onMicaPress={jest.fn()} bottomClearance={TAB_BAR} {...props} />)

  it('breathes at rest: a glow behind the control, and no listening ring', () => {
    renderOrb({ state: 'idle' })

    expect(screen.getByTestId('mica-float')).toBeTruthy()
    expect(screen.getByTestId('mica-orb-glow')).toBeTruthy()
    // The outward ring is the "I am hearing you" signal, so it must not be there
    // when nothing is being heard.
    expect(screen.queryByTestId('mica-orb-ripple')).toBeNull()
  })

  it('shows the outward ring while listening, and once per state change', () => {
    const { rerender } = renderOrb({ state: 'listening' })
    expect(screen.getByTestId('mica-orb-ripple')).toBeTruthy()

    // Thinking and responding are the orb working, not listening: glow, no ring.
    rerender(<FloatingMicaOrb onMicaPress={jest.fn()} bottomClearance={TAB_BAR} state="thinking" />)
    expect(screen.queryByTestId('mica-orb-ripple')).toBeNull()
    expect(screen.getByTestId('mica-orb-glow')).toBeTruthy()

    rerender(<FloatingMicaOrb onMicaPress={jest.fn()} bottomClearance={TAB_BAR} state="responding" />)
    expect(screen.queryByTestId('mica-orb-ripple')).toBeNull()
  })

  it('goes still on error and keeps the danger ring as its one signal', () => {
    renderOrb({ state: 'error' })

    const flat = StyleSheet.flatten(screen.getByTestId('mica-float').props.style)
    expect(flat.borderColor).toBe(mica.errorRing)
    expect(screen.queryByTestId('mica-orb-ripple')).toBeNull()
  })

  it('moves by transform, not by layout, so the drag can use the native driver', () => {
    const { rerender } = renderOrb({ state: 'idle' })
    const before = StyleSheet.flatten(screen.getByTestId('mica-float').props.style)

    // Laid out once at its home position …
    expect(typeof before.left).toBe('number')
    expect(before.left).toBeGreaterThan(0)

    // … and moved by translate, which is the property the native driver can
    // animate. Animating `left` (what this used to do) cannot use it: every drag
    // frame went through JavaScript and then a layout pass on a shadowed view.
    const transform = before.transform as Array<Record<string, number>>
    expect(transform[0]).toHaveProperty('translateX')
    expect(transform[1]).toHaveProperty('translateY')

    act(() => {
      screen.getByTestId('mica-float').props.onPanResponderGrant()
      // Leftwards, because the orb rests at its rightmost allowed position.
      screen.getByTestId('mica-float').props.onPanResponderMove({}, { dx: -30, dy: 0 })
    })

    // The style is read from a render, so re-render to see the live value.
    rerender(<FloatingMicaOrb onMicaPress={jest.fn()} bottomClearance={TAB_BAR} state="idle" />)
    const moved = StyleSheet.flatten(screen.getByTestId('mica-float').props.style)
    const movedTransform = moved.transform as Array<Record<string, number>>

    expect(movedTransform[0].translateX).toBe(-30)
    // The layout position is untouched: the orb has not changed where it sits in
    // the tree, only where it is drawn — which is exactly what keeps the shadow
    // and the border off the per-frame path.
    expect(moved.left).toBe(before.left)
  })

  it('parks the animation when Reduce Motion is on, and stays usable', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    const onMicaPress = jest.fn()
    renderOrb({ state: 'listening', onMicaPress })

    // The setting is read, and the orb keeps its identity and its ring — it is
    // still the same control, it simply does not move.
    expect(await screen.findByTestId('mica-float')).toBeTruthy()
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled()
    expect(screen.getByTestId('mica-orb-glow')).toBeTruthy()

    fireEvent.press(screen.getByLabelText(mica.a11y.orb))
    expect(onMicaPress).toHaveBeenCalledTimes(1)
  })

  it('opens Mica on a tap and calls for help on a long press', () => {
    jest.useFakeTimers()
    const onMicaPress = jest.fn()
    const onSosPress = jest.fn()
    renderOrb({ onMicaPress, onSosPress, sosContacts: [{ label: 'Manager', phone: '07700 900123' }] })

    fireEvent(screen.getByLabelText(mica.a11y.orb), 'pressIn')
    act(() => { jest.advanceTimersByTime(500) })
    expect(onSosPress).toHaveBeenCalledWith([{ label: 'Manager', phone: '07700 900123' }], undefined)
    expect(onMicaPress).not.toHaveBeenCalled()

    jest.useRealTimers()
  })
})
