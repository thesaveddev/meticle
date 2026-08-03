import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { AVATAR_OPTIONS } from '../../types';

interface AvatarPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  color?: string;
}

const ANIMATION_CONFIG = {
  friction: 5,
  tension: 100,
  useNativeDriver: true,
};

const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedId,
  onSelect,
  color = Colors.child.secondary,
}) => {
  const scales = useRef<Record<string, Animated.Value>>({}).current;

  const getScale = (id: string): Animated.Value => {
    if (!scales[id]) {
      scales[id] = new Animated.Value(1);
    }
    return scales[id];
  };

  const handlePressIn = (id: string) => {
    Animated.spring(getScale(id), {
      toValue: 0.9,
      ...ANIMATION_CONFIG,
    }).start();
  };

  const handlePressOut = (id: string) => {
    Animated.spring(getScale(id), {
      toValue: 1,
      ...ANIMATION_CONFIG,
    }).start();
  };

  const handleSelect = (id: string) => {
    handlePressIn(id);
    setTimeout(() => {
      handlePressOut(id);
      onSelect(id);
    }, 80);
  };

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Avatar selector">
      {AVATAR_OPTIONS.map((avatar) => {
        const isSelected = selectedId === avatar.id;
        const animScale = getScale(avatar.id);

        return (
          <Animated.View
            key={avatar.id}
            style={[
              styles.itemWrapper,
              { transform: [{ scale: animScale }] },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.avatarItem,
                { backgroundColor: color + '20' },
                isSelected && {
                  borderWidth: 3,
                  borderColor: color,
                  backgroundColor: color + '40',
                },
              ]}
              onPress={() => handleSelect(avatar.id)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={avatar.name}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.emoji}>{avatar.emoji}</Text>
            </TouchableOpacity>
            {isSelected ? (
              <Text style={[styles.name, { color }]} numberOfLines={1}>
                {avatar.name}
              </Text>
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemWrapper: {
    width: '23%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarItem: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  emoji: {
    fontSize: 32,
    includeFontPadding: false,
    textAlign: 'center',
  },
  name: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

export default AvatarPicker;
