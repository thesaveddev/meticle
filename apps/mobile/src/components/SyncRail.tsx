import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT } from '../theme'
import { IconSyncSmall, IconOffline } from './Icons'

export function SyncRail({ queue, onSync }: { queue: { state: string; action: string; visitId: string }[]; onSync: () => void }) {
  if (queue.length === 0) return null

  return (
    <View style={styles.rail}>
      <View style={styles.row}>
        <IconOffline size={14} color={colors.warning} />
        <Text style={styles.text}>
          {queue.length} action{queue.length === 1 ? '' : 's'} waiting to sync
        </Text>
        <Pressable onPress={onSync} style={styles.syncBtn}>
          <IconSyncSmall size={12} color={colors.inverse} />
          <Text style={styles.syncText}>Sync</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  rail: {
    backgroundColor: colors.warningSurface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  syncText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inverse,
  },
})
