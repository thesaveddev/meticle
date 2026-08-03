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

interface PauseOverlayProps {
  visible: boolean;
  onResume: () => void;
  onExit: () => void;
  onRestart: () => void;
}

const PauseOverlay: React.FC<PauseOverlayProps> = ({
  visible,
  onResume,
  onExit,
  onRestart,
}) => {
  const scale = useRef(new Animated.Value(0.7)).current;
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
      scale.setValue(0.7);
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
          <Text style={styles.pauseIcon}>{'\u23F8\uFE0F'}</Text>
          <Text style={styles.pauseTitle}>Paused</Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.resumeButton]}
              onPress={onResume}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Resume"
            >
              <Text style={styles.resumeText}>Resume</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.restartButton]}
              onPress={onRestart}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Restart"
            >
              <Text style={styles.restartText}>Restart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.exitButton]}
              onPress={onExit}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Exit"
            >
              <Text style={styles.exitText}>Exit</Text>
            </TouchableOpacity>
          </View>
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
    padding: Spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Shadows.child,
  },
  pauseIcon: {
    fontSize: 56,
    marginBottom: Spacing.lg,
    includeFontPadding: false,
  },
  pauseTitle: {
    ...Typography.childTitle,
    color: Colors.child.text,
    marginBottom: Spacing.xxl,
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
  resumeButton: {
    backgroundColor: Colors.child.primary,
  },
  resumeText: {
    ...Typography.childButtonSmall,
    color: Colors.child.textInverse,
  },
  restartButton: {
    backgroundColor: Colors.child.secondaryLight,
  },
  restartText: {
    ...Typography.childButtonSmall,
    color: Colors.child.text,
  },
  exitButton: {
    backgroundColor: Colors.child.dangerLight,
  },
  exitText: {
    ...Typography.childButtonSmall,
    color: Colors.child.danger,
  },
});

export default PauseOverlay;
