import { useMemo } from 'react'
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, commonStyles, spacing, type } from '../theme'
import type { HomecareVisit, MobileUser, OfflineVisitAction, SyncState } from '../types'
import { SyncRail } from '../components/SyncRail'
import { VisitRow } from '../components/VisitRow'

function dayRange() {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: to.toISOString() }
}

export { dayRange }

export function TodayScreen({ user, visits, queue, onVisit, onRefresh, refreshing, onSync }: { user: MobileUser; visits: HomecareVisit[]; queue: OfflineVisitAction[]; onVisit: (visit: HomecareVisit) => void; onRefresh: () => void; refreshing: boolean; onSync: () => void }) {
  const firstName = user.first_name || user.email.split('@')[0]
  const activeVisit = visits.find(visit => ['en_route', 'checked_in'].includes(visit.status)) || visits.find(visit => visit.status === 'scheduled')
  const syncState: SyncState = queue.some(item => item.state === 'failed') ? 'failed' : queue.some(item => item.state === 'syncing') ? 'syncing' : queue.length ? 'pending' : 'synced'
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), [])

  return (
    <SafeAreaView style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{dateLabel}</Text>
            <Text style={type.display}>Good morning, {firstName}.</Text>
          </View>
          <Text style={styles.count}>{visits.length} visits</Text>
        </View>
        <SyncRail state={syncState} count={queue.length} onPress={onSync} />

        {activeVisit ? <View style={styles.nextBlock}>
          <Text style={styles.sectionLabel}>NEXT VISIT</Text>
          <VisitRow visit={activeVisit} onPress={() => onVisit(activeVisit)} active />
        </View> : <View style={styles.empty}><Text style={styles.emptyTitle}>No visits assigned today</Text><Text style={styles.emptyCopy}>Your coordinator will add visits here when your route is ready.</Text></View>}

        {visits.length > 0 && <View style={styles.routeBlock}>
          <Text style={styles.sectionLabel}>TODAY'S ROUTE</Text>
          {visits.map(visit => <VisitRow key={visit.id} visit={visit} onPress={() => onVisit(visit)} active={visit.id === activeVisit?.id} />)}
        </View>}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { ...commonStyles.content, paddingTop: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.lg },
  date: { ...type.caption, color: colors.mist, marginBottom: spacing.xs },
  count: { ...type.label, color: colors.navy, paddingBottom: 5 },
  nextBlock: { marginTop: spacing.xl },
  routeBlock: { marginTop: spacing.xxl },
  sectionLabel: { ...type.label, color: colors.mist, letterSpacing: 1.1, marginBottom: spacing.sm },
  empty: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline, paddingVertical: spacing.xxl, marginTop: spacing.xxl },
  emptyTitle: { ...type.title, color: colors.ink },
  emptyCopy: { ...type.body, color: colors.mist, marginTop: spacing.xs },
})
