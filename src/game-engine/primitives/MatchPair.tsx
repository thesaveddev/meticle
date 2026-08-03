import React, { useRef, useCallback, useEffect, useMemo } from 'react';
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

interface MatchPairProps {
  id: string;
  content: React.ReactNode;
  isFlipped: boolean;
  isMatched: boolean;
  isSelected: boolean;
  onPress: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export default function MatchPair({
  id,
  content,
  isFlipped,
  isMatched,
  isSelected,
  onPress,
  style,
  disabled = false,
}: MatchPairProps) {
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;

  const isFront = !isFlipped;

  useEffect(() => {
    Animated.timing(flipAnimation, {
      toValue: isFlipped ? 1 : 0,
      duration: 350,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [isFlipped, flipAnimation]);

  useEffect(() => {
    if (isMatched) {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(checkScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isMatched, checkScale]);

  useEffect(() => {
    if (!isFlipped && !isMatched) {
      const loop = Animated.loop(
        Animated.timing(sparkleRotation, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      sparkleRotation.setValue(0);
    }
  }, [isFlipped, isMatched, sparkleRotation]);

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['90deg', '90deg', '0deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.45, 0.55, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.45, 0.55, 1],
    outputRange: [0, 0, 1, 1],
  });

  const cardScale = useMemo(() => {
    if (isSelected && !isMatched) return 1.04;
    if (isMatched) return 1;
    return 1;
  }, [isSelected, isMatched]);

  const handlePress = useCallback(() => {
    if (disabled || isMatched) return;
    onPress(id);
    AccessibilityInfo.announceForAccessibility(
      isFlipped ? `Card ${id} selected` : `Flipping card ${id}`
    );
  }, [disabled, isMatched, isFlipped, id, onPress]);

  const sparkleRotate = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale: cardScale }] },
        isSelected && styles.selectedWrapper,
        isMatched && styles.matchedWrapper,
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Matching card ${id}${isFlipped ? ', flipped' : ', face down'}${isMatched ? ', matched' : ''}`}
      accessibilityHint={
        disabled || isMatched
          ? ''
          : isFlipped
          ? 'Double tap to select this card'
          : 'Double tap to flip this card'
      }
      accessibilityState={{
        selected: isSelected,
        disabled: disabled || isMatched,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handlePress}
        disabled={disabled || isMatched}
        style={styles.touchable}
        accessibilityLabel={undefined}
      >
        <Animated.View
          style={[
            styles.cardFace,
            styles.front,
            {
              transform: [{ rotateY: frontInterpolate }] as any,
              opacity: frontOpacity,
            },
          ]}
        >
          <View style={styles.patternContainer}>
            <Animated.Text
              style={[styles.sparkleEmoji, { transform: [{ rotate: sparkleRotate }] }]}
            >
              &#10022;
            </Animated.Text>
            <Text style={styles.questionMark}>?</Text>
            <View style={styles.decorativeDots}>
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
              <View style={[styles.dot, { backgroundColor: Colors.accent, width: 8, height: 8 }]} />
              <View style={[styles.dot, { backgroundColor: Colors.primary, width: 10, height: 10 }]} />
              <View style={[styles.dot, { backgroundColor: Colors.accent, width: 8, height: 8 }]} />
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardFace,
            styles.back,
            {
              transform: [{ rotateY: backInterpolate }] as any,
              opacity: backOpacity,
            },
          ]}
        >
          <View style={styles.contentContainer}>{content}</View>
        </Animated.View>

        {isMatched && (
          <Animated.View
            style={[
              styles.checkOverlay,
              {
                transform: [{ scale: checkScale }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.checkCircle}>
              <Text style={styles.checkIcon}>&#10003;</Text>
            </View>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 100,
    height: 120,
    borderRadius: 16,
    overflow: 'visible',
  },
  touchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  selectedWrapper: {
    shadowColor: Colors.info,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  matchedWrapper: {
    opacity: 0.9,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backfaceVisibility: 'hidden',
    borderWidth: 3,
  },
  front: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  back: {
    backgroundColor: Colors.flipCardBack,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleEmoji: {
    fontSize: 24,
    color: Colors.accent,
    marginBottom: 6,
  },
  questionMark: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textOnDark,
  },
  decorativeDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  checkIcon: {
    fontSize: 22,
    color: Colors.textOnDark,
    fontWeight: 'bold',
  },
});
