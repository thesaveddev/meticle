import { useRef, useState, useEffect, useCallback } from 'react'
import { Animated, AppState, Image, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native'
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, FONT, mica, type MicaOrbState } from '../theme'
import { useReducedMotion } from '../utils/useReducedMotion'
import { hapticWarning, hapticMedium } from '../services/haptics'

const BTN_SIZE = mica.orb.size
const PADDING = mica.orb.sideInset
const MIN_Y = mica.orb.minTop
const DRAG_THRESHOLD = 12
/** The drag handle is taller than the circle: the "Mica" label sits under it. */
const ORB_BOX_HEIGHT = BTN_SIZE + 18

export interface SosContact { label: string; phone: string }
export type OnMicaPress = () => void
export type OnSosPress = (contacts: SosContact[], managerPhone?: string) => void

export const MICA_ORB_IMAGE = require('../../assets/mica/MICA_AI_Listening_Orb.png')
export const MICA_IDLE_IMAGE = require('../../assets/mica/MeticleCare_Client_Overview_with_MICA_Idle.png')

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export interface OrbBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  homeX: number
  homeY: number
  boxHeight: number
}

/**
 * Where the orb is allowed to be, in the screen frame's coordinate space.
 *
 * Extracted from the component so it can be *proved* rather than asserted. The
 * defect it fixes: bounds were computed from the raw window while the orb lives
 * inside an inset frame, so a dragged orb clamped 40px from the bottom of the
 * window — inside the ~68px tab bar — and parked a live control on top of the
 * navigation. `maxY` now keeps the whole box, the caller's `bottomClearance`
 * (the tab bar's real height) and `gap` above the frame's bottom edge on every
 * screen size, and `minY` keeps it below the top of the frame.
 */
export function orbBounds({
  width,
  height,
  insetTop = 0,
  insetBottom = 0,
  insetLeft = 0,
  insetRight = 0,
  bottomClearance = 0,
}: {
  width: number
  height: number
  insetTop?: number
  insetBottom?: number
  insetLeft?: number
  insetRight?: number
  bottomClearance?: number
}): OrbBounds {
  const frameW = Math.max(0, width - insetLeft - insetRight)
  const frameH = Math.max(0, height - insetTop - insetBottom)
  const clearance = bottomClearance + mica.orb.gap
  const minX = PADDING
  const maxX = Math.max(minX, frameW - BTN_SIZE - PADDING)
  const maxY = Math.max(MIN_Y, frameH - ORB_BOX_HEIGHT - clearance)
  return { minX, maxX, minY: MIN_Y, maxY, homeX: maxX, homeY: maxY, boxHeight: ORB_BOX_HEIGHT }
}

/**
 * The floating Mica orb.
 *
 * ## What it animates now, and where
 *
 * The orb had no motion at all: a static circle with a microphone glyph, while
 * the web orb breathed, pulsed and metered the room. It has all three states
 * now, driven by Reanimated shared values, so the motion runs on the UI thread
 * at the display's own rate and a JavaScript thread busy with a roster fetch or
 * an upload cannot stutter it:
 *
 *   - **idle** — a slow breath and a soft glow, the resting signal.
 *   - **listening** — a faster breath, a stronger glow, and one ring travelling
 *     outwards and fading: the same "I am hearing you" the web orb shows.
 *   - **thinking / responding** — contained, then calmer; the orb is working,
 *     not listening.
 *   - **error** — deliberately still, with the danger ring: a loop reads as
 *     progress, and a failure is not progressing.
 *
 * Every animated property is `transform` or `opacity`, which is the whole reason
 * the drag can use the native driver too (see below). `AppState` parks the
 * animation while the app is backgrounded — a hidden orb must not keep asking
 * for frames — and Reduce Motion parks it for good, on the same values, so the
 * orb stays exactly where it is on screen without moving.
 *
 * ## The drag
 *
 * Position used to be animated as `left`/`top`, which cannot use the native
 * driver: every drag frame went through JavaScript, then through a layout pass
 * on the shadow-casting view, which is the most expensive way to move a circle.
 * The orb is laid out once at its home position and moved by `translateX`/
 * `translateY` instead, so the pan and the snap spring run on the UI thread with
 * `useNativeDriver: true`. The JS-side numbers are still mirrored for the clamp
 * maths — that was already how this component worked, and it is what the bounds
 * below are proved against.
 */
