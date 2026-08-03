import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows, getWorldColors } from '../../theme';
import { WorldId } from '../../types';
import ProgressBar from './ProgressBar';

interface WorldCardProps {
  worldId: WorldId;
  name: string;
  description: string;
  emoji: string;
  progress: number;
  unlocked: boolean;
  onPress: () => void;
}

const WorldCard: React.FC<WorldCardProps> = ({
  worldId,
  name,
  description,
  emoji,
  progress,
  unlocked,
  onPress,
}) => {
  const worldColors = getWorldColors(worldId);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: worldColors.bg },
        Shadows.child,
        !unlocked && styles.locked,
      ]}
      onPress={onPress}
      disabled={!unlocked}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${unlocked ? progress + '% complete' : 'locked'}`}
      accessibilityState={{ disabled: !unlocked }}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View
            style={[
              styles.emojiContainer,
              { backgroundColor: worldColors.dark + '26' },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={styles.textArea}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            height={10}
            color={worldColors.dark}
            trackColor={worldColors.dark + '30'}
          />
          <Text style={[styles.progressText, { color: worldColors.dark }]}>
            {progress}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.child,
    minHeight: 180,
    overflow: 'hidden',
  },
  locked: {
    opacity: 0.55,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  emojiContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
  },
  emoji: {
    fontSize: 40,
    includeFontPadding: false,
  },
  textArea: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 72,
  },
  name: {
    ...Typography.title2,
    color: Colors.child.text,
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.child.textLight,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    ...Typography.caption,
    fontWeight: '700',
    marginLeft: Spacing.sm,
    minWidth: 36,
    textAlign: 'right',
  },
});

export default WorldCard;
