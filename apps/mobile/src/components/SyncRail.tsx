import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, type } from '../theme'
import type { SyncState } from '../types'
import { hapticLight } from '../services/haptics'

interface SyncRailProps {
  state: SyncState
  count: number
  onPress?: () => void
}

const copy: Record<SyncState, { icon: string; title: string; color: string; bg: string; detail?: string }> = {
  synced: {
    icon: '✓',
    title: 'All synced',
    color: colors.success,
    bg: colors.successSurface,
    detail: 'Visit actions are up to date',
  },
  pending: {
    icon: '◎',
    title: 'Pending sync',
    color: colors.primary,
    bg: colors.primarySurface,
  },
  syncing: {
    icon: '↻',
    title: 'Syncing',
    color: colors.primary,
    bg: colors.primarySurface,
    detail: 'Sending securely',
  },
  failed: {
    icon: '!',
    title: 'Sync issue',
    color: colors.danger,
    bg: colors.dangerSurface,
    detail: 'Tap retry when you have signal',
  },
}

export function SyncRail({ state, count, onPress }: SyncRailProps) {
  const item = copy[state]
  const detailText = item.detail || (count > 0 ? `${count} action(s) saved offline` : 'No pending actions')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${detailText}`}
      onPress={() => { hapticLight(); onPress?.() }}
      style={({ pressed }) => [
        styles.rail,
        { backgroundColor: item.bg },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.color + '18' }]}>
        <Text style={[styles.icon, { color: item.color }]}>{item.icon}</Text>
      </View>
      <View style={styles.copyBlock}>
        <Text style={[styles.title, { color: item.color }]}>
          {item.title}{count > 0 ? ` · ${count}` : ''}
        </Text>
        <Text style={styles.detail}>{detailText}</Text>
      </View>
      {state === 'failed' && (
        <View style={styles.retryBadge}>
          <Text style={styles.retryText}>Retry</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
    fontWeight: '700',
  },
  copyBlock: {
    flex: 1,
  },
  title: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
  },
  detail: {
    ...type.small,
    marginTop: 1,
  },
  retryBadge: {
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  retryText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: colors.inverse,
  },
  pressed: {
    opacity: 0.85,
  },
})
