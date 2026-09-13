import { useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, ActionSheetIOS, Platform, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Linking } from 'react-native'
import { elevation, radii, spacing, FONT } from '../theme'
import { hapticWarning } from '../services/haptics'

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
        // Detect if it's a drag (moved more than 5px) vs a tap
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDragging.current = true
        }
        pan.setValue({ x: gestureState.dx, y: gestureState.dy })
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset()
        lastOffset.current = {
          x: lastOffset.current.x + gestureState.dx,
          y: lastOffset.current.y + gestureState.dy,
        }

        // If it was a drag (not a tap), snap to nearest edge
        if (isDragging.current) {
          const screenWidth = 400 // approximate, will be clamped
          const newX = lastOffset.current.x
          const clampedX = newX > screenWidth / 2 ? screenWidth / 2 : -screenWidth / 2
          lastOffset.current = { ...lastOffset.current, x: clampedX }
          Animated.spring(pan, { toValue: { x: clampedX, y: lastOffset.current.y }, useNativeDriver: false }).start()
        }
      },
    })
  ).current

  const handlePress = () => {
    // Only trigger if it wasn't a drag
    if (isDragging.current) return
    hapticWarning()
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Call 999 (Emergency)', managerPhone ? 'Call Manager' : null, 'Call 111 (NHS)'].filter(Boolean) as string[],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) dialNumber('999')
          else if (buttonIndex === 2 && managerPhone) dialNumber(managerPhone)
          else if (buttonIndex === 3) dialNumber('111')
        }
      )
    } else {
      const options = ['Cancel', 'Call 999 (Emergency)', 'Call 111 (NHS)']
      if (managerPhone) options.splice(2, 0, 'Call Manager')
      Alert.alert('Emergency Call', 'Who do you need to call?', [
        { text: 'Cancel', style: 'cancel' },
        { text: '999 — Emergency', style: 'destructive', onPress: () => dialNumber('999') },
        ...(managerPhone ? [{ text: 'Manager', onPress: () => dialNumber(managerPhone) }] : []),
        { text: '111 — NHS', onPress: () => dialNumber('111') },
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
      style={[styles.button, pressed && styles.buttonPressed, { transform: pan.getTranslateTransform() }]}
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
    zIndex: 999,
  },
  buttonInner: {
    width: 56,
    height: 56,
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
