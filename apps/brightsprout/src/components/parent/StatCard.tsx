import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = Colors.parent.primary,
}) => {
  return (
    <View style={styles.card}>
      {icon ? (
        <View style={[styles.iconContainer, { backgroundColor: color + '16' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      ) : null}
      <Text style={[styles.value, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.parent.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    minHeight: 88,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    fontSize: 18,
    includeFontPadding: false,
  },
  value: {
    ...Typography.parentValue,
    marginBottom: Spacing.xs,
    includeFontPadding: false,
  },
  title: {
    ...Typography.caption,
    color: Colors.parent.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.parentSubtitle,
    textAlign: 'center',
  },
});

export default StatCard;
