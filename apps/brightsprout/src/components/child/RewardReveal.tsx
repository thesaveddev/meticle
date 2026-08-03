import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../theme';
import { Reward } from '../../types';

interface RewardRevealProps {
  visible: boolean;
  reward: Reward;
  onClose: () => void;
}

const RewardReveal: React.FC<RewardRevealProps> = ({
  visible,
  reward,
  onClose,
}) => {
  const scale = useRef(new Animated.Value(0.3)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const sparkle1Opacity = useRef(new Animated.Value(0)).current;
  const sparkle2Opacity = useRef(new Animated.Value(0)).current;
  const sparkle3Opacity = useRef(new Animated.Value(0)).current;
  const sparkle1Rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.loop(
            Animated.sequence([
              Animated.timing(sparkle1Opacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(sparkle1Opacity, {
                toValue: 0.2,
                duration: 500,
                useNativeDriver: true,
              }),
            ]),
          ),
          Animated.loop(
            Animated.sequence([
              Animated.timing(sparkle2Opacity, {
                toValue: 1,
                duration: 400,
                delay: 200,
                useNativeDriver: true,
              }),
              Animated.timing(sparkle2Opacity, {
                toValue: 0.2,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
          ),
          Animated.loop(
            Animated.sequence([
              Animated.timing(sparkle3Opacity, {
                toValue: 1,
                duration: 550,
                delay: 350,
                useNativeDriver: true,
              }),
              Animated.timing(sparkle3Opacity, {
                toValue: 0.2,
                duration: 550,
                useNativeDriver: true,
              }),
            ]),
          ),
          Animated.loop(
            Animated.timing(sparkle1Rotate, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }),
          ),
        ]),
      ]).start();
    } else {
      scale.setValue(0.3);
      cardOpacity.setValue(0);
      sparkle1Opacity.setValue(0);
      sparkle2Opacity.setValue(0);
      sparkle3Opacity.setValue(0);
      sparkle1Rotate.setValue(0);
    }
  }, [visible, scale, cardOpacity, sparkle1Opacity, sparkle2Opacity, sparkle3Opacity, sparkle1Rotate]);

  const rotateInterpolation = sparkle1Rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale }],
              opacity: cardOpacity,
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.sparkle,
              styles.sparkleTopLeft,
              { opacity: sparkle1Opacity, transform: [{ rotate: rotateInterpolation }] },
            ]}
          >
            {'\u2728'}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.sparkle,
              styles.sparkleTopRight,
              { opacity: sparkle2Opacity },
            ]}
          >
            {'\u2728'}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.sparkle,
              styles.sparkleBottom,
              { opacity: sparkle3Opacity },
            ]}
          >
            {'\u2728'}
          </Animated.Text>

          <Text style={styles.celebrationLabel}>You earned</Text>
          <Text style={styles.rewardEmoji}>{reward.emoji || '\uD83C\uDF1F'}</Text>
          <Text style={styles.rewardName}>{reward.name}</Text>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close reward reveal"
          >
            <Text style={styles.closeText}>Collect</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.child.card,
    borderRadius: BorderRadius.child,
    paddingHorizontal: Spacing.xxxl,
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    ...Shadows.child,
    borderWidth: 3,
    borderColor: Colors.child.secondary,
  },
  celebrationLabel: {
    ...Typography.childBody,
    color: Colors.child.textLight,
    marginBottom: Spacing.md,
  },
  rewardEmoji: {
    fontSize: 72,
    marginBottom: Spacing.md,
    includeFontPadding: false,
  },
  rewardName: {
    ...Typography.childTitle,
    color: Colors.child.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  closeButton: {
    minHeight: 52,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.child,
    backgroundColor: Colors.child.secondary,
  },
  closeText: {
    ...Typography.childButtonSmall,
    color: Colors.child.textInverse,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 24,
    includeFontPadding: false,
  },
  sparkleTopLeft: {
    top: Spacing.lg,
    left: Spacing.lg,
  },
  sparkleTopRight: {
    top: Spacing.md,
    right: Spacing.xl,
  },
  sparkleBottom: {
    bottom: Spacing.xxl,
    right: Spacing.xl,
  },
});

export default RewardReveal;
