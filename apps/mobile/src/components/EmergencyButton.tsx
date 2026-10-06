import { useRef, useState, useEffect } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, ActionSheetIOS, Platform, Alert, useWindowDimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { elevation, FONT } from '../theme'
import { hapticWarning } from '../services/haptics'
import type { SessionOrganisation } from '../types'

const BTN_SIZE = 56
const PADDING = 12
const MIN_Y = 60

/**
 * How far a finger must travel before the button treats the gesture as a drag.
 *
 * Deliberately generous. This is a safety control, so a slightly slower drag to
 * reposition it is a much better outcome than a tap that does not dial. Three
 * pixels was within the range of ordinary hand tremor.
 */
const DRAG_THRESHOLD = 12

/**
 * Whether a movement should be read as a drag rather than a tap.
 *
 * Exported so the rule can be asserted directly, and so
 * __tests__/EmergencyButtonGesture.test.tsx can check it without depending on how
 * a particular React Native version plumbs PanResponder handlers onto a view.
 */
export function isDragGesture(dx: number, dy: number): boolean {
  return Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD
}

export interface SosContact {
  label: string
  phone: string
}

interface Props {
  /** Organisation-defined numbers, shown after 999 and 111. */
  contacts?: SosContact[]
  managerPhone?: string
}

/**
 * Maps the organisation payload delivered with the session into SOS contacts.
 * A number without a label still appears, under an office/supervisor default,
 * because an unlabelled number a carer can dial beats a number they cannot see.
 */
export function organisationSosContacts(organization: SessionOrganisation | null | undefined): SosContact[] {
  if (!organization) return []
  const pairs = [
    { label: organization.emergency_contact_1_label || 'Office', phone: organization.emergency_contact_1_phone },
    { label: organization.emergency_contact_2_label || 'Supervisor', phone: organization.emergency_contact_2_phone },
  ]
  return pairs.filter(p => !!p.phone).map(p => ({ label: p.label, phone: String(p.phone) }))
}

/**
 * The dial options offered by the SOS button, in order. The emergency services
 * come first so organisation numbers are additions to them, never a substitute.
 */
export function sosTargets(contacts: SosContact[], managerPhone?: string): SosContact[] {
  return [
    { label: '999 — Emergency', phone: '999' },
    { label: '111 — NHS', phone: '111' },
    ...contacts,
    ...(managerPhone ? [{ label: 'Manager', phone: managerPhone }] : []),
  ]
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export function EmergencyButton({ contacts = [], managerPhone }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [pressed, setPressed] = useState(false)
  const isDragging = useRef(false)

  // Current position — start at bottom-right
  const posX = useRef(screenW - BTN_SIZE - PADDING)
  const posY = useRef(screenH - 160)

  // Track if we've initialized position after first valid dimensions
  const initialized = useRef(false)

  // Snap to bottom-right once we have real dimensions
  useEffect(() => {
    if (!initialized.current && screenW > 0 && screenH > 0) {
      initialized.current = true
      const startX = screenW - BTN_SIZE - PADDING
      const startY = screenH - 160
      posX.current = startX
      posY.current = startY
      panX.setValue(startX)
      panY.setValue(startY)
    }
  }, [screenW, screenH])

  // Position at the start of the current gesture
  const gestureStartX = useRef(0)
  const gestureStartY = useRef(0)

  const panX = useRef(new Animated.Value(screenW - BTN_SIZE - PADDING)).current
  const panY = useRef(new Animated.Value(screenH - 160)).current

  const panResponder = useRef(
    PanResponder.create({
      // Only take the touch once the finger has genuinely travelled.
      //
      // This is the bug that made the button dead on the installed app. A
      // PanResponder on this parent competes with the Pressable below it for the
      // same touch, and this used to be `() => true` — claim the touch on the
      // first move event, whatever its size. A finger never lands perfectly
      // still: a real tap delivers a move of one or two pixels, that was enough
      // for the parent to become the responder, the Pressable was terminated, and
      // onPress never ran. The button rendered, looked fine, and did absolutely
      // nothing — the emergency call could not be made from the app at all.
      //
      // It stayed hidden because every existing test used fireEvent.press, which
      // invokes onPress directly and bypasses responder negotiation, so the whole
      // suite passed while the button was dead on a device. See
      // __tests__/EmergencyButtonGesture.test.tsx.
      onMoveShouldSetPanResponder: (_event, gesture) => isDragGesture(gesture.dx, gesture.dy),
      // Hand the touch back if something above needs it, so a drag that started
      // on the button cannot trap the responder.
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false
        gestureStartX.current = posX.current
        gestureStartY.current = posY.current
      },
      onPanResponderMove: (_, gs) => {
        if (isDragGesture(gs.dx, gs.dy)) isDragging.current = true

        const nx = clamp(gestureStartX.current + gs.dx, PADDING, screenW - BTN_SIZE - PADDING)
        const ny = clamp(gestureStartY.current + gs.dy, MIN_Y, screenH - BTN_SIZE - 40)
        posX.current = nx
        posY.current = ny
        panX.setValue(nx)
        panY.setValue(ny)
      },
      onPanResponderRelease: () => {
        if (!isDragging.current) return
        const nx = clamp(posX.current, PADDING, screenW - BTN_SIZE - PADDING)
        const ny = clamp(posY.current, MIN_Y, screenH - BTN_SIZE - 40)
        // Snap to nearest horizontal edge
        const snapLeft = PADDING
        const snapRight = screenW - BTN_SIZE - PADDING
        const snapX = (nx - snapLeft) < (snapRight - nx) ? snapLeft : snapRight
        posX.current = snapX
        posY.current = ny
        Animated.parallel([
          Animated.spring(panX, { toValue: snapX, useNativeDriver: false, tension: 200, friction: 18 }),
          Animated.spring(panY, { toValue: ny, useNativeDriver: false, tension: 200, friction: 18 }),
        ]).start()
      },
    })
  ).current

  const handlePress = () => {
    if (isDragging.current) return
    hapticWarning()

    const targets = sosTargets(contacts, managerPhone)

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...targets.map(t => `Call ${t.label}`)],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          const target = targets[buttonIndex - 1]
          if (target) dialNumber(target.phone)
        }
      )
    } else {
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        ...targets.map(t => ({
          text: t.label,
          ...(t.phone === '999' ? { style: 'destructive' as const } : {}),
          onPress: () => dialNumber(t.phone),
        })),
      ])
    }
  }

  const dialNumber = async (number: string) => {
    try {
      const url = `tel:${number}`
      const canOpen = await Linking.canOpenURL(url)
      if (canOpen) await Linking.openURL(url)
      else Alert.alert('Cannot make calls', `Dial ${number} manually from your phone app.`)
    } catch {
      Alert.alert('Error', `Could not open phone dialer. Please call ${number} manually.`)
    }
  }

  return (
    <Animated.View
      // Lets the responder contract be asserted directly; see
      // __tests__/EmergencyButtonGesture.test.tsx.
      testID="sos-drag-host"
      style={[styles.button, pressed && styles.pressed, {
        left: panX,
        top: panY,
      }]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={handlePress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={styles.inner} accessibilityLabel="Emergency call" accessibilityRole="button">
        <Ionicons name="call" size={20} color="#FFFFFF" />
        <Text style={styles.label}>SOS</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  inner: { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#B42318' },
  label: { fontFamily: FONT, fontSize: 8, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, marginTop: 1 },
})
