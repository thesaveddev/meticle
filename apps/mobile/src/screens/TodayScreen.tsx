import { useMemo } from 'react'
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { HomecareVisit, MobileUser, OfflineVisitAction, SyncState } from '../types'
import { SyncRail } from '../components/SyncRail'
import { VisitRow } from '../components/VisitRow'

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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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

        {/* Active visit */}
        {activeVisit && (
          <View style={styles.activeBlock}>
            <Text style={styles.sectionHead}>NOW</Text>
            <VisitRow visit={activeVisit} onPress={() => onVisit(activeVisit)} active />
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
                onPress={() => onVisit(visit)}
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
