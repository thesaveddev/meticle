import { useRef, useState } from 'react'
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View, ActionSheetIOS, Platform, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { elevation, radii, spacing, FONT } from '../theme'
import { hapticWarning } from '../services/haptics'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const BTN_SIZE = 56

interface Props {
  managerPhone?: string
}

export function EmergencyButton({ managerPhone }: Props) {
  const [pressed, setPressed] = useState(false)
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const isDragging = useRef(false)
  const lastOffset = useRef({ x: 0, y: 0 })

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false
        pan.setOffset({ x: lastOffset.current.x, y: lastOffset.current.y })
        pan.setValue({ x: 0, y: 0 })
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3) {
          isDragging.current = true
        }
        // Move freely in both X and Y
        pan.setValue({ x: gestureState.dx, y: gestureState.dy })
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset()

        let newX = lastOffset.current.x + gestureState.dx
        let newY = lastOffset.current.y + gestureState.dy

        // Clamp X so button stays within screen bounds
        // Button starts at right: spacing.base (8px) which in translate coords = 0
        // Max right translate: positive moves right, max = screen edge
        // Max left translate: negative moves left, max = -(screenW - BTN_SIZE - spacing.base)
        const maxRight = 0
        const minLeft = -(SCREEN_W - BTN_SIZE - spacing.base * 2)
        newX = Math.max(minLeft, Math.min(maxRight, newX))

        // Clamp Y so button stays within screen bounds
        // Button starts at bottom: 100, so in translate coords 0 = bottom:100
        // Max up: move to top of screen (max negative Y)
        // Max down: move to bottom (max positive Y)
        const initialBottom = 100
        const maxDown = initialBottom - 20 // don't go below screen
        const minUp = -(SCREEN_H - initialBottom - BTN_SIZE - 40) // don't go above screen
        newY = Math.max(minUp, Math.min(maxDown, newY))

        lastOffset.current = { x: newX, y: newY }

        // Snap to nearest horizontal edge
        const midX = (SCREEN_W - BTN_SIZE) / 2 - spacing.base
        const snapX = newX > midX ? maxRight : minLeft

        Animated.spring(pan, {
          toValue: { x: snapX, y: newY },
          useNativeDriver: false,
          tension: 200,
          friction: 15,
        }).start()

        lastOffset.current = { x: snapX, y: newY }
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
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Cannot make calls', `Dial ${number} manually from your phone app.`)
      }
    } catch {
      Alert.alert('Error', `Could not open phone dialer. Please call ${number} manually.`)
    }
  }

  return (
    <Animated.View
      style={[
        styles.button,
        pressed && styles.buttonPressed,
        { transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={styles.buttonInner}
        accessibilityLabel="Emergency call"
        accessibilityRole="button"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="call" size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.label}>SOS</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 100,
    right: spacing.base,
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  buttonInner: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#B91C1C',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