export function FloatingMicaOrb({ onMicaPress, onSosPress, sosContacts = [], managerPhone, listeningImage, listening, state, bottomClearance }: {
  onMicaPress: OnMicaPress
  onSosPress?: OnSosPress
  sosContacts?: SosContact[]
  managerPhone?: string
  listeningImage?: any
  listening?: boolean
  /** Explicit orb state. Omitted → derived from `listening` (idle/listening). */
  state?: MicaOrbState
  /**
   * Height of anything sharing the bottom edge — the tab bar, when there is
   * one. The orb keeps this much space, plus `mica.orb.gap`, free below itself.
   */
  bottomClearance?: number
}) {
  const { width: screenW, height: screenH } = useWindowDimensions()
  // The orb is absolutely positioned inside the screen frame, and that frame is
  // a SafeAreaView with all four edges inset. So the frame's coordinate space is
  // the window minus the insets, and clamping against the raw window height let
  // the orb be dragged into the home-indicator strip and, on the tab shell, onto
  // the tab bar itself — a live control parked on the navigation.
  const insets = useSafeAreaInsets()
  const [pressed, setPressed] = useState(false)
  const reducedMotion = useReducedMotion()

  const { minX, maxX, maxY, homeX, homeY } = orbBounds({
    width: screenW,
    height: screenH,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    insetLeft: insets.left,
    insetRight: insets.right,
    bottomClearance: bottomClearance ?? 0,
  })

  // Mirror the position as plain numbers; the Animated.ValueXY holds only the
  // *offset* from the home position, which is what the transform animates.
  const posXNum = useRef(homeX)
  const posYNum = useRef(homeY)
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const isDragging = useRef(false)
  const longPressTriggered = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Move the orb to an absolute position by setting its offset from home. */
  const setPos = useCallback((x: number, y: number) => {
    posXNum.current = x
    posYNum.current = y
    drag.setValue({ x: x - homeX, y: y - homeY })
  }, [drag, homeX, homeY])

  useEffect(() => {
    posXNum.current = homeX
    posYNum.current = homeY
    drag.setValue({ x: 0, y: 0 })
  }, [drag, homeX, homeY])

  const maybeTriggerLongPress = useCallback(() => {
    if (!longPressTriggered.current) {
      longPressTriggered.current = true
      hapticWarning()
      onSosPress?.(sosContacts, managerPhone)
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [longPressTriggered, onSosPress, sosContacts, managerPhone])

  const handlePressIn = useCallback(() => {
    setPressed(true)
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(maybeTriggerLongPress, 450)
  }, [maybeTriggerLongPress])

  const handlePressOut = useCallback(() => {
    setPressed(false)
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleMoveShouldSet = useCallback((_evt: any, gesture: { dx: number; dy: number }) => {
    return Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD
  }, [])

  const handlePanGrant = useCallback(() => {
    isDragging.current = false
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }, [])

  const handlePanMove = useCallback((_evt: any, gesture: { dx: number; dy: number }) => {
    if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) isDragging.current = true
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    const nx = clamp(posXNum.current + gesture.dx, minX, maxX)
    const ny = clamp(posYNum.current + gesture.dy, MIN_Y, maxY)
    setPos(nx, ny)
  }, [minX, maxX, maxY, setPos])

  const handlePanRelease = useCallback(() => {
    if (!isDragging.current) return
    const nx = clamp(posXNum.current, minX, maxX)
    const ny = clamp(posYNum.current, MIN_Y, maxY)
    const snapLeft = minX
    const snapRight = maxX
    const snapX = (nx - snapLeft) < (snapRight - nx) ? snapLeft : snapRight
    posXNum.current = snapX
    posYNum.current = ny
    // Native driver: the snap is a transform on the UI thread, so it stays at
    // frame rate while JavaScript is finishing whatever the drag interrupted.
    Animated.parallel([
      Animated.spring(drag.x, { toValue: snapX - homeX, useNativeDriver: true, tension: 200, friction: 18 }),
      Animated.spring(drag.y, { toValue: ny - homeY, useNativeDriver: true, tension: 200, friction: 18 }),
    ]).start()
    longPressTimer.current = setTimeout(maybeTriggerLongPress, 450)
  }, [drag, homeX, homeY, maxX, maxY, minX, maybeTriggerLongPress])

  const panHandlers = useRef({
    onMoveShouldSetPanResponder: handleMoveShouldSet,
    onPanResponderTerminationRequest: () => true,
    onPanResponderGrant: handlePanGrant,
    onPanResponderMove: handlePanMove,
    onPanResponderRelease: handlePanRelease,
  }).current

  const handlePress = useCallback(() => {
    if (isDragging.current || longPressTriggered.current) return
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    hapticMedium()
    onMicaPress()
  }, [onMicaPress])

  // `state` wins when given; otherwise the legacy `listening` flag maps onto the
  // shared vocabulary, so every existing call site keeps its behaviour.
  const orbState: MicaOrbState = state ?? (listening ? 'listening' : 'idle')
  const showListeningImage = orbState === 'listening' && Boolean(listeningImage)

  /*
   * Backgrounded apps get no frames, and an infinite animation nobody can see is
   * work for nobody. `paused` participates in the effect below rather than
   * sitting beside it, so there is exactly one place that starts and stops the
   * animations and no way for the two to disagree.
   */
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => setPaused(next !== 'active'))
    return () => subscription.remove()
  }, [])

  const breathe = useSharedValue(1)
  const glow = useSharedValue(0)
  const ripple = useSharedValue(0)

  useEffect(() => {
    // Stop first: a state change replaces the loop rather than layering a second
    // one on top, and unmount stops it outright — no orphaned animation.
    cancelAnimation(breathe)
    cancelAnimation(glow)
    cancelAnimation(ripple)

    if (reducedMotion || paused || orbState === 'error') {
      // Parked, not merely slowed: same position, same size, no movement.
      breathe.value = 1
      glow.value = orbState === 'error' ? 0.24 : 0.35
      ripple.value = 0
      return () => {
        cancelAnimation(breathe)
        cancelAnimation(glow)
        cancelAnimation(ripple)
      }
    }

    const breath = (to: number, ms: number) =>
      withRepeat(
        withSequence(
          withTiming(to, { duration: ms, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: ms, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    const pulse = (to: number, ms: number) =>
      withRepeat(
        withSequence(
          withTiming(to, { duration: ms, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: ms, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )

    if (orbState === 'idle') {
      breathe.value = breath(1.03, 2400)
      glow.value = pulse(0.5, 2600)
    } else if (orbState === 'listening') {
      breathe.value = breath(1.06, 600)
      glow.value = pulse(0.95, 600)
      // One ring travelling outwards and fading: the visual "I am hearing you".
      ripple.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      )
    } else if (orbState === 'thinking') {
      breathe.value = breath(1.045, 450)
      glow.value = pulse(0.8, 450)
    } else {
      breathe.value = breath(1.04, 700)
      glow.value = pulse(0.72, 700)
    }

    return () => {
      cancelAnimation(breathe)
      cancelAnimation(glow)
      cancelAnimation(ripple)
    }
  }, [breathe, glow, ripple, orbState, paused, reducedMotion])

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.22 }],
  }))
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.55,
    transform: [{ scale: 1 + ripple.value * 0.9 }],
  }))

  return (
    <Animated.View
      testID="mica-float"
      style={[
        styles.button,
        pressed && styles.pressed,
        orbState === 'error' && styles.error,
        { left: homeX, top: homeY, transform: [{ translateX: drag.x }, { translateY: drag.y }] },
      ]}
      {...panHandlers}
    >
      {/* The glow and the ripple sit behind the control and never take a touch;
          both animate opacity and scale only. */}
      <Reanimated.View
        testID="mica-orb-glow"
        pointerEvents="none"
        style={[styles.glow, glowStyle]}
      />
      {orbState === 'listening' && (
        <Reanimated.View
          testID="mica-orb-ripple"
          pointerEvents="none"
          style={[styles.ripple, rippleStyle]}
        />
      )}
      <Reanimated.View style={orbStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.inner}
          accessibilityLabel={mica.a11y.orb}
          accessibilityRole="button"
        >
          {showListeningImage ? (
            <Image source={listeningImage} style={styles.image} resizeMode="contain" />
          ) : orbState === 'error' ? (
            <Ionicons name="alert-circle" size={22} color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="mic" size={22} color="#FFFFFF" />
              <Text style={styles.label}>Mica</Text>
            </>
          )}
        </Pressable>
      </Reanimated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE + 18,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#0164C8',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  inner: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  // A halo behind the control, in the orb's own teal. Opacity and scale only —
  // no shadow animation, which on Android is a per-frame re-raster.
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 18,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#03C6B1',
  },
  ripple: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: BTN_SIZE + 12,
    height: BTN_SIZE + 12,
    borderRadius: (BTN_SIZE + 12) / 2,
    borderWidth: 2,
    borderColor: '#03C6B1',
  },
  pressed: {
    backgroundColor: '#014FB5',
  },
  // Error keeps Mica's blue and adds a danger ring: same control, different
  // condition — not a second visual language for one state.
  error: {
    borderWidth: 2,
    borderColor: mica.errorRing,
    backgroundColor: mica.surfaceStrong,
  },
  label: {
    fontFamily: FONT,
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: 1,
  },
})
