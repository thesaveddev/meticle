import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../theme';

interface CelebrationOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  rewardName?: string;
  rewardIcon?: string;
  skillName?: string;
  onContinue?: () => void;
  onHome?: () => void;
  onOpenPlay?: () => void;
}

const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  visible,
  title,
  subtitle,
  rewardName,
  rewardIcon,
  skillName,
  onContinue,
  onHome,
  onOpenPlay,
}) => {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.6);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

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
      <TouchableWithoutFeedback>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ scale }],
                opacity,
              },
            ]}
          >
            <Text style={styles.celebrationTitle}>{title}</Text>

            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}

            {rewardIcon ? (
              <Text style={styles.rewardIcon}>{rewardIcon}</Text>
            ) : null}

            {rewardName ? (
              <Text style={styles.rewardName}>{rewardName}</Text>
            ) : null}

            {skillName ? (
              <View style={styles.skillRow}>
                <Text style={styles.skillLabel}>Skill:</Text>
                <Text style={styles.skillName}>{skillName}</Text>
              </View>
            ) : null}

            <View style={styles.buttonGroup}>
              {onContinue ? (
                <TouchableOpacity
                  style={[styles.button, styles.continueButton]}
                  onPress={onContinue}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                >
                  <Text style={styles.continueText}>Continue</Text>
                </TouchableOpacity>
              ) : null}

              {onHome ? (
                <TouchableOpacity
                  style={[styles.button, styles.homeButton]}
                  onPress={onHome}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Go home"
                >
                  <Text style={styles.homeText}>Home</Text>
                </TouchableOpacity>
              ) : null}

              {onOpenPlay ? (
                <TouchableOpacity
                  style={[styles.button, styles.playButton]}
                  onPress={onOpenPlay}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open play"
                >
                  <Text style={styles.playText}>Open Play</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
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
    backgroundColor: Colors.child.successBg,
    borderRadius: BorderRadius.child,
    padding: Spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    ...Shadows.child,
    borderWidth: 3,
    borderColor: Colors.child.success,
  },
  celebrationTitle: {
    ...Typography.childTitle,
    color: Colors.child.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.childBody,
    color: Colors.child.textLight,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  rewardIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
    includeFontPadding: false,
  },
  rewardName: {
    ...Typography.title3,
    color: Colors.child.primaryDark,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  skillLabel: {
    ...Typography.bodySmall,
    color: Colors.child.textLight,
    marginRight: Spacing.xs,
  },
  skillName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.child.text,
  },
  buttonGroup: {
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    minHeight: 52,
    borderRadius: BorderRadius.child,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  continueButton: {
    backgroundColor: Colors.child.primary,
  },
  continueText: {
    ...Typography.childButtonSmall,
    color: Colors.child.textInverse,
  },
  homeButton: {
    backgroundColor: Colors.child.secondaryLight,
  },
  homeText: {
    ...Typography.childButtonSmall,
    color: Colors.child.text,
  },
  playButton: {
    backgroundColor: Colors.child.playLight,
  },
  playText: {
    ...Typography.childButtonSmall,
    color: Colors.child.play,
  },
});

export default CelebrationOverlay;
