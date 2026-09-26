import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import MeticleSplashBackground from './MeticleSplashBackground';

const LOGO = require('../../assets/splash-icon.png');

/**
 * The in-app continuation of the native launch screen.
 *
 * The native splash is a static centred logo on white, because that is all
 * iOS and Android will hold reliably. This screen takes over the moment React
 * Native mounts, keeps that logo centred and motionless, and animates only the
 * wave layers beneath it so the branding carries through into the app instead
 * of stopping dead.
 *
 * It carries no state of its own and no minimum on-screen time. It is shown
 * while the app's own bootstrap is pending, so it is only ever visible during a
 * real cold start, and it never appears again during navigation. When bootstrap
 * finishes the parent swaps straight to the next screen — holding this one for
 * a second just to watch the waves would mean delaying the app to show off an
 * animation.
 */
export default function MeticleSplashScreen() {
  // A short fade-in bridges the hand-off from the native splash. The native
  // screen is already white with the same logo in the same place, so this reads
  // as the artwork settling rather than a new screen appearing.
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) });
  }, [opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="MeticleCare">
      <MeticleSplashBackground />
      <Animated.View style={[styles.logoWrap, fade]}>
        <Image testID="splash-logo" source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  logoWrap: {
    // Written out rather than spreading StyleSheet.absoluteFillObject, which
    // this project's React Native typings do not declare.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
});
