import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT } from '../theme'
import { IconCheck, IconClock, IconAlert } from './Icons'
import { hapticLight } from '../services/haptics'

interface Props {
  label: string
  personName?: string
  scheduledStart: string
  scheduledEnd: string
  status: string
  mileage?: number
  onPress: () => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <IconCheck size={16} color={colors.success} />
    case 'checked_in': return <IconClock size={16} color={colors.primary} />
    case 'missed': return <IconAlert size={16} color={colors.danger} />
    default: return <View style={styles.pendingDot} />
  }
}

export function VisitRow({ label, personName, scheduledStart, scheduledEnd, status, mileage, onPress }: Props) {
  const isCompleted = status === 'completed'
  const isMissed = status === 'missed'
  const isActive = status === 'checked_in'

  return (
    <Pressable
      onPress={() => { hapticLight(); onPress() }}
      style={({ pressed }) => [
        styles.row,
        isActive && styles.rowActive,
        isCompleted && styles.rowCompleted,
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Timeline dot */}
      <View style={styles.timeline}>
        <StatusIcon status={status} />
        <View style={[styles.timelineLine, isCompleted && { backgroundColor: colors.success + '40' }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.timeRow}>
          <Text style={[styles.time, isCompleted && styles.timeCompleted]}>
            {time(scheduledStart)} – {time(scheduledEnd)}
          </Text>
          {mileage != null && mileage > 0 && (
            <View style={styles.mileageBadge}>
              <Text style={styles.mileageText}>{mileage}mi</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, isCompleted && styles.labelCompleted]} numberOfLines={1}>{label}</Text>
        {personName && (
          <Text style={[styles.person, isCompleted && styles.personCompleted]} numberOfLines={1}>{personName}</Text>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  rowActive: {},
  rowCompleted: { opacity: 0.6 },

  /* Timeline */
  timeline: {
    width: 24,
    alignItems: 'center',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    marginTop: 4,
  },

  /* Content */
  content: { flex: 1, paddingLeft: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.primary },
  timeCompleted: { color: colors.subtle },
  label: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 2 },
  labelCompleted: { color: colors.muted },
  person: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: 1 },
  personCompleted: { color: colors.subtle },

  /* Mileage badge */
  mileageBadge: {
    backgroundColor: colors.accentSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  mileageText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: colors.accent },
})
