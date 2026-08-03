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

interface HintOverlayProps {
  visible: boolean;
  hintText: string;
  onDismiss: () => void;
}

const HintOverlay: React.FC<HintOverlayProps> = ({
  visible,
  hintText,
  onDismiss,
}) => {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.8);
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
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                {
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            >
              <Text style={styles.icon}>{'\uD83D\uDCA1'}</Text>
              <Text style={styles.hintText}>{hintText}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={onDismiss}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Got it, dismiss hint"
              >
                <Text style={styles.buttonText}>Got it!</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
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
    backgroundColor: Colors.child.hint,
    borderRadius: BorderRadius.child,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Shadows.child,
    borderWidth: 2,
    borderColor: Colors.info + '40',
  },
  icon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
    includeFontPadding: false,
  },
  hintText: {
    ...Typography.childBody,
    color: Colors.child.hintText,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 28,
  },
  button: {
    minHeight: 48,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.child,
    backgroundColor: Colors.info,
  },
  buttonText: {
    ...Typography.childButtonSmall,
    color: Colors.child.textInverse,
    textAlign: 'center',
  },
});

export default HintOverlay;
