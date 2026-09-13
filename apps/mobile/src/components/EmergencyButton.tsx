import { useRef, useState } from 'react'
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View, ActionSheetIOS, Platform, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { elevation, radii, spacing, FONT } from '../theme'
import { hapticWarning } from '../services/haptics'

const SCREEN = Dimensions.get('window')
const BTN_SIZE = 56
const PADDING = 12

interface Props {
  managerPhone?: string
}

export function EmergencyButton({ managerPhone }: Props) {
  const [pressed, setPressed] = useState(false)
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const isDragging = useRef(false)
  // Start at bottom-right: left = screenW - BTN_SIZE - PADDING, bottom = 100
  const initX = SCREEN.width - BTN_SIZE - PADDING
  const initY = SCREEN.height - 100 - BTN_SIZE
  const lastPos = useRef({ x: initX, y: initY })

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3) isDragging.current = true
        pan.setValue({ x: gs.dx, y: gs.dy })
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset()
        let nx = lastPos.current.x + gs.dx
        let ny = lastPos.current.y + gs.dy
        // Clamp to screen bounds
        nx = Math.max(PADDING, Math.min(SCREEN.width - BTN_SIZE - PADDING, nx))
        ny = Math.max(PADDING + 44, Math.min(SCREEN.height - BTN_SIZE - PADDING - 20, ny))
        lastPos.current = { x: nx, y: ny }
        Animated.spring(pan, { toValue: { x: nx, y: ny }, useNativeDriver: false, tension: 200, friction: 18 }).start()
      },
    })
  ).current

  const handlePress = () => {
    if (isDragging.current) return
    hapticWarning()
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Call 999 (Emergency)', 'Call 111 (NHS)', managerPhone ? 'Call Manager' : null].filter(Boolean) as string[],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) dialNumber('999')
          else if (buttonIndex === 2) dialNumber('111')
          else if (buttonIndex === 3 && managerPhone) dialNumber(managerPhone)
        }
      )
    } else {
      const options = ['Cancel', 'Call 999 (Emergency)', 'Call 111 (NHS)']
      if (managerPhone) options.push('Call Manager')
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        { text: '999 — Emergency', style: 'destructive', onPress: () => dialNumber('999') },
        { text: '111 — NHS', onPress: () => dialNumber('111') },
        ...(managerPhone ? [{ text: 'Manager', onPress: () => dialNumber(managerPhone) }] : []),
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
      style={[styles.button, pressed && styles.pressed, { transform: pan.getTranslateTransform() }]}
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
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  inner: { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#B91C1C', transform: [{ scale: 0.92 }] },
  label: { fontFamily: FONT, fontSize: 8, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, marginTop: 1 },
})
