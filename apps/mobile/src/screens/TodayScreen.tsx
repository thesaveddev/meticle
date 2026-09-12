import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { HomecareVisit, MobileUser, OfflineVisitAction } from '../types'
import { IconCheck, IconClock, IconAlert, IconSyncSmall, IconOffline, IconSync, IconNavigate, IconTwoPerson } from '../components/Icons'
import { hapticLight, hapticMedium } from '../services/haptics'
import { isOverdue, overdueLabel } from '../utils/visitStatus'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function dateLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

interface TimelineVisit {
  visit: HomecareVisit
  kind: 'past' | 'current' | 'next' | 'future'
}

function classifyVisits(visits: HomecareVisit[]): TimelineVisit[] {
  const now = new Date()
  const sorted = [...visits].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())

  let foundCurrent = false
  let foundNext = false

  return sorted.map(v => {
    const start = new Date(v.scheduled_start)
    const end = new Date(v.scheduled_end)

    if (['completed', 'missed'].includes(v.status)) {
      return { visit: v, kind: 'past' as const }
    }
    if (v.status === 'checked_in') {
      foundCurrent = true
      return { visit: v, kind: 'current' as const }
    }
    if (now >= start && now <= end) {
      foundCurrent = true
      return { visit: v, kind: 'current' as const }
    }
    if (!foundNext && now < start) {
      foundNext = true
      return { visit: v, kind: 'next' as const }
    }
    return { visit: v, kind: 'future' as const }
  })
}

/* ─── Timeline dot ──────────────────────────────────────────── */
function TimelineDot({ kind, overdue, c }: { kind: string; overdue?: boolean; c: any }) {
  if (overdue) {
    return (
      <View style={[styles.dot, { backgroundColor: c.danger }]}>
        <IconAlert size={10} color={c.inverse} />
      </View>
    )
  }
  switch (kind) {
    case 'past':
      return (
        <View style={[styles.dot, { backgroundColor: c.success }]}>
          <IconCheck size={10} color={c.inverse} />
        </View>
      )
    case 'current':
      return (
        <View style={[styles.dot, styles.dotCurrent, { borderColor: c.primary }]}>
          <View style={[styles.dotInner, { backgroundColor: c.primary }]} />
        </View>
      )
    default:
      return <View style={[styles.dot, { backgroundColor: c.surface, borderColor: c.border }]} />
  }
}

/* ─── Custom refresh indicator ──────────────────────────────── */
function CustomRefreshIndicator({ refreshing, c }: { refreshing: boolean; c: any }) {
  const spin = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ).start()
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.5, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start()
    } else {
      spin.stopAnimation(); spin.setValue(0)
      pulse.stopAnimation(); pulse.setValue(1)
    }
  }, [refreshing])

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={styles.refreshWrap}>
      <Animated.View style={{ transform: [{ rotate: rotation }, { scale: pulse }] }}>
        <IconSync size={20} color={c.primary} />
      </Animated.View>
      <Text style={[styles.refreshText, { color: c.subtle }]}>{refreshing ? 'Refreshing...' : 'Pull to refresh'}</Text>
    </View>
  )
}

