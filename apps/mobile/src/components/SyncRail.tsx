import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, type } from '../theme'
import type { SyncState } from '../types'

interface SyncRailProps {
  state: SyncState
  count: number
  onPress?: () => void
}

const copy: Record<SyncState, { title: string; detail: string; color: string; background: string }> = {
  synced: { title: 'Synced', detail: 'All visit actions are up to date', color: colors.emeraldDeep, background: colors.successSoft },
  pending: { title: 'Waiting to sync', detail: 'Your visit action is saved on this device', color: colors.navy, background: colors.paper },
  syncing: { title: 'Syncing', detail: 'Sending your visit action securely', color: colors.navy, background: colors.paper },
  failed: { title: 'Sync needs attention', detail: 'Tap to retry when you have signal', color: colors.error, background: colors.errorSoft },
}

export function SyncRail({ state, count, onPress }: SyncRailProps) {
  const item = copy[state]
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.detail}`} onPress={onPress} style={({ pressed }) => [styles.rail, { backgroundColor: item.background }, pressed && styles.pressed]}>
      <View style={[styles.mark, { backgroundColor: item.color }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: item.color }]}>{item.title}{count > 0 ? ` · ${count}` : ''}</Text>
        <Text style={styles.detail}>{item.detail}</Text>
      </View>
      {state === 'failed' && <Text style={styles.action}>Retry</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  rail: { minHeight: 64, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.hairline },
  mark: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  copy: { flex: 1 },
  title: { ...type.label },
  detail: { ...type.caption, color: colors.mist, marginTop: 2 },
  action: { ...type.label, color: colors.navy },
  pressed: { opacity: 0.78 },
})
