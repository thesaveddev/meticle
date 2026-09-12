import React, { useRef } from 'react'
import { Animated, PanResponder, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  onBack: () => void
  children: React.ReactNode
  enabled?: boolean
  threshold?: number
}

/**
 * Wraps a screen and enables edge-swipe-to-go-back.
 * Swipe from the left edge (within 25px of the bezel) to trigger onBack.
 */
export function SwipeBack({ onBack, children, enabled = true, threshold = 100 }: Props) {
  const insets = useSafeAreaInsets()
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const responding = useRef(false)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled) return false
        // Only start if swiping right from the left edge (within 25px of bezel)
        if (gestureState.numberActiveTouches > 1) return false
        return gestureState.dx > 10 && gestureState.dy < Math.abs(gestureState.dx) * 0.5
      },
      onPanResponderGrant: () => {
        responding.current = true
      },
      onPanResponderMove: (_, gestureState) => {
        if (!responding.current) return
        const dx = Math.max(0, gestureState.dx) // only allow rightward
        translateX.setValue(dx)
        opacity.setValue(1 - dx / 400)
      },
      onPanResponderRelease: (_, gestureState) => {
        responding.current = false
        if (gestureState.dx > threshold) {
          // Swipe completed — slide out and go back
          Animated.parallel([
            Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => {
            translateX.setValue(0)
            opacity.setValue(1)
            onBack()
          })
        } else {
          // Swipe cancelled — spring back
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100 }),
            Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 100 }),
          ]).start()
        }
      },
      onPanResponderTerminate: () => {
        responding.current = false
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100 }),
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 100 }),
        ]).start()
      },
    })
  ).current

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }], opacity }]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
