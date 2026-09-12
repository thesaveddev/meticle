import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT } from '../theme'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { getMyVisits } from '../services/api'
import { IconCheck, IconClock, IconAlert, IconForward, IconNavigate } from '../components/Icons'
import { hapticLight, hapticMedium } from '../services/haptics'
import { openNavigation } from '../services/navigation'

interface Props {
  session: AuthSession
  user: MobileUser
  onVisit: (visit: HomecareVisit) => void
  onSwap: () => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function shortDay(date: Date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short' })
}

function dayNum(date: Date) {
  return date.getDate()
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function StatusChip({ status }: { status: string }) {
  let color = colors.subtle
  let label = 'Scheduled'
  let Icon = null

  switch (status) {
    case 'completed':
      color = colors.success; label = 'Done'
      Icon = <IconCheck size={10} color={colors.success} />
      break
    case 'checked_in':
      color = colors.primary; label = 'Active'
      Icon = <IconClock size={10} color={colors.primary} />
      break
    case 'missed':
      color = colors.danger; label = 'Missed'
      Icon = <IconAlert size={10} color={colors.danger} />
      break
    default:
      Icon = <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: colors.subtle }} />
  }

  return (
    <View style={[styles.chip, { backgroundColor: color + '15' }]}>
      {Icon}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  )
}

