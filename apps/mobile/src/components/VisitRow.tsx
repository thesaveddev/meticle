import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { HomecareVisit } from '../types'
import { hapticLight } from '../services/haptics'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusConfig(status: HomecareVisit['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', color: colors.success, bg: colors.successSurface, icon: '✓' }
    case 'checked_in':
      return { label: 'Checked in', color: colors.primary, bg: colors.primarySurface, icon: '●' }
    case 'en_route':
      return { label: 'En route', color: colors.accent, bg: colors.accentSurface, icon: '→' }
    case 'missed':
      return { label: 'Missed', color: colors.danger, bg: colors.dangerSurface, icon: '✕' }
    case 'cancelled':
      return { label: 'Cancelled', color: colors.muted, bg: colors.bg, icon: '—' }
    default:
      return { label: 'Scheduled', color: colors.subtle, bg: colors.surfaceAlt, icon: '○' }
  }
}

export function VisitRow({ visit, onPress, active = false }: { visit: HomecareVisit; onPress: () => void; active?: boolean }) {
  const sc = statusConfig(visit.status)
  const isActive = visit.status === 'checked_in' || visit.status === 'en_route'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${time(visit.scheduled_start)} ${visit.label}${visit.person_name ? `, ${visit.person_name}` : ''}, ${sc.label}`}
      onPress={() => { hapticLight(); onPress() }}
      style={({ pressed }) => [
        styles.row,
        active && styles.rowActive,
        pressed && styles.pressed,
      ]}
    >
      {/* Timeline column */}
      <View style={styles.timeline}>
        <View style={[styles.dot, isActive && styles.dotActive, visit.status === 'completed' && styles.dotCompleted]}>
          <Text style={[styles.dotIcon, { color: isActive ? colors.inverse : sc.color }]}>{sc.icon}</Text>
        </View>
        <View style={[styles.line, visit.status === 'completed' && styles.lineCompleted]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.time}>{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</Text>
          <View style={[styles.chip, { backgroundColor: sc.bg }]}>
            <Text style={[styles.chipText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        </View>
        <Text style={styles.label} numberOfLines={1}>{visit.label}</Text>
        {visit.person_name && (
          <Text style={styles.person}>{visit.person_name}</Text>
        )}
        {visit.person_address && (
          <Text style={styles.address} numberOfLines={1}>📍 {visit.person_address}</Text>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowActive: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.md,
    borderBottomWidth: 0,
    marginBottom: spacing.xs,
    ...elevation.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  timeline: {
    width: 40,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotCompleted: {
    backgroundColor: colors.successSurface,
    borderColor: colors.success,
  },
  dotIcon: {
    fontSize: 11,
    fontWeight: '700',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  lineCompleted: {
    backgroundColor: colors.success + '40',
  },
  content: {
    flex: 1,
    paddingLeft: spacing.md,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  time: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  chipText: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '600',
  },
  label: {
    ...type.bodyBold,
    marginBottom: 2,
  },
  person: {
    ...type.body,
    color: colors.inkLight,
    fontSize: 14,
  },
  address: {
    ...type.small,
    marginTop: 3,
  },
})
