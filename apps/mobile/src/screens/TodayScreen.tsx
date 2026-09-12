import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type, FONT } from '../theme'
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

function StatusDot({ status }: { status: VisitStatus }) {
  const color = status === 'completed' ? colors.success
    : status === 'checked_in' ? colors.primary
    : status === 'missed' ? colors.danger
    : status === 'en_route' ? colors.warning
    : colors.subtle

  return <View style={[styles.statusDot, { backgroundColor: color }]} />
}

function StatusIcon({ status }: { status: VisitStatus }) {
  switch (status) {
    case 'completed': return <IconCheck size={14} color={colors.success} />
    case 'checked_in': return <IconClock size={14} color={colors.primary} />
    case 'missed': return <IconAlert size={14} color={colors.danger} />
    default: return <View style={styles.futureDot} />
  }
}

/* ─── Custom refresh indicator ──────────────────────────────── */
function CustomRefreshIndicator({ refreshing }: { refreshing: boolean }) {
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
        <IconSync size={20} color={colors.primary} />
      </Animated.View>
      <Text style={styles.refreshText}>{refreshing ? 'Refreshing...' : 'Pull to refresh'}</Text>
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
  const timeline = useMemo(() => classifyVisits(visits), [visits])
  const completed = visits.filter(v => v.status === 'completed').length
  const remaining = visits.filter(v => !['completed', 'missed', 'cancelled'].includes(v.status)).length

  const currentVisit = timeline.find(t => t.kind === 'current')
  const nextVisit = timeline.find(t => t.kind === 'next')
  const pastVisits = timeline.filter(t => t.kind === 'past')
  const futureVisits = timeline.filter(t => t.kind === 'future')

  return (
    <ScrollView
      style={styles.screen}
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{user.first_name || user.email.split('@')[0]}</Text>
        </View>
        {/* Sync + Queue indicator */}
        <View style={styles.headerActions}>
          {queue.length > 0 ? (
            <Pressable onPress={() => { hapticLight(); onSync() }} style={styles.syncBadge}>
              <IconOffline size={14} color={colors.warning} />
              <Text style={styles.syncBadgeText}>{queue.length}</Text>
            </Pressable>
          ) : (
            <View style={styles.syncBadgeOk}>
              <IconSyncSmall size={14} color={colors.success} />
            </View>
          )}
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
          <Text style={styles.statNumber}>{visits.length}</Text>
          <Text style={styles.statLabel}>Calls</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
          <Text style={styles.statNumber}>{completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
          <Text style={styles.statNumber}>{remaining}</Text>
          <Text style={styles.statLabel}>Left</Text>
        </View>
      </View>

      {/* Current call highlight */}
      {currentVisit && (
        <View style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <View style={styles.currentDot} />
            <Text style={styles.currentLabel}>NOW</Text>
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
            <StatusIcon status={currentVisit.visit.status} />
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
          >
            <View style={styles.visitTime}>
              <Text style={styles.visitTimeText}>{time(nextVisit.visit.scheduled_start)}</Text>
              <Text style={styles.visitTimeEnd}>{time(nextVisit.visit.scheduled_end)}</Text>
            </View>
            <View style={styles.visitContent}>
              <Text style={styles.visitName} numberOfLines={1}>{nextVisit.visit.label}</Text>
              {nextVisit.visit.person_name && (
                <Text style={styles.visitPerson} numberOfLines={1}>{nextVisit.visit.person_name}</Text>
              )}
            </View>
            <View style={styles.nextArrow}>
              <Text style={styles.nextArrowText}>→</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Completed calls */}
      {pastVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMPLETED</Text>
          {pastVisits.map(tv => (
            <Pressable
              key={tv.visit.id}
              onPress={() => { hapticLight(); onVisit(tv.visit) }}
              style={({ pressed }) => [styles.visitCard, styles.visitCardPast, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.visitTime}>
                <Text style={[styles.visitTimeText, styles.visitTimePast]}>{time(tv.visit.scheduled_start)}</Text>
                <Text style={[styles.visitTimeEnd, styles.visitTimePast]}>{time(tv.visit.scheduled_end)}</Text>
              </View>
              <View style={styles.visitContent}>
                <Text style={[styles.visitName, styles.visitNamePast]} numberOfLines={1}>{tv.visit.label}</Text>
                {tv.visit.person_name && (
                  <Text style={[styles.visitPerson, styles.visitPersonPast]} numberOfLines={1}>{tv.visit.person_name}</Text>
                )}
              </View>
              <StatusIcon status={tv.visit.status} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Future calls */}
      {futureVisits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UPCOMING</Text>
          {futureVisits.map(tv => (
            <Pressable
              key={tv.visit.id}
              onPress={() => { hapticLight(); onVisit(tv.visit) }}
              style={({ pressed }) => [styles.visitCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.visitTime}>
                <Text style={styles.visitTimeText}>{time(tv.visit.scheduled_start)}</Text>
                <Text style={styles.visitTimeEnd}>{time(tv.visit.scheduled_end)}</Text>
              </View>
              <View style={styles.visitContent}>
                <Text style={styles.visitName} numberOfLines={1}>{tv.visit.label}</Text>
                {tv.visit.person_name && (
                  <Text style={styles.visitPerson} numberOfLines={1}>{tv.visit.person_name}</Text>
                )}
              </View>
              <StatusDot status={tv.visit.status} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Refresh indicator */}
      <CustomRefreshIndicator refreshing={refreshing} />

      {/* Empty state */}
      {visits.length === 0 && !refreshing && (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <IconClock size={32} color={colors.subtle} />
          </View>
          <Text style={styles.emptyTitle}>No calls today</Text>
          <Text style={styles.emptyText}>Pull down to refresh your schedule.</Text>
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
  statsBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.md,
    borderLeftWidth: 3, padding: spacing.md, ...elevation.sm,
  },
  statNumber: { fontFamily: FONT, fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

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
