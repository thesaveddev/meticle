import { useRef, useState, useEffect, useCallback } from 'react'
import { Animated, Image, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { mica, elevation, FONT } from '../theme'
import { hapticWarning, hapticMedium } from '../services/haptics'

const BTN_SIZE = 56
const PADDING = 12
const MIN_Y = 60
const DRAG_THRESHOLD = 12

export interface SosContact { label: string; phone: string }
export type OnMicaPress = () => void
export type OnSosPress = (contacts: SosContact[], managerPhone?: string) => void

export const MICA_ORB_IMAGE = require('../../assets/mica/MICA_AI_Listening_Orb.png')
export const MICA_IDLE_IMAGE = require('../../assets/mica/MeticleCare_Client_Overview_with_MICA_Idle.png')

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export function FloatingMicaOrb({ onMicaPress, onSosPress, sosContacts = [], managerPhone, idleImage, listeningImage, listening }: {
  onMicaPress: OnMicaPress
  onSosPress?: OnSosPress
  sosContacts?: SosContact[]
  managerPhone?: string
  idleImage?: any
  listeningImage?: any
  listening?: boolean
}) {
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [pressed, setPressed] = useState(false)

  // Mirror the position as a plain number; the Animated.Value is only used for
  // the animated style. This is the same split EmergencyButton uses and avoids
  // any reliance on Animated.Value's private internals.
  const posXNum = useRef(screenW - BTN_SIZE - PADDING)
  const posYNum = useRef(screenH - 160)
  const posX = useRef(new Animated.Value(screenW - BTN_SIZE - PADDING))
  const posY = useRef(new Animated.Value(screenH - 160))
  const isDragging = useRef(false)
  const longPressTriggered = useRef(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const startX = screenW - BTN_SIZE - PADDING
    const startY = screenH - 160
    posXNum.current = startX
    posYNum.current = startY
    posX.current.setValue(startX)
    posY.current.setValue(startY)
  }, [screenW, screenH])

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
    const nx = clamp(posXNum.current + gesture.dx, PADDING, screenW - BTN_SIZE - PADDING)
    const ny = clamp(posYNum.current + gesture.dy, MIN_Y, screenH - BTN_SIZE - 40)
    setPos(nx, ny)
  }, [screenW, screenH, setPos])

  const handlePanRelease = useCallback(() => {
    if (!isDragging.current) return
    const nx = clamp(posXNum.current, PADDING, screenW - BTN_SIZE - PADDING)
    const ny = clamp(posYNum.current, MIN_Y, screenH - BTN_SIZE - 40)
    const snapLeft = PADDING
    const snapRight = screenW - BTN_SIZE - PADDING
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
  }, [screenW, maybeTriggerLongPress])

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

  return (
    <Animated.View
      testID="mica-float"
      style={[styles.button, pressed && styles.pressed, { left: posX.current, top: posY.current }]}
      {...panHandlers}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.inner}
        accessibilityLabel="Mica assistant — tap to open, press and hold for emergency"
        accessibilityRole="button"
      >
        {listeningImage && listening ? (
          <Image source={listeningImage} style={styles.image} resizeMode="contain" />
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
    backgroundColor: '#2F80ED',
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
    backgroundColor: '#1F68C7',
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
