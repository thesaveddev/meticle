import React, { useRef, useEffect, useCallback } from 'react';
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

interface SequenceItemProps {
  index: number;
  item: any;
  isCorrect: boolean | null;
  isActive: boolean;
  onPress: (index: number) => void;
  renderItem: (item: any, index: number) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export default function SequenceItem({
  index,
  item,
  isCorrect,
  isActive,
  onPress,
  renderItem,
  style,
  disabled = false,
}: SequenceItemProps) {
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const previousCorrect = useRef<boolean | null>(null);

  useEffect(() => {
    if (isCorrect === true && previousCorrect.current !== true) {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else if (isCorrect !== true) {
      checkScale.setValue(0);
    }
    previousCorrect.current = isCorrect;
  }, [isCorrect, checkScale]);

  useEffect(() => {
    if (isCorrect === false) {
      const shakeSequence = Animated.sequence([
        Animated.timing(shakeAnimation, {
          toValue: -8,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 8,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: -6,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 6,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnimation, {
          toValue: 0,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);

      shakeSequence.start();
    }
  }, [isCorrect, shakeAnimation]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress(index);
    AccessibilityInfo.announceForAccessibility(`Sequence item ${index + 1} selected`);
  }, [disabled, index, onPress]);

  const getBorderColor = () => {
    if (isCorrect === true) return Colors.success;
    if (isCorrect === false) return Colors.errorLight;
    if (isActive) return Colors.info;
    return Colors.border;
  };

  const getBackgroundColor = () => {
    if (isCorrect === true) return Colors.successLight + '20';
    if (isCorrect === false) return Colors.errorLight + '15';
    if (isActive) return Colors.infoLight + '25';
    return Colors.surface;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          transform: [{ translateX: shakeAnimation }],
        },
        isCorrect === true && styles.correctContainer,
        isActive && styles.activeContainer,
        disabled && styles.disabledContainer,
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Sequence item ${index + 1}${isCorrect === true ? ', correct' : ''}${isCorrect === false ? ', incorrect' : ''}${isActive ? ', currently active' : ''}`}
      accessibilityHint={
        disabled ? '' : 'Double tap to select this item for the sequence'
      }
      accessibilityState={{
        selected: isActive,
        disabled,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePress}
        disabled={disabled}
        style={styles.touchable}
        accessibilityLabel={undefined}
      >
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>

        <View style={styles.contentArea}>{renderItem(item, index)}</View>

        {isCorrect === true && (
          <Animated.View
            style={[
              styles.checkOverlay,
              { transform: [{ scale: checkScale }] },
            ]}
            pointerEvents="none"
          >
            <View style={styles.checkCircle}>
              <Text style={styles.checkIcon}>&#10003;</Text>
            </View>
          </Animated.View>
        )}

        {isActive && (
          <View style={styles.activeIndicator} pointerEvents="none" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 90,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 2.5,
    marginVertical: 4,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  correctContainer: {
    borderWidth: 3,
  },
  activeContainer: {
    shadowColor: Colors.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledContainer: {
    opacity: 0.55,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.grey200,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  indexText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
  },
  checkOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 16,
    color: Colors.textOnDark,
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderBottomLeftRadius: 10,
    backgroundColor: Colors.info,
  },
});
