import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import type { HomecareVisit, MobileUser, OfflineVisitAction } from '../types'
import { IconCheck, IconClock, IconAlert, IconSyncSmall, IconOffline, IconSync } from '../components/Icons'
import { hapticLight, hapticMedium } from '../services/haptics'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type VisitStatus = 'completed' | 'checked_in' | 'missed' | 'en_route' | 'scheduled' | 'cancelled'

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

function StatusDot({ status, c }: { status: VisitStatus; c: any }) {
  const color = status === 'completed' ? c.success
    : status === 'checked_in' ? c.primary
    : status === 'missed' ? c.danger
    : status === 'en_route' ? c.warning
    : c.subtle

  return <View style={[styles.statusDot, { backgroundColor: color }]} />
}

function StatusIcon({ status, c }: { status: VisitStatus; c: any }) {
  switch (status) {
    case 'completed': return <IconCheck size={14} color={c.success} />
    case 'checked_in': return <IconClock size={14} color={c.primary} />
    case 'missed': return <IconAlert size={14} color={c.danger} />
    default: return <View style={[styles.futureDot, { borderColor: c.subtle }]} />
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
      spin.stopAnimation()
      spin.setValue(0)
      pulse.stopAnimation()
      pulse.setValue(1)
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
  const remaining = visits.filter(v => !['completed', 'missed', 'cancelled'].includes(v.status)).length

  const currentVisit = timeline.find(t => t.kind === 'current')
  const nextVisit = timeline.find(t => t.kind === 'next')
  const pastVisits = timeline.filter(t => t.kind === 'past')
  const futureVisits = timeline.filter(t => t.kind === 'future')

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: c.bg }]}
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
      {/* Refresh indicator at top */}
      <CustomRefreshIndicator refreshing={refreshing} c={c} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: c.muted }]}>{greeting()},</Text>
          <Text style={[styles.userName, { color: c.ink }]}>{user.first_name || user.email.split('@')[0]}</Text>
        </View>
        {/* Sync + Queue indicator */}
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

      {/* Single stats card */}
      <View style={[styles.statsCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{visits.length}</Text>
          <Text style={styles.statLabel}>Calls</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: c.success }]}>{completed}</Text>
          <Text style={[styles.statLabel, { color: c.muted }]}>Done</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: remaining > 0 ? c.ink : c.subtle }]}>{remaining}</Text>
          <Text style={[styles.statLabel, { color: c.muted }]}>Left</Text>
        </View>
        {total > 0 && (
          <>
            <View style={[styles.statDivider, { backgroundColor: c.border }]} />
            <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: c.primary }]}>{Math.round((completed / total) * 100)}%</Text>
          <Text style={[styles.statLabel, { color: c.muted }]}>Done</Text>
            </View>
          </>
        )}
      </View>

      {/* Current call highlight */}
      {currentVisit && (
        <View style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <View style={[styles.currentDot, { backgroundColor: c.primary }]} />
            <Text style={[styles.currentLabel, { color: c.primary }]}>NOW</Text>
          </View>
          <Pressable
            onPress={() => { hapticLight(); onVisit(currentVisit.visit) }}
            style={({ pressed }) => [styles.visitCard, styles.visitCardActive, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.visitTime}>
              <Text style={styles.visitTimeText}>{time(currentVisit.visit.scheduled_start)}</Text>
              <Text style={styles.visitTimeEnd}>{time(currentVisit.visit.scheduled_end)}</Text>
            </View>
            <View style={styles.visitContent}>
              <Text style={styles.visitName} numberOfLines={1}>{currentVisit.visit.label}</Text>
              {currentVisit.visit.person_name && (
                <Text style={styles.visitPerson} numberOfLines={1}>{currentVisit.visit.person_name}</Text>
              )}
            </View>
            <StatusIcon status={currentVisit.visit.status} c={c} />
          </Pressable>
        </View>
      )}

      {/* Next call */}
      {nextVisit && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NEXT CALL</Text>
          <Pressable
            onPress={() => { hapticLight(); onVisit(nextVisit.visit) }}
            style={({ pressed }) => [styles.visitCard, pressed && { opacity: 0.85 }]}
          >              <View style={styles.visitTime}>
                <Text style={[styles.visitTimeText, { color: c.ink }]}>{time(nextVisit.visit.scheduled_start)}</Text>
                <Text style={[styles.visitTimeEnd, { color: c.muted }]}>{time(nextVisit.visit.scheduled_end)}</Text>
              </View>
              <View style={styles.visitContent}>
                <Text style={[styles.visitName, { color: c.ink }]} numberOfLines={1}>{nextVisit.visit.label}</Text>
                {nextVisit.visit.person_name && (
                  <Text style={[styles.visitPerson, { color: c.muted }]} numberOfLines={1}>{nextVisit.visit.person_name}</Text>
              )}
            </View>
            <View style={[styles.nextArrow, { backgroundColor: c.primarySurface }]}>
              <Text style={[styles.nextArrowText, { color: c.primary }]}>→</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Completed calls */}
      {pastVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.subtle }]}>COMPLETED</Text>
          {pastVisits.map(tv => (
            <Pressable
              key={tv.visit.id}
              onPress={() => { hapticLight(); onVisit(tv.visit) }}
              style={({ pressed }) => [styles.visitCard, styles.visitCardPast, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.visitTime}>
                <Text style={[styles.visitTimeText, { color: c.subtle }]}>{time(tv.visit.scheduled_start)}</Text>
                <Text style={[styles.visitTimeEnd, { color: c.subtle }]}>{time(tv.visit.scheduled_end)}</Text>
              </View>
              <View style={styles.visitContent}>
                <Text style={[styles.visitName, { color: c.muted }]} numberOfLines={1}>{tv.visit.label}</Text>
                {tv.visit.person_name && (
                  <Text style={[styles.visitPerson, { color: c.subtle }]} numberOfLines={1}>{tv.visit.person_name}</Text>
                )}
              </View>
              <StatusIcon status={tv.visit.status} c={c} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Future calls */}
      {futureVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.subtle }]}>UPCOMING</Text>
          {futureVisits.map(tv => (
            <Pressable
              key={tv.visit.id}
              onPress={() => { hapticLight(); onVisit(tv.visit) }}
              style={({ pressed }) => [styles.visitCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.visitTime}>
                <Text style={[styles.visitTimeText, { color: c.ink }]}>{time(tv.visit.scheduled_start)}</Text>
                <Text style={[styles.visitTimeEnd, { color: c.muted }]}>{time(tv.visit.scheduled_end)}</Text>
              </View>
              <View style={styles.visitContent}>
                <Text style={[styles.visitName, { color: c.ink }]} numberOfLines={1}>{tv.visit.label}</Text>
                {tv.visit.person_name && (
                  <Text style={[styles.visitPerson, { color: c.muted }]} numberOfLines={1}>{tv.visit.person_name}</Text>
                )}
              </View>
              <StatusDot status={tv.visit.status} c={c} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Empty state */}
      {visits.length === 0 && !refreshing && (
        <View style={styles.empty}>
          <View style={[styles.emptyIconWrap, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <IconClock size={32} color={c.subtle} />
          </View>            <Text style={[styles.emptyTitle, { color: c.ink }]}>No calls today</Text>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: { fontFamily: FONT, fontSize: 15, fontWeight: '400', color: colors.muted },
  userName: { fontFamily: FONT, fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.6, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.warningSurface, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.full, borderWidth: 1, borderColor: colors.warning + '30',
  },
  syncBadgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: colors.warning },
  syncBadgeOk: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.success + '30',
  },

  /* Stats */
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, marginBottom: spacing.xl,
    ...elevation.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  statNumber: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  statLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  /* Current call highlight */
  currentCard: { marginBottom: spacing.xl },
  currentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  currentLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 1 },

  /* Visit card */
  visitCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, gap: spacing.md,
    ...elevation.sm,
  },
  visitCardActive: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primarySurface,
  },
  visitCardPast: { opacity: 0.7 },
  visitTime: { alignItems: 'center', minWidth: 48 },
  visitTimeText: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: colors.ink },
  visitTimeEnd: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 1 },
  visitTimePast: { color: colors.subtle },
  visitContent: { flex: 1 },
  visitName: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink },
  visitNamePast: { color: colors.muted },
  visitPerson: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: 2 },
  visitPersonPast: { color: colors.subtle },
  nextArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  nextArrowText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.primary },

  /* Status */
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  futureDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.subtle },

  /* Sections */
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1,
    color: colors.subtle, textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  /* Refresh indicator */
  refreshWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  refreshText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', color: colors.subtle, marginTop: spacing.xs },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base,
    ...elevation.sm,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
  emptyText: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: colors.muted },
})
