import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, FONT } from '../theme'
import { IconSyncSmall, IconOffline } from './Icons'
import type { OfflineVisitAction } from '../types'

/**
 * Surfaces the offline visit-action queue. The two states are shown separately
 * on purpose: an action still waiting will clear itself on the next sync,
 * whereas one the server has refused will not, and a carer needs to be able to
 * tell the difference rather than tapping Sync forever.
 */
export function SyncRail({ queue, onSync }: {
  queue: OfflineVisitAction[]
  onSync: () => void
}) {
  if (queue.length === 0) return null

  const failed = queue.filter(item => item.state === 'failed').length
  const waiting = queue.length - failed

  return (
    <View style={styles.rail}>
      {waiting > 0 && (
        <View style={styles.row}>
          <IconOffline size={14} color={colors.warning} />
          <Text style={styles.text}>
            {waiting} action{waiting === 1 ? '' : 's'} waiting to sync
          </Text>
          <Pressable onPress={onSync} style={styles.syncBtn}>
            <IconSyncSmall size={12} color={colors.inverse} />
            <Text style={styles.syncText}>Sync</Text>
          </Pressable>
        </View>
      )}
      {failed > 0 && (
        <View style={[styles.row, waiting > 0 && styles.rowDivided]}>
          <IconOffline size={14} color={colors.danger} />
          <Text style={styles.failedText}>
            {failed} action{failed === 1 ? '' : 's'} could not be saved — tell your manager
          </Text>
        </View>
      )}
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
  rowDivided: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning + '30',
  },
  text: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning,
  },
  failedText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: colors.danger,
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
