import { useCallback, useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { HomecareVisit, MobileUser, OfflineVisitAction, SyncState } from '../types'
import { hapticMedium, hapticLight } from '../services/haptics'

function dayRange() {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

export { dayRange }

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function SyncDot({ state }: { state: SyncState }) {
  const bg = state === 'synced' ? colors.success : state === 'failed' ? colors.danger : colors.warning
  return (
    <View style={[syncStyles.dot, { backgroundColor: bg }]}>
      {state === 'syncing' && <View style={syncStyles.spinnerRing} />}
    </View>
  )
}

const syncStyles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
  spinnerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.primary, borderTopColor: 'transparent', position: 'absolute', top: -3, left: -3 },
})

/* ─── Timeline node ─────────────────────────────────────────── */
function TimelineNode({ visit, position, isNext, onPress }: {
  visit: HomecareVisit
  position: 'past' | 'next' | 'future'
  isNext: boolean
  onPress: () => void
}) {
  const isCompleted = visit.status === 'completed'
  const isActive = visit.status === 'checked_in' || visit.status === 'en_route'
  const isMissed = visit.status === 'missed'

  const nodeColor = isCompleted ? colors.success : isActive ? colors.primary : isMissed ? colors.danger : colors.border
  const textColor = position === 'past' ? colors.muted : colors.ink
  const timeColor = position === 'past' ? colors.subtle : isNext ? colors.primary : colors.muted

  return (
    <Pressable onPress={() => { hapticLight(); onPress() }} style={({ pressed }) => [nodeStyles.row, pressed && { opacity: 0.7 }]}>
      {/* Time column */}
      <View style={nodeStyles.timeCol}>
        <Text style={[nodeStyles.time, { color: timeColor }]}>{time(visit.scheduled_start)}</Text>
        <Text style={[nodeStyles.timeEnd, { color: colors.subtle }]}>{time(visit.scheduled_end)}</Text>
      </View>

      {/* Timeline line + dot */}
      <View style={nodeStyles.lineCol}>
        <View style={[nodeStyles.dot, { backgroundColor: nodeColor, borderColor: nodeColor, ...(isNext ? { width: 14, height: 14, borderRadius: 7 } : {}) }]}>
          {isCompleted && <Text style={nodeStyles.dotCheck}>✓</Text>}
          {isActive && <View style={nodeStyles.dotActiveInner} />}
          {isMissed && <Text style={nodeStyles.dotMiss}>✕</Text>}
        </View>
        <View style={[nodeStyles.line, { backgroundColor: position === 'past' ? colors.borderLight : colors.border }]} />
      </View>

      {/* Content */}
      <View style={[nodeStyles.content, isNext && nodeStyles.contentNext]}>
        <View style={nodeStyles.contentHeader}>
          <Text style={[nodeStyles.label, { color: textColor }]} numberOfLines={1}>{visit.label}</Text>
          {isNext && <View style={nodeStyles.nextBadge}><Text style={nextBadgeStyles.text}>Next</Text></View>}
        </View>
        {visit.person_name && <Text style={[nodeStyles.person, { color: position === 'past' ? colors.subtle : colors.muted }]} numberOfLines={1}>{visit.person_name}</Text>}
        {visit.person_address && position !== 'past' && <Text style={nodeStyles.addr} numberOfLines={1}>{visit.person_address}</Text>}
      </View>
    </Pressable>
  )
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
  const syncState: SyncState = queue.some(i => i.state === 'failed') ? 'failed' : queue.some(i => i.state === 'syncing') ? 'syncing' : queue.length ? 'pending' : 'synced'

  // Find the next scheduled visit (first non-completed, non-missed)
  const nextVisit = visits.find(v => !['completed', 'missed', 'cancelled'].includes(v.status))
  const pastVisits = visits.filter(v => v.status === 'completed' || v.status === 'missed')
  const futureVisits = visits.filter(v => v !== nextVisit && !['completed', 'missed', 'cancelled'].includes(v.status))

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [],
  )

  const handleRefresh = useCallback(() => { hapticMedium(); onRefresh() }, [onRefresh])

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{dateLabel}</Text>
              <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
            </View>
            <Pressable onPress={onSync} style={styles.syncBtn}>
              <SyncDot state={syncState} />
              {syncState !== 'synced' && <Text style={styles.syncCount}>{queue.filter(i => i.state !== 'synced').length}</Text>}
            </Pressable>
          </View>
        </View>

        {/* Stats — single line, no cards */}
        {visits.length > 0 && (
          <View style={styles.statLine}>
            <Text style={styles.statText}>{completed} of {visits.length} calls done</Text>
            {visits.length - completed > 0 && <Text style={styles.statRemain}>{visits.length - completed} remaining</Text>}
          </View>
        )}

        {/* Timeline */}
        {visits.length > 0 ? (
          <View style={styles.timeline}>
            {/* Past calls */}
            {pastVisits.map(v => (
              <TimelineNode key={v.id} visit={v} position="past" isNext={false} onPress={() => onVisit(v)} />
            ))}

            {/* Now marker */}
            {nextVisit && pastVisits.length > 0 && (
              <View style={styles.nowMarker}>
                <View style={styles.nowLine} />
                <View style={styles.nowDot}>
                  <View style={styles.nowDotInner} />
                </View>
                <View style={styles.nowLine} />
              </View>
            )}

            {/* Next call — the focal point */}
            {nextVisit && (
              <TimelineNode visit={nextVisit} position="next" isNext={true} onPress={() => onVisit(nextVisit)} />
            )}

            {/* Remaining future calls */}
            {futureVisits.map(v => (
              <TimelineNode key={v.id} visit={v} position="future" isNext={false} onPress={() => onVisit(v)} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No calls today</Text>
            <Text style={styles.emptyCopy}>Your coordinator will add calls when your route is ready.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  header: { paddingTop: spacing.sm, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  date: { ...type.small, marginBottom: spacing.xs, color: colors.muted },
  greeting: { fontFamily: 'System', fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3, color: colors.ink },

  /* Sync button */
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm },
  syncCount: { fontFamily: 'System', fontSize: 10, fontWeight: '700', color: colors.muted },

  /* Stats — single line */
  statLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.base },
  statText: { fontFamily: 'System', fontSize: 13, fontWeight: '500', color: colors.muted },
  statRemain: { fontFamily: 'System', fontSize: 13, fontWeight: '500', color: colors.subtle },

  /* Timeline */
  timeline: { paddingTop: spacing.sm },

  /* Now marker */
  nowMarker: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  nowLine: { flex: 1, height: 1, backgroundColor: colors.primary + '30' },
  nowDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.sm },
  nowDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  /* Empty */
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, marginTop: spacing.xxl },
  emptyTitle: { ...type.bodyBold, color: colors.ink, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.xl },
})

