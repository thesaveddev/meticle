import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface ParentGateProps {
  onVerified: () => void;
}

const HOLD_DURATION_MS = 3000;

const ParentGate: React.FC<ParentGateProps> = ({ onVerified }) => {
  const [holding, setHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);

  const animatePulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [scale]);

  const handlePressIn = useCallback(() => {
    setHolding(true);
    startTime.current = Date.now();
    scale.setValue(1);

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    }).start(() => {
      setHolding(false);
      progress.setValue(0);
      onVerified();
    });

    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const pct = Math.min(elapsed / HOLD_DURATION_MS, 1);
      progress.setValue(pct);
    }, 16);
  }, [progress, onVerified]);

  const handlePressOut = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
    progress.setValue(0);
    scale.setValue(1);
    animatePulse();
  }, [progress, animatePulse]);

  const animatedProgressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.lockIcon}>{'\uD83D\uDD12'}</Text>
        <Text style={styles.title}>Parent Access</Text>
        <Text style={styles.instruction}>
          Hold the button below for 3 seconds to continue
        </Text>

        <View style={styles.buttonOuter}>
          <Animated.View
            style={[
              styles.progressRing,
              { transform: [{ scale }] },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                { width: animatedProgressWidth },
              ]}
            />
          </Animated.View>

          <Pressable
            style={[styles.holdButton, holding && styles.holdButtonActive]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Hold for 3 seconds to access parent features"
            accessibilityHint="Press and hold this button for 3 seconds"
          >
            <Text style={styles.holdButtonText}>
              {holding ? 'Keep holding...' : 'Hold'}
            </Text>
            <Text style={styles.holdDuration}>3s</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.parent.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  lockIcon: {
    fontSize: 40,
    marginBottom: Spacing.lg,
    includeFontPadding: false,
  },
  title: {
    ...Typography.parentTitle,
    marginBottom: Spacing.sm,
  },
  instruction: {
    ...Typography.parentBody,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: 22,
  },
  buttonOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    width: 100,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.parent.border,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.parent.primary,
    borderRadius: 4,
  },
  holdButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.parent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.parent.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
    minWidth: 48,
    minHeight: 48,
  },
  holdButtonActive: {
    backgroundColor: Colors.parent.primary,
    shadowOpacity: 0.5,
  },
  holdButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.white,
    textAlign: 'center',
  },
  holdDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default ParentGate;
