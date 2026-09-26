import React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * The MeticleCare splash background: three slow, independently drifting layers
 * beneath a clean white centre.
 *
 * The logo is not drawn here. It sits above this, motionless, in
 * `MeticleSplashScreen` — the brand mark is the one thing that must not drift.
 *
 * Layer colours are the ones supplied with the MeticleCare artwork. The
 * reference background in `Store assets/Splash screen Background.png` measures
 * #5DE2D1 in the mint band and #66BEFA in the cyan band; the values below are
 * the specified MeticleCare palette, slightly more saturated so the layers
 * still read once they are only a few dozen points tall.
 *
 * Note on the structure: each layer is a rotated `View` wrapping an
 * `Animated.View` that does the translating. Putting the rotation in the same
 * `transform` array as the animation would drop the rotation for the entire
 * time the layer moves, because the animated style replaces the static one
 * rather than merging with it.
 */

/** Ping-pong duration per layer, in ms. Deliberately slow and prime-ish to each
 *  other so the layers never visibly realign. */
const BLUE_MS = 9000;
const CYAN_MS = 7500;
const TEAL_MS = 8500;

/** Translation travel per layer, in points. Small enough to read as drift. */
const BLUE_X = -25;
const BLUE_Y = 8;
const CYAN_X = 30;
const CYAN_Y = -10;
const TEAL_X = -20;
const TEAL_Y = -12;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduced(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

export default function MeticleSplashBackground() {
  const reducedMotion = useReducedMotion();

  const blueWave = useSharedValue(0);
  const cyanWave = useSharedValue(0);
  const tealWave = useSharedValue(0);

  React.useEffect(() => {
    if (reducedMotion) {
      // Park the layers at the midpoint of their travel so the composition still
      // looks like the artwork, without any motion.
      blueWave.value = 0.5;
      cyanWave.value = 0.5;
      tealWave.value = 0.5;
      return;
    }

    const drift = (duration: number) =>
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true);

    blueWave.value = drift(BLUE_MS);
    cyanWave.value = drift(CYAN_MS);
    tealWave.value = drift(TEAL_MS);
  }, [reducedMotion, blueWave, cyanWave, tealWave]);

  const blueStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: blueWave.value * BLUE_X }, { translateY: blueWave.value * BLUE_Y }],
  }));

  const cyanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cyanWave.value * CYAN_X }, { translateY: cyanWave.value * CYAN_Y }],
  }));

  const tealStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tealWave.value * TEAL_X }, { translateY: tealWave.value * TEAL_Y }],
  }));

  return (
    <View style={styles.container} pointerEvents="none" testID="splash-background">
      {/* Bottom blue layer */}
      <View style={styles.blueWave}>
        <Animated.View testID="splash-layer-blue" style={[styles.blueWaveFill, blueStyle]} />
      </View>

      {/* Middle cyan layer */}
      <View style={styles.cyanWave}>
        <Animated.View testID="splash-layer-cyan" style={[styles.cyanWaveFill, cyanStyle]} />
      </View>

      {/* Top teal layer */}
      <View style={styles.tealWave}>
        <Animated.View testID="splash-layer-teal" style={[styles.tealWaveFill, tealStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Written out rather than spreading StyleSheet.absoluteFillObject, which
    // this project's React Native typings do not declare.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },

  blueWave: {
    position: 'absolute',
    width: '130%',
    height: 220,
    bottom: -80,
    left: '-15%',
    transform: [{ rotate: '-5deg' }],
  },
  blueWaveFill: {
    flex: 1,
    backgroundColor: '#3B9FE8',
    borderTopLeftRadius: 180,
    borderTopRightRadius: 260,
  },

  cyanWave: {
    position: 'absolute',
    width: '140%',
    height: 180,
    bottom: -50,
    left: '-20%',
    transform: [{ rotate: '-8deg' }],
  },
  cyanWaveFill: {
    flex: 1,
    backgroundColor: '#39C5D9',
    borderTopLeftRadius: 220,
    borderTopRightRadius: 180,
  },

  tealWave: {
    position: 'absolute',
    width: '125%',
    height: 160,
    bottom: -40,
    right: '-15%',
    transform: [{ rotate: '-12deg' }],
  },
  tealWaveFill: {
    flex: 1,
    backgroundColor: '#4FD9B1',
    borderTopLeftRadius: 220,
    borderTopRightRadius: 100,
  },
});
