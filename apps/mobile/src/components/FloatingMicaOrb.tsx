import { useRef, useState, useEffect, useCallback } from 'react'
import { Animated, Image, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, FONT, mica, type MicaOrbState } from '../theme'
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

  const { minX, maxX, maxY, homeX, homeY } = orbBounds({
    width: screenW,
    height: screenH,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    insetLeft: insets.left,
    insetRight: insets.right,
    bottomClearance: bottomClearance ?? 0,
  })

  // Mirror the position as a plain number; the Animated.Value is only used for
  // the animated style. This is the same split EmergencyButton uses and avoids
  // any reliance on Animated.Value's private internals.
  const posXNum = useRef(homeX)
  const posYNum = useRef(homeY)
  const posX = useRef(new Animated.Value(homeX))
  const posY = useRef(new Animated.Value(homeY))
  const isDragging = useRef(false)
  const longPressTriggered = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    posXNum.current = homeX
    posYNum.current = homeY
    posX.current.setValue(homeX)
    posY.current.setValue(homeY)
  }, [homeX, homeY])

  const maybeTriggerLongPress = useCallback(() => {
    if (!longPressTriggered.current) {
      longPressTriggered.current = true
      hapticWarning()
      onSosPress?.(sosContacts, managerPhone)
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [longPressTriggered, onSosPress, sosContacts, managerPhone])

  const setPos = useCallback((x: number, y: number) => {
    posXNum.current = x
    posYNum.current = y
    posX.current.setValue(x)
    posY.current.setValue(y)
  }, [])

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
    posX.current.setValue(snapX)
    posY.current.setValue(ny)
    Animated.parallel([
      Animated.spring(posX.current, { toValue: snapX, useNativeDriver: false, tension: 200, friction: 18 }),
      Animated.spring(posY.current, { toValue: ny, useNativeDriver: false, tension: 200, friction: 18 }),
    ]).start()
    longPressTimer.current = setTimeout(maybeTriggerLongPress, 450)
  }, [maxX, maxY, minX, maybeTriggerLongPress])

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

  return (
    <Animated.View
      testID="mica-float"
      style={[
        styles.button,
        pressed && styles.pressed,
        orbState === 'error' && styles.error,
        { left: posX.current, top: posY.current },
      ]}
      {...panHandlers}
    >
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
