import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { getMyVisits } from '../services/api'

interface Props {
  session: AuthSession
  user: MobileUser
  onVisit: (visit: HomecareVisit) => void
  onSwap: () => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusConfig(status: string) {
  switch (status) {
    case 'completed': return { label: 'Done', color: colors.success, bg: colors.successSurface, icon: '✓' }
    case 'checked_in': return { label: 'Active', color: colors.primary, bg: colors.primarySurface, icon: '●' }
    case 'en_route': return { label: 'En route', color: colors.accent, bg: colors.accentSurface, icon: '→' }
    case 'missed': return { label: 'Missed', color: colors.danger, bg: colors.dangerSurface, icon: '✕' }
    default: return { label: 'Scheduled', color: colors.subtle, bg: colors.surfaceAlt, icon: '○' }
  }
}

export function WeekScreen({ session, user, onVisit, onSwap }: Props) {
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    const to = new Date(now)
    to.setDate(to.getDate() + 7)
    to.setHours(23, 59, 59)

    getMyVisits(session.accessToken, from.toISOString(), to.toISOString())
      .then(data => setVisits(data.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Group by day
  const dayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  const today = new Date().toISOString().split('T')[0]

  const grouped: Record<string, HomecareVisit[]> = {}
  for (const v of visits) {
    const dayKey = new Date(v.scheduled_start).toISOString().split('T')[0]
    if (!grouped[dayKey]) grouped[dayKey] = []
    grouped[dayKey].push(v)
  }

  const days = Object.keys(grouped).sort()

  const completed = visits.filter(v => v.status === 'completed').length
  const total = visits.length

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading your week...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.subtitle}>{total} calls · {completed} completed</Text>

        {/* Progress bar */}
        {total > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{completed} of {total} calls completed</Text>
          </View>
        )}

        {/* Swap button */}
        <Pressable onPress={onSwap} style={({ pressed }) => [styles.swapCard, pressed && { opacity: 0.8 }]}>
          <Text style={styles.swapIcon}>🔄</Text>
          <View style={styles.swapInfo}>
            <Text style={styles.swapTitle}>Swap or transfer a call</Text>
            <Text style={styles.swapDesc}>Request to swap with a colleague or transfer a call</Text>
          </View>
          <Text style={styles.swapArrow}>→</Text>
        </Pressable>

        {/* Day groups */}
        {days.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📆</Text>
            <Text style={styles.emptyTitle}>No calls this week</Text>
            <Text style={styles.emptyCopy}>Your coordinator will add calls when your route is ready.</Text>
          </View>
        ) : (
          days.map(dayKey => {
            const dayVisits = grouped[dayKey]
            const isToday = dayKey === today
            const dayLabel = dayFormatter.format(new Date(dayKey + 'T12:00:00'))
            const dayCompleted = dayVisits.filter(v => v.status === 'completed').length

            return (
              <View key={dayKey}>
                <Pressable
                  onPress={() => setSelectedDay(selectedDay === dayKey ? null : dayKey)}
                  style={styles.dayHeader}
                >
                  <View style={styles.dayHeaderLeft}>
                    {isToday && <View style={styles.todayDot} />}
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel}</Text>
                  </View>
                  <View style={styles.dayHeaderRight}>
                    <Text style={styles.dayCount}>{dayVisits.length} calls</Text>
                    <Text style={styles.dayCompleted}>{dayCompleted}/{dayVisits.length}</Text>
                  </View>
                </Pressable>

                {/* Visit cards for this day */}
                {(selectedDay === dayKey || isToday) && dayVisits.map(visit => {
                  const sc = statusConfig(visit.status)
                  return (
                    <Pressable key={visit.id} onPress={() => onVisit(visit)} style={({ pressed }) => [styles.visitCard, pressed && { opacity: 0.8 }]}>
                      <View style={styles.visitTimeCol}>
                        <Text style={styles.visitTime}>{time(visit.scheduled_start)}</Text>
                        <Text style={styles.visitTimeEnd}>{time(visit.scheduled_end)}</Text>
                      </View>
                      <View style={styles.visitInfo}>
                        <View style={styles.visitTopRow}>
                          <Text style={styles.visitLabel} numberOfLines={1}>{visit.label}</Text>
                          <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        {visit.person_name && <Text style={styles.visitPerson}>{visit.person_name}</Text>}
                        {visit.person_address && <Text style={styles.visitAddr} numberOfLines={1}>📍 {visit.person_address}</Text>}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.small },

  title: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },

  /* Progress */
  progressCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.base, ...elevation.sm },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  progressText: { ...type.small, marginTop: spacing.sm, textAlign: 'center' },

  /* Swap */
  swapCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySurface,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.primary + '20',
    padding: spacing.base, marginBottom: spacing.base, gap: spacing.md, ...elevation.sm,
  },
  swapIcon: { fontSize: 24 },
  swapInfo: { flex: 1 },
  swapTitle: { fontFamily: 'System', fontSize: 15, fontWeight: '700', color: colors.primary },
  swapDesc: { ...type.small, marginTop: 2 },
  swapArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },

  /* Empty */
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight, marginTop: spacing.xxl },
  emptyIcon: { fontSize: 32, marginBottom: spacing.md },
  emptyTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.lg },

  /* Day headers */
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dayLabel: { fontFamily: 'System', fontSize: 14, fontWeight: '700', color: colors.inkLight },
  dayLabelToday: { color: colors.primary },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayCount: { ...type.small },
  dayCompleted: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.success },

  /* Visit cards */
  visitCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md,
    marginBottom: spacing.sm, gap: spacing.md, ...elevation.sm,
  },
  visitTimeCol: { width: 52, alignItems: 'flex-start' },
  visitTime: { fontFamily: 'System', fontSize: 13, fontWeight: '700', color: colors.primary },
  visitTimeEnd: { fontFamily: 'System', fontSize: 11, color: colors.muted },
  visitInfo: { flex: 1 },
  visitTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitLabel: { ...type.bodyBold, fontSize: 14, flex: 1, marginRight: spacing.sm },
  statusChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full },
  statusText: { fontFamily: 'System', fontSize: 10, fontWeight: '600' },
  visitPerson: { ...type.small, marginTop: 2 },
  visitAddr: { ...type.small, marginTop: 2 },
})
