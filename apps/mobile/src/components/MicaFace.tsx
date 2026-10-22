import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { mica, type MicaOrbState } from '../theme'
import { useReducedMotion } from '../utils/useReducedMotion'
import { MicaOrbCore } from './MicaOrbCore'

const FACE_SIZE = 208

/**
 * Mica's face, speaking the web orb's language.
 *
 * What was here was a cartoon drawn on flat Mica blue: white oval eyes with
 * dark pupils and a mouth that smiled, opened, talked and flattened. The web
 * orb carries state in neither pupils nor a mouth — it carries it in the
 * gradient core, the orbit rings, the travelling waveform and the danger
 * ring — so the face does the same now:
 *
 *   - idle: gradient core, bar eyes, one small orbit, still glow from the screen.
 *   - listening / thinking / responding: tall eyes, the large orbit with its
 *     counter-rotating inner ring, and the eleven-bar travelling wave below.
 *   - error: still everywhere, with the danger ring as the one signal.
 *
 * The glow and the breath live in `MicaHomeScreen`, as before; the face owns
 * everything the web orb draws around its core. Reduced motion parks the
 * rings, the wave and the blink on their resting values.
 */

function useSpin(durationMs: number, reverse: boolean, parked: boolean) {
  const spin = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(spin)
    if (parked) {
      spin.value = 0
      return
    }
    const sweep = (to: number) =>
      withRepeat(
        withSequence(withTiming(to, { duration: durationMs }), withTiming(0, { duration: 0 })),
        -1,
        false,
      )
    spin.value = reverse ? sweep(-360) : sweep(360)
    return () => {
      cancelAnimation(spin)
    }
  }, [spin, durationMs, reverse, parked])
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))
}

function OrbitRings({ size, state, parked }: { size: number; state: MicaOrbState; parked: boolean }) {
  const active = state !== 'idle'
  // Web rhythms, quickened for the phone the way the breath already is: the
  // outer ring circles in ~12s at rest and ~5s while working, the inner ring
  // counter-rotates a little slower.
  const outerSpin = useSpin(active ? 5000 : 12000, false, parked)
  const innerSpin = useSpin(active ? 6500 : 12000, true, parked)

  const outerW = size * (active ? 1.4 : 1.26)
  const outerH = outerW * 0.62
  const innerW = size * 1.24
  const innerH = innerW * 0.52

  return (
    <View testID="mica-face-orbit" pointerEvents="none" style={styles.orbitWrap}>
      <Reanimated.View
        style={[
          {
            position: 'absolute',
            width: outerW,
            height: outerH,
            borderRadius: outerW / 2,
            borderWidth: active ? 1.5 : 1,
            borderColor: mica.sky,
            opacity: active ? 0.6 : 0.35,
          },
          outerSpin,
        ]}
      >
        {active && (
          <>
            <View style={[styles.dot, { left: -3, top: outerH / 2 - 3, backgroundColor: mica.cyan }]} />
            <View style={[styles.dot, { right: -3, top: outerH / 2 - 3, backgroundColor: mica.green }]} />
          </>
        )}
      </Reanimated.View>
      {active && (
        <Reanimated.View
          style={[
            {
              position: 'absolute',
              width: innerW,
              height: innerH,
              borderRadius: innerW / 2,
              borderWidth: 1,
              borderColor: mica.green,
              opacity: 0.35,
            },
            innerSpin,
          ]}
        >
          <View style={[styles.dot, { left: -2.5, top: innerH / 2 - 2.5, backgroundColor: mica.green }]} />
        </Reanimated.View>
      )}
    </View>
  )
}

// The web waveform's eleven heights, at face scale.
const WAVE_HEIGHTS = [8, 14, 22, 32, 44, 29, 54, 36, 25, 15, 8]

function WaveBar({ height, delay, parked }: { height: number; delay: number; parked: boolean }) {
  const level = useSharedValue(0.6)
  useEffect(() => {
    cancelAnimation(level)
    if (parked) {
      level.value = 0.6
      return
    }
    // One shared rhythm, staggered per bar, so the crest travels along the
    // row instead of every bar rising together.
    level.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 380 }), withTiming(0.35, { duration: 380 })),
        -1,
        false,
      ),
    )
    return () => {
      cancelAnimation(level)
    }
  }, [level, delay, parked])
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.35 + level.value * 0.65 }] }))
  return (
    <Reanimated.View
      style={[{ width: 4, height, borderRadius: 2, backgroundColor: mica.cyan }, barStyle]}
    />
  )
}

export function MicaFace({ state }: { state: MicaOrbState }) {
  const reducedMotion = useReducedMotion()
  // The waveform meters the working states. An error has nothing to meter —
  // the web orb keeps it still for the same reason.
  const wave = state === 'listening' || state === 'thinking' || state === 'responding'

  return (
    <View testID="mica-face" accessibilityRole="image" accessibilityLabel="Mica" style={styles.face}>
      <OrbitRings size={FACE_SIZE} state={state} parked={reducedMotion} />
      <MicaOrbCore size={FACE_SIZE} state={state} />
      {state === 'error' && <View testID="mica-face-error-ring" pointerEvents="none" style={styles.errorRing} />}
      {wave && (
        <View testID="mica-face-waveform" style={styles.waveform}>
          {WAVE_HEIGHTS.map((height, index) => (
            // A fixed ordered sequence with no identity of its own — the index
            // *is* the phase, as on the web.
            <WaveBar key={index} height={height * 0.75} delay={index * 70} parked={reducedMotion} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  face: {
    width: FACE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitWrap: {
    // Fixed to the core's box, not the whole column: the waveform below must
    // not drag the rings off-centre.
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: FACE_SIZE,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // The danger ring: the error's one signal, drawn over a still orb.
  errorRing: {
    position: 'absolute',
    top: -9,
    left: -9,
    width: FACE_SIZE + 18,
    height: FACE_SIZE + 18,
    borderRadius: (FACE_SIZE + 18) / 2,
    borderWidth: 3,
    borderColor: mica.errorRing,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    height: 44,
  },
})
