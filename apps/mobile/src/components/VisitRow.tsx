import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, type } from '../theme'
import type { HomecareVisit } from '../types'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: HomecareVisit['status']) {
  return status.replace('_', ' ')
}

export function VisitRow({ visit, onPress, active = false }: { visit: HomecareVisit; onPress: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${time(visit.scheduled_start)} ${visit.label}${visit.person_name ? `, ${visit.person_name}` : ''}`} onPress={onPress} style={({ pressed }) => [styles.row, active && styles.active, pressed && styles.pressed]}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{time(visit.scheduled_start)}</Text>
        <View style={[styles.line, visit.status === 'completed' && styles.completedLine]} />
      </View>
      <View style={styles.content}>
        <View style={styles.headingLine}>
          <Text style={styles.label} numberOfLines={1}>{visit.label}</Text>
          <Text style={[styles.status, visit.status === 'completed' ? styles.statusDone : styles.statusNeutral]}>{statusLabel(visit.status)}</Text>
        </View>
        {visit.person_name && <Text style={styles.person}>{visit.person_name}</Text>}
        {visit.person_address && <Text style={styles.address} numberOfLines={1}>{visit.person_address}</Text>}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.hairline, backgroundColor: colors.bone },
  active: { backgroundColor: colors.paper },
  pressed: { opacity: 0.78 },
  timeColumn: { width: 68, alignItems: 'flex-start' },
  time: { ...type.bodyStrong, color: colors.navy },
  line: { width: 2, flex: 1, minHeight: 30, backgroundColor: colors.hairline, marginLeft: 5, marginTop: spacing.xs },
  completedLine: { backgroundColor: colors.emerald },
  content: { flex: 1, paddingLeft: spacing.sm, minWidth: 0 },
  headingLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { ...type.bodyStrong, color: colors.ink, flex: 1 },
  status: { ...type.caption, textTransform: 'capitalize' },
  statusDone: { color: colors.emeraldDeep },
  statusNeutral: { color: colors.mist },
  person: { ...type.body, color: colors.ink, marginTop: 4 },
  address: { ...type.caption, color: colors.mist, marginTop: 2 },
})
