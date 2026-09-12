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

/* ─── Status pill ───────────────────────────────────────────── */
function StatusPill({ status, c }: { status: string; c: any }) {
  let bg = c.surfaceAlt
  let fg = c.muted
  let label = status

  switch (status) {
    case 'completed':
      bg = c.successSurface
      fg = c.successDeep
      label = 'Completed'
      break
    case 'checked_in':
      bg = c.primarySurface
      fg = c.primary
      label = 'In progress'
      break
    case 'missed':
      bg = c.dangerSurface
      fg = c.danger
      label = 'Missed'
      break
    case 'scheduled':
    case 'en_route':
      bg = c.surfaceAlt
      fg = c.muted
      label = 'Scheduled'
      break
  }

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>  
      {status === 'completed' && <IconCheck size={12} color={fg} />}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  )
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

  const allTimeline: TimelineVisit[] = [
    ...pastVisits,
    ...(currentVisit ? [currentVisit] : []),
    ...(nextVisit ? [nextVisit] : []),
    ...overdueVisits,
    ...onTimeVisits,
  ]

  const allDone = total > 0 && completed === total && !currentVisit

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.dateText, { color: c.muted }]}>{dateLabel()}</Text>
          <Text style={[styles.userName, { color: c.ink }]}>
            {greeting()}, {user.first_name || user.email.split('@')[0]} 👋
          </Text>
          {allDone && (
            <Text style={[styles.subtitle, { color: c.muted }]}>All calls completed for today. Great work!</Text>
          )}
          {!allDone && total > 0 && (
            <Text style={[styles.subtitle, { color: c.muted }]}>{completed} of {total} calls completed</Text>
          )}
        </View>
        <View style={styles.headerActions}>  
          {queue.length > 0 ? (
            <Pressable onPress={() => { hapticLight(); onSync() }} style={[styles.syncBadge, { backgroundColor: c.warningSurface }]}>  
              <IconOffline size={14} color={c.warning} />
              <Text style={[styles.syncBadgeText, { color: c.warning }]}>{queue.length}</Text>
            </Pressable>
          ) : (
            <View style={[styles.syncBadgeOk, { backgroundColor: c.surfaceAlt }]}>  
              <IconSyncSmall size={14} color={c.success} />
            </View>
          )}
        </View>
      </View>

      {/* Progress card */}
      {total > 0 && (
        <View style={[styles.progressCard, { backgroundColor: allDone ? c.successSurface : c.surface }]}>  
          <View style={styles.progressLeft}>  
            {/* Circular progress */}
            <View style={[styles.progressCircle, { borderColor: allDone ? c.success : c.border }]}>  
              <View style={[styles.progressCircleInner, { borderColor: allDone ? c.success : c.border }]}>  
                {allDone ? (
                  <IconCheck size={24} color={c.success} />
                ) : (
                  <Text style={[styles.progressPctInner, { color: c.ink }]}>{Math.round(progress * 100)}%</Text>
                )}
              </View>
            </View>
          </View>
          <View style={styles.progressRight}>  
            <Text style={[styles.progressTitle, { color: c.ink }]}>Today's progress</Text>
            <Text style={[styles.progressPct, { color: allDone ? c.success : c.primary }]}>
              {total > 0 ? Math.round(progress * 100) : 0}%
            </Text>
            <Text style={[styles.progressMeta, { color: c.muted }]}>{completed} of {total} calls completed</Text>
          </View>
          {allDone && (
            <View style={[styles.doneBadge, { backgroundColor: c.successSurface }]}>  
              <IconCheck size={14} color={c.success} />
              <Text style={[styles.doneBadgeText, { color: c.success }]}>All done!</Text>
            </View>
          )}
        </View>
      )}

      {/* Section heading */}
      {allTimeline.length > 0 && (
        <View style={styles.sectionHeader}>  
          <Text style={[styles.sectionTitle, { color: c.ink }]}>Today's calls</Text>
          {completedVisits.length > 0 && (
            <Text style={[styles.sectionMeta, { color: c.muted }]}>{completedVisits.length} completed</Text>
          )}
        </View>
      )}

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
                    { backgroundColor: c.surface },
                    isCurrent && !ov && { backgroundColor: c.primarySurface },
                    isPast && { opacity: 0.7 },
                    ov && { backgroundColor: c.dangerSurface },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >  
                  {/* Time column */}
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
                    <View style={styles.timelineNameRow}>  
                      <Text style={[styles.timelineName, { color: isPast ? c.muted : ov ? c.danger : c.ink }]} numberOfLines={1}>
                        {tv.visit.label}
                      </Text>
                      <StatusPill status={tv.visit.status} c={c} />
                    </View>
                    {tv.visit.person_name && (
                      <View style={styles.infoRow}>  
                        <Text style={[styles.infoIcon, { color: c.subtle }]}>👤</Text>
                        <Text style={[styles.timelinePerson, { color: isPast ? c.subtle : c.muted }]} numberOfLines={1}>
                          {tv.visit.person_name}
                        </Text>
                      </View>
                    )}
                    {tv.visit.person_address && (
                      <View style={styles.infoRow}>  
                        <Text style={[styles.infoIcon, { color: c.subtle }]}>📍</Text>
                        <Text style={[styles.timelineAddr, { color: c.subtle }]} numberOfLines={1}>
                          {tv.visit.person_address}
                        </Text>
                      </View>
                    )}
                    {ov && <Text style={[styles.overdueTag, { color: c.danger }]}>{overdueLabel(tv.visit)}</Text>}
                    {tv.visit.requires_two_staff && (
                      <View style={[styles.twoPersonBadge, { backgroundColor: c.warningSurface }]}>  
                        <IconTwoPerson size={12} color={c.warning} />
                        <Text style={[styles.twoPersonText, { color: c.warning }]}>2-person</Text>
                      </View>
                    )}
                  </View>

                  {/* Chevron */}
                  <Text style={[styles.chevron, { color: c.subtle }]}>›</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      {/* Missed calls alert */}
      {missedVisits.length > 0 && (
        <View style={[styles.missedCard, { backgroundColor: c.dangerSurface }]}>  
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
              <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: '600', color: c.danger }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Empty state */}
      {visits.length === 0 && !refreshing && (
        <View style={styles.empty}>  
          <View style={[styles.emptyIconWrap, { backgroundColor: c.successSurface }]}>  
            <IconClock size={28} color={c.success} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.ink }]}>You're all set for today!</Text>
          <Text style={[styles.emptyText, { color: c.muted }]}>Enjoy your evening.</Text>
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
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.xl },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  dateText: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },
  userName: { fontFamily: FONT, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  subtitle: { fontFamily: FONT, fontSize: 14, fontWeight: '400', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.full,
  },
  syncBadgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  syncBadgeOk: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Progress card */
  progressCard: {
    borderRadius: radii.xl,
    padding: spacing.lg, marginBottom: spacing.xl,
    flexDirection: 'row', alignItems: 'center',
    ...elevation.sm,
  },
  progressLeft: { marginRight: spacing.lg },
  progressCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 6, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  progressCircleInner: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 0, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  progressPctInner: { fontFamily: FONT, fontSize: 18, fontWeight: '800' },
  progressRight: { flex: 1 },
  progressTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  progressPct: { fontFamily: FONT, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  progressMeta: { fontFamily: FONT, fontSize: 13, fontWeight: '400', marginTop: 2 },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  doneBadgeText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },

  /* Section */
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontFamily: FONT, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sectionMeta: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },

  /* Timeline */
  timeline: { paddingTop: spacing.xs },

  timelineRow: { flexDirection: 'row', marginBottom: 0 },

  timelineLeft: {
    width: 28, alignItems: 'center',
  },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  dotCurrent: {
    backgroundColor: 'transparent', borderWidth: 3,
  },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: {
    width: 2, flex: 1, minHeight: 16,
  },

  timelineCard: {
    flex: 1, borderRadius: radii.lg,
    padding: spacing.base,
    marginBottom: spacing.md, marginLeft: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: 80,
    ...elevation.sm,
  },

  timeBadge: {
    alignItems: 'center', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderRadius: radii.md,
    minWidth: 56,
  },
  timeBadgeText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  timeDash: { width: 16, height: 1.5, borderRadius: 1, marginVertical: 4 },

  timelineContent: { flex: 1 },
  timelineNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  timelineName: { fontFamily: FONT, fontSize: 15, fontWeight: '700', letterSpacing: -0.2, flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoIcon: { fontSize: 12 },
  timelinePerson: { fontFamily: FONT, fontSize: 13, fontWeight: '400' },
  timelineAddr: { fontFamily: FONT, fontSize: 11, fontWeight: '400' },
  overdueTag: { fontFamily: FONT, fontSize: 11, fontWeight: '700', marginTop: 4 },
  twoPersonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm, marginTop: 4, alignSelf: 'flex-start' },
  twoPersonText: { fontFamily: FONT, fontSize: 10, fontWeight: '700' },

  chevron: { fontSize: 20, fontWeight: '300', marginLeft: spacing.xs },

  /* Status pill */
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radii.full,
  },
  pillText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },

  /* Refresh indicator */
  refreshWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginBottom: spacing.sm },

  /* Missed calls */
  missedCard: {
    borderRadius: radii.lg,
    padding: spacing.base, marginBottom: spacing.xl,
    ...elevation.sm,
  },
  missedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  missedTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.base,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '400' },
})
