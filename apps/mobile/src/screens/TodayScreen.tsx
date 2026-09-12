import { useCallback, useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { HomecareVisit, MobileUser, OfflineVisitAction, SyncState } from '../types'
import { SyncRail } from '../components/SyncRail'
import { VisitRow } from '../components/VisitRow'
import { hapticMedium, hapticLight } from '../services/haptics'

function dayRange() {
  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setDate(to.getDate() + 1)
  to.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

export { dayRange }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function queueStateLabel(state: string) {
  switch (state) {
    case 'synced': return { label: 'Synced', color: colors.success, bg: colors.successSurface, icon: '✓' }
    case 'pending': return { label: 'Pending', color: colors.warning, bg: colors.warningSurface, icon: '⏳' }
    case 'syncing': return { label: 'Syncing', color: colors.primary, bg: colors.primarySurface, icon: '↻' }
    case 'failed': return { label: 'Failed', color: colors.danger, bg: colors.dangerSurface, icon: '!' }
    default: return { label: state, color: colors.muted, bg: colors.surfaceAlt, icon: '—' }
  }
}

export function TodayScreen({ user, visits, queue, onVisit, onRefresh, refreshing, onSync }: {
  user: MobileUser
  visits: HomecareVisit[]
  queue: OfflineVisitAction[]
  onVisit: (visit: HomecareVisit) => void
  onRefresh: () => void
  refreshing: boolean
  onSync: () => void
}) {
  const firstName = user.first_name || user.email.split('@')[0]
  const completed = visits.filter(v => v.status === 'completed').length
  const activeVisit = visits.find(v => ['en_route', 'checked_in'].includes(v.status)) || visits.find(v => v.status === 'scheduled')
  const syncState: SyncState = queue.some(item => item.state === 'failed')
    ? 'failed'
    : queue.some(item => item.state === 'syncing')
      ? 'syncing'
      : queue.length
        ? 'pending'
        : 'synced'

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [],
  )

  const handleRefresh = useCallback(() => {
    hapticMedium()
    onRefresh()
  }, [onRefresh])

  const pendingQueue = queue.filter(item => item.state !== 'synced')

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.date}>{dateLabel}</Text>
          <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
        </View>

        {/* Stats row */}
        {visits.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{visits.length}</Text>
              <Text style={styles.statLabel}>Calls</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
              <Text style={[styles.statValue, { color: colors.success }]}>{completed}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{visits.length - completed}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>
        )}

        {/* Sync status */}
        <SyncRail state={syncState} count={queue.length} onPress={onSync} />

        {/* Offline queue panel */}
        {pendingQueue.length > 0 && (
          <View style={styles.queueCard}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>📋 Offline queue</Text>
              <Pressable onPress={() => { hapticLight(); onSync() }} style={styles.retryBtn}>
                <Text style={styles.retryText}>↻ Sync now</Text>
              </Pressable>
            </View>
            {pendingQueue.slice(0, 5).map(item => {
              const sc = queueStateLabel(item.state)
              const visitLabel = visits.find(v => v.id === item.visitId)?.label || 'Visit'
              return (
                <View key={item.id} style={styles.queueItem}>
                  <View style={[styles.queueDot, { backgroundColor: sc.color }]} />
                  <View style={styles.queueInfo}>
                    <Text style={styles.queueItemLabel}>{item.action === 'check-in' ? 'Check-in' : 'Check-out'} · {visitLabel}</Text>
                    <Text style={styles.queueItemTime}>{new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={[styles.queueStatusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.queueStatusText, { color: sc.color }]}>{sc.icon} {sc.label}</Text>
                  </View>
                </View>
              )
            })}
            {pendingQueue.length > 5 && (
              <Text style={styles.queueMore}>+{pendingQueue.length - 5} more</Text>
            )}
          </View>
        )}

        {/* Active visit */}
        {activeVisit && (
          <View style={styles.activeBlock}>
            <Text style={styles.sectionHead}>NOW</Text>
            <VisitRow visit={activeVisit} onPress={() => { hapticLight(); onVisit(activeVisit) }} active />
          </View>
        )}

        {/* Route */}
        {visits.length > 0 ? (
          <View style={styles.routeBlock}>
            <Text style={styles.sectionHead}>TODAY'S CALLS</Text>
            {visits.map(visit => (
              <VisitRow
                key={visit.id}
                visit={visit}
                onPress={() => { hapticLight(); onVisit(visit) }}
                active={visit.id === activeVisit?.id}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No calls assigned today</Text>
            <Text style={styles.emptyCopy}>Your coordinator will add calls here when your route is ready.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.base,
  },
  header: {
    paddingTop: spacing.sm,
  },
  date: {
    ...type.small,
    marginBottom: spacing.xs,
  },
  greeting: {
    fontFamily: 'System',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.ink,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...elevation.sm,
  },
  statValue: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...type.small,
    marginTop: 2,
  },

  /* Queue panel */
  queueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...elevation.sm,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  queueTitle: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  retryText: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600',
    color: colors.inverse,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  queueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  queueInfo: {
    flex: 1,
  },
  queueItemLabel: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  queueItemTime: {
    ...type.small,
    marginTop: 1,
  },
  queueStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  queueStatusText: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '600',
  },
  queueMore: {
    ...type.small,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  /* Sections */
  activeBlock: {
    marginTop: spacing.sm,
  },
  routeBlock: {
    marginTop: spacing.sm,
  },
  sectionHead: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.subtle,
    marginBottom: spacing.sm,
  },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...type.bodyBold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyCopy: {
    ...type.small,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
})