export function TodayScreen({ user, visits, queue, onVisit, onRefresh, refreshing, onSync }: {
  user: MobileUser
  visits: HomecareVisit[]
  queue: OfflineVisitAction[]
  onVisit: (v: HomecareVisit) => void
  onRefresh: () => void
  refreshing: boolean
  onSync: () => void
}) {
  const c = useAppColors()
  const timeline = useMemo(() => classifyVisits(visits), [visits])
  const total = visits.length
  const completed = visits.filter(v => v.status === 'completed').length
  const progress = total > 0 ? completed / total : 0

  const currentVisit = timeline.find(t => t.kind === 'current')
  const nextVisit = timeline.find(t => t.kind === 'next')
  const pastVisits = timeline.filter(t => t.kind === 'past')
  const completedVisits = pastVisits.filter(tv => tv.visit.status === 'completed')
  const missedVisits = pastVisits.filter(tv => tv.visit.status === 'missed')
  const futureVisits = timeline.filter(t => t.kind === 'future')
  const overdueVisits = futureVisits.filter(tv => isOverdue(tv.visit))
  const onTimeVisits = futureVisits.filter(tv => !isOverdue(tv.visit))

  // All visits in timeline order for the connected timeline
  const allTimeline: TimelineVisit[] = [
    ...pastVisits,
    ...(currentVisit ? [currentVisit] : []),
    ...(nextVisit ? [nextVisit] : []),
    ...overdueVisits,
    ...onTimeVisits,
  ]

  return (
    <ScrollView
      style={[styles.screen, dyn(c).screen]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { hapticMedium(); onRefresh() }}
          tintColor="transparent"
          colors={['transparent']}
          style={{ backgroundColor: 'transparent' }}
        />
      }
    >
      <CustomRefreshIndicator refreshing={refreshing} c={c} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.dateText, { color: c.subtle }]}>{dateLabel()}</Text>
          <Text style={[styles.userName, { color: c.ink }]}>{greeting()}, {user.first_name || user.email.split('@')[0]}</Text>
        </View>
        <View style={styles.headerActions}>
          {queue.length > 0 ? (
            <Pressable onPress={() => { hapticLight(); onSync() }} style={[styles.syncBadge, { backgroundColor: c.warningSurface, borderColor: c.warning + '30' }]}>
              <IconOffline size={14} color={c.warning} />
              <Text style={[styles.syncBadgeText, { color: c.warning }]}>{queue.length}</Text>
            </Pressable>
          ) : (
            <View style={[styles.syncBadgeOk, { backgroundColor: c.successSurface, borderColor: c.success + '30' }]}>
              <IconSyncSmall size={14} color={c.success} />
            </View>
          )}
        </View>
      </View>

      {/* Progress card */}
      <View style={[styles.progressCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: c.ink }]}>Today's progress</Text>
          <Text style={[styles.progressPct, { color: c.primary }]}>{total > 0 ? Math.round(progress * 100) : 0}%</Text>
        </View>
        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
          <View style={[styles.progressFill, { backgroundColor: c.primary, width: `${Math.max(progress * 100, 2)}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={[styles.progressMetaText, { color: c.muted }]}>{completed} of {total} calls completed</Text>
          {currentVisit && (
            <View style={[styles.liveIndicator, { backgroundColor: c.primarySurface }]}>
              <View style={[styles.liveDot, { backgroundColor: c.primary }]} />
              <Text style={[styles.liveText, { color: c.primary }]}>In progress</Text>
            </View>
          )}
        </View>
      </View>

      {/* Timeline */}
      {allTimeline.length > 0 && (
        <View style={styles.timeline}>
          {allTimeline.map((tv, i) => {
            const ov = isOverdue(tv.visit)
            const isLast = i === allTimeline.length - 1
            const isCurrent = tv.kind === 'current'
            const isPast = tv.kind === 'past'
            const lineColor = isPast ? c.success : isCurrent ? c.primary : ov ? c.danger : c.border

            return (
              <View key={tv.visit.id} style={styles.timelineRow}>
                {/* Left: dot + line */}
                <View style={styles.timelineLeft}>
                  <TimelineDot kind={tv.kind} overdue={ov} c={c} />
                  {!isLast && <View style={[styles.timelineLine, { backgroundColor: lineColor }]} />}
                </View>

                {/* Right: card */}
                <Pressable
                  onPress={() => { hapticLight(); onVisit(tv.visit) }}
                  style={({ pressed }) => [
                    styles.timelineCard,
                    { backgroundColor: c.surface, borderColor: c.borderLight },
                    isCurrent && !ov && { backgroundColor: c.primarySurface, borderColor: c.primary + '40' },
                    isPast && { opacity: 0.6 },
                    ov && { backgroundColor: c.dangerSurface, borderColor: c.danger + '40' },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {/* Time badge */}
                  <View style={[styles.timeBadge, { backgroundColor: isPast ? c.surfaceAlt : isCurrent ? c.primarySurface : ov ? c.dangerSurface : c.surfaceAlt }]}>
                    <Text style={[styles.timeBadgeText, { color: isPast ? c.muted : isCurrent ? c.primary : ov ? c.danger : c.muted }]}>
                      {time(tv.visit.scheduled_start)}
                    </Text>
                    <View style={[styles.timeDash, { backgroundColor: isPast ? c.border : isCurrent ? c.primary + '40' : ov ? c.danger + '40' : c.border }]} />
                    <Text style={[styles.timeBadgeText, { color: isPast ? c.subtle : isCurrent ? c.primary : ov ? c.danger : c.subtle }]}>
                      {time(tv.visit.scheduled_end)}
                    </Text>
                  </View>

                  {/* Content */}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineName, { color: isPast ? c.muted : ov ? c.danger : c.ink }]} numberOfLines={1}>
                      {tv.visit.label}
                    </Text>
                    {tv.visit.person_name && (
                      <Text style={[styles.timelinePerson, { color: isPast ? c.subtle : c.muted }]} numberOfLines={1}>
                        {tv.visit.person_name}
                      </Text>
                    )}
                    {tv.visit.person_address && (
                      <Text style={[styles.timelineAddr, { color: c.subtle }]} numberOfLines={1}>
                        {tv.visit.person_address}
                      </Text>
                    )}
                    {ov && <Text style={[styles.overdueTag, { color: c.danger }]}>{overdueLabel(tv.visit)}</Text>}
                    {tv.visit.requires_two_staff && (
                      <View style={[styles.twoPersonBadge, { backgroundColor: c.warningSurface, borderColor: c.warning + '30' }]}>  
                        <IconTwoPerson size={12} color={c.warning} />
                        <Text style={[styles.twoPersonText, { color: c.warning }]}>2-person</Text>
                      </View>
                    )}
                  </View>

                  {/* Status indicator */}
                  <View style={styles.timelineStatus}>
                    {isPast && tv.visit.status === 'completed' && <IconCheck size={16} color={c.success} />}
                    {isPast && tv.visit.status === 'missed' && <IconAlert size={16} color={c.danger} />}
                    {isCurrent && !ov && <IconClock size={16} color={c.primary} />}
                    {ov && <IconAlert size={16} color={c.danger} />}
                    {!isPast && !isCurrent && !ov && <View style={[styles.futureDot, { borderColor: c.border }]} />}
                  </View>
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      {/* Missed calls alert */}
      {missedVisits.length > 0 && (
        <View style={[styles.missedCard, { backgroundColor: c.dangerSurface, borderColor: c.danger + '30' }]}>
          <View style={styles.missedHeader}>
            <IconAlert size={18} color={c.danger} />
            <Text style={[styles.missedTitle, { color: c.danger }]}>{missedVisits.length} missed call{missedVisits.length !== 1 ? 's' : ''}</Text>
          </View>
          {missedVisits.map(tv => (
            <Pressable key={tv.visit.id} onPress={() => { hapticLight(); onVisit(tv.visit) }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.danger + '20' }, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '600', color: c.danger }} numberOfLines={1}>{tv.visit.label}</Text>
                <Text style={{ fontFamily: FONT, fontSize: 12, color: c.muted }}>{tv.visit.person_name} · {time(tv.visit.scheduled_start)}</Text>
              </View>
              <Text style={{ fontFamily: FONT, fontSize: 12, fontWeight: '600', color: c.danger }}>→</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Empty state */}
      {visits.length === 0 && !refreshing && (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <IconClock size={32} color={c.subtle} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.ink }]}>No calls today</Text>
          <Text style={[styles.emptyText, { color: c.muted }]}>Pull down to refresh your schedule.</Text>
        </View>
      )}

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  )
}

/* ─── dayRange helper (exported for App.tsx) ─────────────────── */
export function dayRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  return { from, to }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  dateText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.subtle },
  userName: { fontFamily: FONT, fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.full, borderWidth: 1,
  },
  syncBadgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  syncBadgeOk: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  /* Progress card */
  progressCard: {
    borderRadius: radii.xl, borderWidth: 1,
    padding: spacing.base, marginBottom: spacing.xl,
    ...elevation.sm,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  progressTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  progressPct: { fontFamily: FONT, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill: { height: 6, borderRadius: 3 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressMetaText: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },

  /* Timeline */
  timeline: { paddingTop: spacing.xs },

  timelineRow: { flexDirection: 'row', marginBottom: 0 },

  timelineLeft: {
    width: 28, alignItems: 'center',
  },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  dotCurrent: {
    backgroundColor: colors.surface, borderWidth: 3,
  },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: {
    width: 2, flex: 1, minHeight: 16,
  },

  timelineCard: {
    flex: 1, borderRadius: radii.lg,
    borderWidth: 1, padding: spacing.base,
    marginBottom: spacing.sm, marginLeft: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 80,
    ...elevation.sm,
  },

  timeBadge: {
    alignItems: 'center', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs, borderRadius: radii.md,
    minWidth: 52,
  },
  timeBadgeText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  timeDash: { width: 16, height: 1.5, borderRadius: 1, marginVertical: 3 },

  timelineContent: { flex: 1 },
  timelineName: { fontFamily: FONT, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  timelinePerson: { fontFamily: FONT, fontSize: 13, fontWeight: '400', marginTop: 2 },
  timelineAddr: { fontFamily: FONT, fontSize: 11, fontWeight: '400', marginTop: 2 },
  overdueTag: { fontFamily: FONT, fontSize: 11, fontWeight: '700', marginTop: 3 },
  twoPersonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, marginTop: 4, alignSelf: 'flex-start' },
  twoPersonText: { fontFamily: FONT, fontSize: 10, fontWeight: '700' },

  timelineStatus: { width: 24, alignItems: 'center', justifyContent: 'center' },
  futureDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },

  /* Refresh indicator */
  refreshWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },
  refreshText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', marginTop: spacing.xs },

  /* Missed calls */
  missedCard: {
    borderRadius: radii.lg, borderWidth: 1,
    padding: spacing.base, marginBottom: spacing.xl,
    ...elevation.sm,
  },
  missedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  missedTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.base, ...elevation.sm,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '400' },
})
