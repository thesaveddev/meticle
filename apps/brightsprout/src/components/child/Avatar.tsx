import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../../theme';
import { AVATAR_OPTIONS } from '../../types';

interface AvatarProps {
  avatarId: string;
  color?: string;
  size?: number;
  showBorder?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
  avatarId,
  color = Colors.child.secondary,
  size = 72,
  showBorder = false,
}) => {
  const avatarOption = AVATAR_OPTIONS.find((a) => a.id === avatarId);
  const emoji = avatarOption?.emoji ?? '\uD83D\uDE00';
  const fontSize = Math.round(size * 0.5);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        showBorder && {
          borderWidth: 3,
          borderColor: Colors.child.avatarBorder,
        },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Avatar: ${avatarOption?.name ?? 'Default'}`}
    >
      <Text style={[styles.emoji, { fontSize }]}>{emoji}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default Avatar;
