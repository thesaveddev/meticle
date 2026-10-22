import { useEffect } from 'react'
import { View } from 'react-native'
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { mica, type MicaOrbState } from '../theme'
import { useReducedMotion } from '../utils/useReducedMotion'
import {
  pickBlink,
  pickBlinkDelay,
  pickGlance,
  pickGlanceDelay,
} from '../services/micaAttitude'

/**
 * The orb's core, speaking the web orb's language (`MicaOrb.tsx`).
 *
 * The core is the web core exactly: a 135° linear gradient — deep blue, Mica
 * blue, cyan, mint — under the white 13% glass highlight, with two white bar
 * eyes and, while working, the inner energy wave along the bottom. The
 * gradient is a real `LinearGradient` (top-left to bottom-right, the web's
 * four stops at 0/38/72/100), not an approximation, so the phone and the web
 * paint the same pixels.
 *
 * On top of the still art, two small lives:
 *
 *   - **Blinks.** Three kinds — a quick single shut, an occasional double,
 *     a rare slow sleepy lid — at random 2.2–5.6s intervals, so the rhythm
 *     cannot be learned. The error state keeps the working size; the ring,
 *     not the eyes, carries the failure.
 *   - **Glances.** Every 6–14s the gaze drifts a few percent left or right
 *     and comes back. A glance, not a stare.
 *
 * Both are parked on their resting values under reduced motion: still means
 * still for a user who asked for it.
 */

export function MicaOrbCore({ size, state }: { size: number; state: MicaOrbState }) {
  const reducedMotion = useReducedMotion()
  const active = state !== 'idle'

  // Web eye proportions: idle bars are small (5×17 at 62), working bars are
  // tall (11×38 at 170).
  const eyeW = active ? size * 0.065 : size * 0.08
  const eyeH = active ? size * 0.22 : size * 0.27
  const eyeGap = active ? size * 0.165 : size * 0.19

  const blink = useSharedValue(1)
  const glance = useSharedValue(0)

  useEffect(() => {
    if (reducedMotion) {
      blink.value = 1
      glance.value = 0
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    let alive = true

    // A shut is a close, a hold, and an open; the holds are wall-clock so the
    // lid rests shut for the spec's own duration rather than racing the UI
    // thread's animation frames.
    const runBlink = () => {
      if (!alive) return
      const spec = pickBlink()
      if (spec.kind === 'double') {
        blink.value = withTiming(spec.scale, { duration: spec.closeMs })
        timers.push(
          setTimeout(() => {
            if (!alive) return
            blink.value = withTiming(1, { duration: spec.openMs })
            timers.push(
              setTimeout(() => {
                if (!alive) return
                blink.value = withTiming(spec.scale, { duration: spec.closeMs })
                timers.push(
                  setTimeout(() => {
                    if (!alive) return
                    blink.value = withTiming(1, { duration: spec.openMs })
                    timers.push(setTimeout(runBlink, pickBlinkDelay()))
                  }, spec.shutMs),
                )
              }, spec.gapMs),
            )
          }, spec.shutMs + spec.closeMs),
        )
      } else {
        blink.value = withTiming(spec.scale, { duration: spec.closeMs })
        timers.push(
          setTimeout(() => {
            if (!alive) return
            blink.value = withTiming(1, { duration: spec.openMs })
            timers.push(setTimeout(runBlink, pickBlinkDelay()))
          }, spec.shutMs + spec.closeMs),
        )
      }
    }

    const runGlance = () => {
      if (!alive) return
      const spec = pickGlance()
      glance.value = withTiming(size * spec.dxFraction, { duration: spec.outMs })
      timers.push(
        setTimeout(() => {
          if (!alive) return
          glance.value = withTiming(0, { duration: spec.backMs })
          timers.push(setTimeout(runGlance, pickGlanceDelay()))
        }, spec.outMs + spec.holdMs),
      )
    }

    const blinkKickoff = setTimeout(runBlink, pickBlinkDelay())
    const glanceKickoff = setTimeout(runGlance, pickGlanceDelay())
    timers.push(blinkKickoff, glanceKickoff)
    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
  }, [blink, glance, reducedMotion, size])

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glance.value }, { scaleY: blink.value }],
  }))

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: mica.surfaceStrong,
      }}
    >
      {/* THE GRADIENT — the web core's own 135° slope, four stops. */}
      <LinearGradient
        testID="mica-core-gradient"
        colors={[mica.surfaceStrong, mica.blue, mica.cyan, mica.green]}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}
      />
      {/* GLASS HIGHLIGHT — the web orb's white 13% disc, top-left. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: size * 0.07,
          left: size * 0.1,
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: (size * 0.62) / 2,
          backgroundColor: 'rgba(255,255,255,0.13)',
        }}
      />
      {/* MICA EYES */}
      <View
        testID="mica-core-eyes"
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: eyeGap,
        }}
      >
        <Reanimated.View
          testID="mica-core-eye-left"
          style={[{ width: eyeW, height: eyeH, borderRadius: eyeW / 2, backgroundColor: '#FFFFFF' }, eyeStyle]}
        />
        <Reanimated.View
          testID="mica-core-eye-right"
          style={[{ width: eyeW, height: eyeH, borderRadius: eyeW / 2, backgroundColor: '#FFFFFF' }, eyeStyle]}
        />
      </View>
      {/* INNER ENERGY WAVE — the web orb's white squiggle along the bottom,
          drawn while working. The error state keeps it: the ring, not the
          wave, carries the failure. */}
      {active && (
        <View
          testID="mica-core-wave"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: size * 0.1,
            right: size * 0.1,
            bottom: size * 0.118,
            height: size * 0.41,
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 135 70" preserveAspectRatio="none">
            <Path
              d="M5 45 C25 15 42 65 63 37 C84 8 105 57 130 20"
              fill="none"
              stroke="rgba(255,255,255,0.30)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </View>
      )}
    </View>
  )
}
