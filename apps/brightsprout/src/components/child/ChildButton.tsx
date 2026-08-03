import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../theme';
import { ButtonVariant } from '../../types';

interface ChildButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'normal' | 'large';
  disabled?: boolean;
  icon?: string;
  loading?: boolean;
  fullWidth?: boolean;
  color?: string;
  style?: ViewStyle;
}

const ChildButton: React.FC<ChildButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  icon,
  loading = false,
  fullWidth = false,
  color,
  style,
}) => {
  const isLarge = size === 'large';
  const minHeight = isLarge ? 72 : 56;

  const containerStyle: ViewStyle[] = [
    styles.base,
    { minHeight },
    fullWidth && styles.fullWidth,
  ];

  const textStyle: TextStyle[] = [
    isLarge ? Typography.childButton : Typography.childButtonSmall,
    styles.textBase,
  ];

  switch (variant) {
    case 'primary':
      containerStyle.push(
        styles.primary,
        Shadows.childButton,
        disabled && styles.disabled,
      );
      textStyle.push(styles.primaryText);
      if (color) {
        containerStyle.push({ backgroundColor: color });
      }
      break;
    case 'secondary':
      containerStyle.push(
        styles.secondary,
        disabled && styles.disabled,
      );
      textStyle.push(styles.secondaryText);
      if (color) {
        containerStyle.push({ backgroundColor: color });
      }
      break;
    case 'outline':
      containerStyle.push(
        styles.outline,
        disabled && styles.disabledOutline,
      );
      textStyle.push(styles.outlineText);
      if (color) {
        containerStyle.push({ borderColor: color });
        textStyle.push({ color });
      }
      break;
    case 'play':
      containerStyle.push(
        styles.play,
        Shadows.childButton,
        disabled && styles.disabled,
      );
      textStyle.push(styles.playText);
      if (color) {
        containerStyle.push({ backgroundColor: color });
      }
      break;
  }

  if (style) {
    containerStyle.push(style);
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          size={isLarge ? 'large' : 'small'}
          color={
            variant === 'outline'
              ? Colors.child.primary
              : Colors.child.textInverse
          }
        />
      ) : (
        <>
          {icon ? (
            <Text style={[styles.icon, isLarge && styles.iconLarge]}>
              {icon}
            </Text>
          ) : null}
          <Text style={textStyle} numberOfLines={2}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.child,
    minWidth: 48,
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  textBase: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  primary: {
    backgroundColor: Colors.child.primary,
  },
  primaryText: {
    color: Colors.child.textInverse,
  },
  secondary: {
    backgroundColor: Colors.child.secondaryLight,
  },
  secondaryText: {
    color: Colors.child.text,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: Colors.child.outline,
  },
  outlineText: {
    color: Colors.child.primary,
  },
  play: {
    backgroundColor: Colors.child.play,
  },
  playText: {
    color: Colors.child.textInverse,
  },
  disabled: {
    backgroundColor: Colors.borderLight,
    opacity: 0.6,
  },
  disabledOutline: {
    borderColor: Colors.borderLight,
    opacity: 0.6,
  },
  icon: {
    marginRight: Spacing.sm,
    fontSize: 22,
  },
  iconLarge: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
});

export default ChildButton;