/* ─── Node styles ───────────────────────────────────────────── */

const nodeStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: spacing.md },
  timeCol: { width: 52, alignItems: 'flex-end', paddingTop: 2 },
  time: { fontFamily: 'System', fontSize: 13, fontWeight: '600' },
  timeEnd: { fontFamily: 'System', fontSize: 11, marginTop: 1 },
  lineCol: { width: 20, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, zIndex: 1 },
  dotActiveInner: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inverse },
  dotCheck: { fontSize: 7, fontWeight: '800', color: colors.inverse, lineHeight: 9, textAlign: 'center' },
  dotMiss: { fontSize: 7, fontWeight: '800', color: colors.inverse, lineHeight: 9, textAlign: 'center' },
  line: { flex: 1, width: 1.5, minHeight: 20, marginTop: 4 },
  content: { flex: 1, paddingLeft: spacing.sm, minWidth: 0 },
  contentNext: { backgroundColor: colors.primarySurface, borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.xs, borderWidth: 1, borderColor: colors.primary + '15' },
  contentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: 'System', fontSize: 15, fontWeight: '600', flex: 1 },
  nextBadge: { backgroundColor: colors.primary, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  person: { fontFamily: 'System', fontSize: 13, marginTop: 2 },
  addr: { fontFamily: 'System', fontSize: 12, color: colors.subtle, marginTop: 2 },
})

const nextBadgeStyles = StyleSheet.create({
  text: { fontFamily: 'System', fontSize: 10, fontWeight: '700', color: colors.inverse, letterSpacing: 0.3 },
})
