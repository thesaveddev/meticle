import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Easing,
  AccessibilityInfo,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface AudioPromptProps {
  onPlay: () => void;
  isPlaying: boolean;
  label?: string;
  size?: 'normal' | 'large';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function AudioPrompt({
  onPlay,
  isPlaying,
  label,
  size = 'normal',
  disabled = false,
  style,
}: AudioPromptProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveBar1 = useRef(new Animated.Value(0.3)).current;
  const waveBar2 = useRef(new Animated.Value(0.5)).current;
  const waveBar3 = useRef(new Animated.Value(0.4)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      const bars = Animated.loop(
        Animated.parallel([
          animBar(waveBar1, [0.3, 1, 0.3], [400, 400]),
          animBar(waveBar2, [0.5, 0.7, 0.5], [350, 350]),
          animBar(waveBar3, [0.4, 0.9, 0.4], [450, 450]),
        ])
      );
      bars.start();

      return () => {
        pulse.stop();
        bars.stop();
      };
    } else {
      pulseAnim.setValue(1);
      waveBar1.setValue(0.3);
      waveBar2.setValue(0.5);
      waveBar3.setValue(0.4);
    }
  }, [isPlaying, pulseAnim, waveBar1, waveBar2, waveBar3]);

  const handlePress = useCallback(() => {
    if (disabled || isPlaying) return;

    Animated.sequence([
      Animated.spring(pressScale, {
        toValue: 0.9,
        friction: 4,
        tension: 150,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const Haptics = require('expo-haptics');
      if (Haptics && Haptics.impactAsync) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // expo-haptics not available
    }

    onPlay();
    AccessibilityInfo.announceForAccessibility(
      label ? `Playing audio: ${label}` : 'Playing audio prompt'
    );
  }, [disabled, isPlaying, onPlay, label, pressScale]);

  const isLarge = size === 'large';
  const buttonSize = isLarge ? styles.largeButton : styles.normalButton;
  const iconSize = isLarge ? styles.largeIcon : styles.normalIcon;
  const labelSize = isLarge ? styles.largeLabelText : styles.normalLabelText;

  const waveBars = useMemo(
    () => (
      <View style={styles.waveContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.waveBar,
            styles.waveBar1,
            { transform: [{ scaleY: waveBar1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            styles.waveBar2,
            { transform: [{ scaleY: waveBar2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            styles.waveBar3,
            { transform: [{ scaleY: waveBar3 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            styles.waveBar2,
            { transform: [{ scaleY: waveBar2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.waveBar,
            styles.waveBar1,
            { transform: [{ scaleY: waveBar1 }] },
          ]}
        />
      </View>
    ),
    [waveBar1, waveBar2, waveBar3]
  );

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={disabled}
        style={styles.touchableZone}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={
          label
            ? `${isPlaying ? 'Playing' : 'Play'} audio: ${label}`
            : isPlaying
            ? 'Audio playing'
            : 'Play audio'
        }
        accessibilityHint={
          disabled
            ? 'Audio is not available'
            : isPlaying
            ? 'Audio is currently playing'
            : 'Double tap to play audio'
        }
        accessibilityState={{
          disabled,
          selected: isPlaying,
        }}
      >
        <Animated.View
          style={[
            styles.buttonCore,
            buttonSize,
            {
              transform: [
                { scale: Animated.multiply(pulseAnim, pressScale) },
              ],
            },
            disabled && styles.disabledButton,
          ]}
        >
          {isPlaying ? waveBars : null}
          <Text style={[styles.speakerIcon, iconSize]}>
            {isPlaying ? '\u266A' : '\u25B6'}
          </Text>
          {isPlaying && !isLarge && (
            <View style={styles.playingDot} />
          )}
        </Animated.View>

        {label && (
          <Text style={[styles.labelText, labelSize, disabled && styles.disabledLabel]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function animBar(
  value: Animated.Value,
  outputRange: number[],
  durations: number[]
): Animated.CompositeAnimation {
  return Animated.sequence([
    Animated.timing(value, {
      toValue: outputRange[1],
      duration: durations[0],
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: outputRange[2],
      duration: durations[1],
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  ]);
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  touchableZone: {
    minWidth: 60,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  buttonCore: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.audioButton,
    shadowColor: Colors.audioButton,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  normalButton: {
    width: 64,
    height: 64,
  },
  largeButton: {
    width: 80,
    height: 80,
  },
  disabledButton: {
    backgroundColor: Colors.audioButtonDisabled,
    shadowOpacity: 0,
    elevation: 2,
  },
  speakerIcon: {
    color: Colors.textOnDark,
  },
  normalIcon: {
    fontSize: 26,
  },
  largeIcon: {
    fontSize: 34,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
    height: 20,
  },
  waveBar: {
    width: 3,
    backgroundColor: Colors.textOnDark,
    borderRadius: 1.5,
    height: 16,
  },
  waveBar1: {
    height: 10,
  },
  waveBar2: {
    height: 14,
  },
  waveBar3: {
    height: 12,
  },
  playingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },
  labelText: {
    color: Colors.text,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  normalLabelText: {
    fontSize: 14,
  },
  largeLabelText: {
    fontSize: 16,
  },
  disabledLabel: {
    color: Colors.disabled,
  },
});
