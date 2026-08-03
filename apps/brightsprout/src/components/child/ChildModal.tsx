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
import { ChildModalButton, ButtonVariant } from '../../types';

interface ChildModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  buttons: ChildModalButton[];
  onClose?: () => void;
}

const ChildModal: React.FC<ChildModalProps> = ({
  visible,
  title,
  message,
  icon,
  buttons,
  onClose,
}) => {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      scale.setValue(0.8);
    }
  }, [visible, backdropOpacity, scale]);

  const getButtonStyle = (variant?: ButtonVariant) => {
    switch (variant) {
      case 'secondary':
        return {
          container: styles.btnSecondary,
          text: styles.btnSecondaryText,
        };
      case 'outline':
        return {
          container: styles.btnOutline,
          text: styles.btnOutlineText,
        };
      case 'play':
        return {
          container: styles.btnPlay,
          text: styles.btnPlayText,
        };
      case 'primary':
      default:
        return {
          container: styles.btnPrimary,
          text: styles.btnPrimaryText,
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouchable}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  { transform: [{ scale }] },
                ]}
              >
                {icon ? (
                  <Text style={styles.icon}>{icon}</Text>
                ) : null}

                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                <View style={styles.buttonGroup}>
                  {buttons.map((btn, index) => {
                    const btnStyle = getButtonStyle(btn.variant);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.button, btnStyle.container]}
                        onPress={btn.onPress}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={btn.label}
                      >
                        <Text
                          style={[styles.buttonText, btnStyle.text]}
                          numberOfLines={2}
                        >
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  backdropTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.child.card,
    borderRadius: BorderRadius.child,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...Shadows.child,
  },
  icon: {
    fontSize: 52,
    marginBottom: Spacing.lg,
    includeFontPadding: false,
  },
  title: {
    ...Typography.childTitle,
    color: Colors.child.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.childBody,
    color: Colors.child.textLight,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 28,
  },
  buttonGroup: {
    width: '100%',
    gap: Spacing.sm,
  },
  button: {
    minHeight: 52,
    borderRadius: BorderRadius.child,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  buttonText: {
    ...Typography.childButtonSmall,
    textAlign: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.child.primary,
  },
  btnPrimaryText: {
    color: Colors.child.textInverse,
  },
  btnSecondary: {
    backgroundColor: Colors.child.secondaryLight,
  },
  btnSecondaryText: {
    color: Colors.child.text,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.child.outline,
  },
  btnOutlineText: {
    color: Colors.child.primary,
  },
  btnPlay: {
    backgroundColor: Colors.child.play,
    ...Shadows.childButton,
  },
  btnPlayText: {
    color: Colors.child.textInverse,
  },
});

export default ChildModal;
