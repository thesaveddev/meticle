/**
 * The SOS button was visible on the installed app and completely dead to taps.
 *
 * It is a draggable button, so the parent Animated.View carries a PanResponder
 * and that PanResponder competes with the inner Pressable for the same touch.
 * The PanResponder used to claim the touch on the first move event of any size
 * (`onMoveShouldSetPanResponder: () => true`). A finger never lands perfectly
 * still, so an ordinary tap produced a one- or two-pixel move, the parent became
 * the responder, the Pressable was terminated, and `onPress` never ran. The
 * emergency call could not be made from the app at all.
 *
 * The bug survived because every other test in EmergencyButton.test.tsx uses
 * `fireEvent.press`, which invokes the Pressable's `onPress` directly and
 * bypasses responder negotiation entirely. All of them passed against a button
 * that did nothing. These tests go through the generated responder handler
 * instead, which is the thing that actually decides whether a tap dials.
 */
import React from 'react'
import { render } from '@testing-library/react-native'
import { EmergencyButton, isDragGesture } from '../EmergencyButton'

const EVENT = { nativeEvent: {} } as any

describe('SOS button drag threshold', () => {
  it('does not read ordinary finger drift as a drag', () => {
    // A hand resting on a 56px target drifts a few pixels as a matter of course.
    for (const [dx, dy] of [[1, 0], [0, 1], [2, 2], [3, 4], [6, 6], [0, 11], [11, 0]]) {
      expect(isDragGesture(dx, dy)).toBe(false)
    }
  })

  it('reads a deliberate drag as a drag', () => {
    for (const [dx, dy] of [[13, 0], [0, 13], [40, 0], [0, -40], [25, 25]]) {
      expect(isDragGesture(dx, dy)).toBe(true)
    }
  })

  it('ignores the direction of travel, so a left or upward drag still moves it', () => {
    expect(isDragGesture(-40, 0)).toBe(true)
    expect(isDragGesture(0, -40)).toBe(true)
  })
})

describe('SOS button responder contract', () => {
  function hostProps() {
    const screen = render(<EmergencyButton contacts={[{ label: 'Office', phone: '020 7946 0000' }]} />)
    return screen.getByTestId('sos-drag-host').props as Record<string, any>
  }

  it('does not take the touch away from the Pressable before the finger has travelled', () => {
    // This is the bug, and this is the assertion that catches it. PanResponder
    // calls this handler with its own gestureState, which is still dx=0/dy=0
    // until real touch history arrives — so this return value is exactly the
    // answer to "a finger has landed but has not moved", which is the state
    // every tap passes through. It used to return true, and the parent took the
    // touch away from the Pressable before onPress could run.
    const props = hostProps()
    expect(typeof props.onMoveShouldSetResponder).toBe('function')
    expect(props.onMoveShouldSetResponder(EVENT)).toBe(false)
  })

  it('carries the drag handlers, so the button remains repositionable', () => {
    const props = hostProps()
    expect(typeof props.onResponderMove).toBe('function')
    expect(typeof props.onResponderRelease).toBe('function')
    expect(typeof props.onResponderTerminationRequest).toBe('function')
  })
})
