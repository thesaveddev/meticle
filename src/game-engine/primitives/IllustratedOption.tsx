import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Easing,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface IllustratedOptionProps {
  emoji: string;
  label: string;
  isSelected: boolean;
  isCorrect: boolean | null;
  onPress: (label: string) => void;
  size?: 'normal' | 'large';
  disabled?: boolean;
  variant?: 'default' | 'outlined';
}

export default function IllustratedOption({
  emoji,
  label,
  isSelected,
  isCorrect,
  onPress,
  size = 'normal',
  disabled = false,
  variant = 'default',
}: IllustratedOptionProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const feedbackScale = useRef(new Animated.Value(1)).current;
  const emojiBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1.04 : 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [isSelected, scale]);

  useEffect(() => {
    if (isCorrect === true) {
      Animated.sequence([
        Animated.spring(feedbackScale, {
          toValue: 1.12,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(feedbackScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.sequence([
        Animated.spring(emojiBounce, {
          toValue: -8,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.spring(emojiBounce, {
          toValue: 0,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isCorrect === false && isSelected) {
      Animated.sequence([
        Animated.timing(feedbackScale, {
          toValue: 0.94,
          duration: 150,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackScale, {
          toValue: 1,
          duration: 200,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isCorrect, isSelected, feedbackScale, emojiBounce]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress(label);
    AccessibilityInfo.announceForAccessibility(
      `Selected option: ${label}`
    );
  }, [disabled, label, onPress]);

  const getBorderColor = () => {
    if (isCorrect === true && isSelected) return Colors.success;
    if (isCorrect === false && isSelected) return Colors.gentleRed;
    if (isSelected) return Colors.primary;
    return variant === 'outlined' ? Colors.border : 'transparent';
  };

  const getBackgroundColor = () => {
    if (isCorrect === true && isSelected) return Colors.success + '18';
    if (isCorrect === false && isSelected) return Colors.gentleRed + '15';
    if (isSelected && variant === 'default') return Colors.primary + '12';
    if (variant === 'default') return Colors.surface;
    return 'transparent';
  };

  const isLarge = size === 'large';
  const containerSize = isLarge ? styles.largeContainer : styles.normalContainer;
  const emojiSize = isLarge ? styles.largeEmoji : styles.normalEmoji;
  const labelSize = isLarge ? styles.largeLabel : styles.normalLabel;

  const animatedStyle = useMemo(
    () => ({
      transform: [
        { scale: Animated.multiply(scale, feedbackScale) },
      ],
    }),
    [scale, feedbackScale]
  );

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.touchable,
          containerSize,
          {
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
          },
          isSelected && styles.selectedShadow,
          disabled && styles.disabledTouchable,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Option showing ${emoji}`}
        accessibilityHint={
          disabled ? '' : `Double tap to select ${label}`
        }
        accessibilityState={{
          selected: isSelected,
          disabled,
        }}
      >
        <Animated.Text
          style={[
            emojiSize,
            { transform: [{ translateY: emojiBounce }] },
          ]}
        >
          {emoji}
        </Animated.Text>
        <Text
          style={[
            labelSize,
            styles.labelText,
            isSelected && styles.selectedLabel,
            disabled && styles.disabledLabel,
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>

        {isCorrect === true && isSelected && (
          <View style={styles.correctIndicator}>
            <Text style={styles.correctCheck}>&#10003;</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    margin: 6,
  },
  touchable: {
    borderRadius: 20,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  normalContainer: {
    minWidth: 110,
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  largeContainer: {
    minWidth: 140,
    minHeight: 150,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  normalEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  largeEmoji: {
    fontSize: 52,
    marginBottom: 10,
  },
  normalLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  largeLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelText: {
    color: Colors.text,
  },
  selectedLabel: {
    color: Colors.primaryDark,
  },
  disabledLabel: {
    color: Colors.disabled,
  },
  selectedShadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledTouchable: {
    opacity: 0.5,
  },
  correctIndicator: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  correctCheck: {
    fontSize: 16,
    color: Colors.textOnDark,
    fontWeight: 'bold',
  },
});