export function WeekScreen({ session, user, onVisit, onSwap }: Props) {
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const loadWeek = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const now = new Date()
      const from = new Date(now); from.setHours(0, 0, 0, 0)
      const to = new Date(now); to.setDate(to.getDate() + 7); to.setHours(23, 59, 59)
      const data = await getMyVisits(session.accessToken, from.toISOString(), to.toISOString())
      setVisits(data.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()))
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { loadWeek() }, [loadWeek])

  // Generate 7 days starting from today
  const weekDays = useMemo(() => {
    const days: Date[] = []
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      days.push(d)
    }
    return days
  }, [])

  // Visits for selected day
  const dayVisits = useMemo(() => {
    return visits.filter(v => {
      const vDate = new Date(v.scheduled_start)
      return isSameDay(vDate, selectedDay)
    })
  }, [visits, selectedDay])

  const total = visits.length
  const completed = visits.filter(v => v.status === 'completed').length

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { hapticMedium(); loadWeek(true) }} tintColor="transparent" colors={['transparent']} />}
      >
        {/* Header */}
        <Text style={styles.title}>This week</Text>
        <Text style={styles.subtitle}>{total} calls · {completed} completed</Text>

        {/* Day picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayPicker}>
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDay)
            const isToday = isSameDay(day, new Date())
            const dayVisitCount = visits.filter(v => isSameDay(new Date(v.scheduled_start), day)).length
            const dayCompleted = visits.filter(v => isSameDay(new Date(v.scheduled_start), day) && v.status === 'completed').length

            return (
              <Pressable
                key={i}
                onPress={() => { hapticLight(); setSelectedDay(day) }}
                style={({ pressed }) => [
                  styles.dayPill,
                  isSelected && styles.dayPillActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.dayPillLabel, isSelected && styles.dayPillLabelActive]}>
                  {shortDay(day)}
                </Text>
                <Text style={[styles.dayPillNum, isSelected && styles.dayPillNumActive]}>
                  {dayNum(day)}
                </Text>
                {dayVisitCount > 0 && (
                  <View style={styles.dayPillDots}>
                    {Array.from({ length: Math.min(dayVisitCount, 4) }).map((_, j) => (
                      <View
                        key={j}
                        style={[
                          styles.dayPillDot,
                          j < dayCompleted && { backgroundColor: isSelected ? colors.inverse : colors.success },
                          j >= dayCompleted && { backgroundColor: isSelected ? colors.inverse + '60' : colors.subtle + '60' },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Progress bar */}
        {total > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Week progress</Text>
              <Text style={styles.progressPercent}>{Math.round((completed / total) * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]} />
            </View>
          </View>
        )}

        {/* Swap button */}
        <Pressable onPress={() => { hapticLight(); onSwap() }} style={({ pressed }) => [styles.swapCard, pressed && { opacity: 0.8 }]}>
          <View style={styles.swapIconWrap}>
            <IconForward size={18} color={colors.primary} />
          </View>
          <View style={styles.swapInfo}>
            <Text style={styles.swapTitle}>Swap or transfer a call</Text>
            <Text style={styles.swapDesc}>Request to swap with a colleague</Text>
          </View>
          <Text style={styles.swapArrow}>→</Text>
        </Pressable>

        {/* Day visits */}
        <View style={styles.daySection}>
          <Text style={styles.daySectionLabel}>
            {selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {dayVisits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No calls on this day</Text>
              <Text style={styles.emptyCopy}>Select another day or swap a call with a colleague.</Text>
            </View>
          ) : (
            dayVisits.map(visit => (
              <Pressable
                key={visit.id}
                onPress={() => { hapticLight(); onVisit(visit) }}
                style={({ pressed }) => [styles.visitCard, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.visitTimeCol}>
                  <Text style={styles.visitTime}>{time(visit.scheduled_start)}</Text>
                  <View style={styles.visitTimeDash} />
                  <Text style={styles.visitTimeEnd}>{time(visit.scheduled_end)}</Text>
                </View>
                <View style={styles.visitInfo}>
                  <View style={styles.visitTopRow}>
                    <Text style={styles.visitLabel} numberOfLines={1}>{visit.label}</Text>
                    <StatusChip status={visit.status} />
                  </View>
                  {visit.person_name && (
                    <Text style={styles.visitPerson} numberOfLines={1}>{visit.person_name}</Text>
                  )}
                  {visit.person_address && (
                    <View style={styles.addrRow}>
                      <Text style={styles.visitAddr} numberOfLines={1}>{visit.person_address}</Text>
                      <Pressable onPress={() => { hapticLight(); openNavigation({ destination: visit.person_address!, label: visit.person_name || visit.label }) }}
                        style={({ pressed }) => [styles.navPill, pressed && { opacity: 0.7 }]}>
                        <IconNavigate size={12} color={colors.primary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.muted },

  title: { fontFamily: FONT, fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.4, paddingHorizontal: spacing.base },
  subtitle: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: colors.muted, paddingHorizontal: spacing.base, marginTop: 2, marginBottom: spacing.base },

  /* Day picker */
  dayPicker: { paddingHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.base },
  dayPill: {
    width: 56, alignItems: 'center', paddingVertical: spacing.md,
    borderRadius: radii.lg, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.borderLight, gap: 4,
  },
  dayPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayPillLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '600', color: colors.subtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayPillLabelActive: { color: colors.inverse + 'CC' },
  dayPillNum: { fontFamily: FONT, fontSize: 20, fontWeight: '800', color: colors.ink },
  dayPillNumActive: { color: colors.inverse },
  dayPillDots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dayPillDot: { width: 4, height: 4, borderRadius: 2 },

  /* Progress */
  progressCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, marginHorizontal: spacing.base, marginBottom: spacing.base,
    ...elevation.sm,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.inkLight },
  progressPercent: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: colors.success },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 3 },

  /* Swap */
  swapCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primarySurface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.primary + '20',
    padding: spacing.base, marginHorizontal: spacing.base, marginBottom: spacing.base,
    gap: spacing.md, ...elevation.sm,
  },
  swapIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  swapInfo: { flex: 1 },
  swapTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: colors.primary },
  swapDesc: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 2 },
  swapArrow: { fontFamily: FONT, fontSize: 18, fontWeight: '600', color: colors.primary },

  /* Day section */
  daySection: { paddingHorizontal: spacing.base },
  daySectionLabel: {
    fontFamily: FONT, fontSize: 13, fontWeight: '700', color: colors.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.xxl, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: spacing.xs },
  emptyCopy: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, textAlign: 'center' },

  /* Visit card */
  visitCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, marginBottom: spacing.sm, gap: spacing.md,
    ...elevation.sm,
  },
  visitTimeCol: { width: 48, alignItems: 'center' },
  visitTime: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: colors.primary },
  visitTimeDash: { width: 1, height: 8, backgroundColor: colors.border, marginVertical: 3 },
  visitTimeEnd: { fontFamily: FONT, fontSize: 11, fontWeight: '400', color: colors.muted },
  visitInfo: { flex: 1 },
  visitTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, marginRight: spacing.sm },
  visitPerson: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 3 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  visitAddr: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.subtle, flex: 1 },
  navPill: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary + '20',
  },

  /* Chip */
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full,
  },
  chipText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
})
