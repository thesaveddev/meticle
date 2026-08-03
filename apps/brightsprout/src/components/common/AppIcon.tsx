import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../../theme';

interface AppIconProps {
  emoji: string;
  size?: number;
  backgroundColor?: string;
  hasBorder?: boolean;
  borderColor?: string;
}

const AppIcon: React.FC<AppIconProps> = ({
  emoji,
  size = 48,
  backgroundColor = Colors.child.primaryLight,
  hasBorder = false,
  borderColor = Colors.child.primary,
}) => {
  const borderRadius = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.56);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
        },
        hasBorder && {
          borderWidth: 2.5,
          borderColor,
        },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Icon: ${emoji}`}
    >
      <Text style={[styles.emoji, { fontSize }]}>{emoji}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default AppIcon;
