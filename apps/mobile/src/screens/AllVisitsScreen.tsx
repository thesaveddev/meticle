import { useEffect, useState, useCallback } from 'react'
import { RefreshControl, FlatList, StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { getAllVisits } from '../services/api'
import { IconClock, IconWarning, IconCheck, IconIncident } from '../components/Icons'
import { hapticLight } from '../services/haptics'

interface Props {
  session: AuthSession
  onBack?: () => void
  onSelect?: (visitId: string) => void
  initialStatus?: string
  initialStaffName?: string
}

function dateRange(daysBack = 0, daysForward = 7) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack, 0, 0, 0).toISOString()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysForward, 23, 59, 59).toISOString()
  return { from, to }
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'checked_in', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'missed', label: 'Missed' },
]

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: '#FEF3C7', text: '#92400E' },
  en_route: { bg: '#DBEAFE', text: '#1E40AF' },
  checked_in: { bg: '#D1FAE5', text: '#065F46' },
  completed: { bg: '#DCFCE7', text: '#166534' },
  missed: { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280' },
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateStr(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getAvatarColor(name: string) {
  const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function AllVisitsScreen({ session, onBack, onSelect, initialStatus, initialStaffName }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState(initialStatus || 'all')
  const [daysBack, setDaysBack] = useState(0)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const range = dateRange(daysBack, daysBack === 0 ? 7 : 0)
      const data = await getAllVisits(session.accessToken, range.from, range.to)
      setVisits(data)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken, daysBack])

  useEffect(() => { load() }, [load])

  const filtered = visits.filter((v: any) => {
    if (filter !== 'all' && v.status !== filter) return false
    if (initialStaffName && v.assigned_staff_name !== initialStaffName) return false
    return true
  })

  // Group by date
  const grouped: Record<string, any[]> = {}
  for (const v of filtered) {
    const key = dateStr(v.scheduled_start)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  }
  const sections = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Today') return -1
    if (b === 'Today') return 1
    if (a === 'Tomorrow') return -1
    if (b === 'Tomorrow') return 1
    return 0
  })

  const completed = visits.filter((v: any) => v.status === 'completed').length
  const missed = visits.filter((v: any) => v.status === 'missed').length

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: c.ink }]}>All Visits</Text>
          <Text style={[s.headerSub, { color: c.muted }]}>{visits.length} total · {completed} done · {missed} missed</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Filter tabs */}
      <View style={[s.filterBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {STATUS_FILTERS.map(f => (
          <Pressable
            key={f.key}
            onPress={() => { hapticLight(); setFilter(f.key) }}
            style={[s.filterPill, { backgroundColor: filter === f.key ? c.primary : c.surfaceAlt }]}
          >
            <Text style={[s.filterText, { color: filter === f.key ? '#FFFFFF' : c.muted }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={c.primary} /></View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([date]) => date}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="transparent" />}
          ListHeaderComponent={
            initialStaffName ? (
              <View style={[s.staffBanner, { backgroundColor: c.primarySurface }]}>
                <Text style={[s.staffBannerText, { color: c.primary }]}>Showing visits for {initialStaffName}</Text>
                <Pressable onPress={() => { /* clear filter */ setFilter('all') }}>
                  <Ionicons name="close-circle" size={18} color={c.primary} />
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item: [date, items] }) => (
            <View>
              <Text style={[s.dateHeader, { color: c.subtle }]}>{date}</Text>
              {items.map((v: any) => {
                const sc = STATUS_STYLE[v.status] || STATUS_STYLE.scheduled
                const hasOverdue = v.status === 'scheduled' && new Date(v.scheduled_end) < new Date()
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => { hapticLight(); onSelect?.(v.id) }}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.base, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.borderLight, borderLeftWidth: hasOverdue ? 3 : 0, borderLeftColor: hasOverdue ? (c.danger || '#DC2626') : 'transparent' }, pressed && { backgroundColor: c.surfaceAlt }]}
                  >
                    {/* Time */}
                    <View style={s.timeCol}>
                      <Text style={[s.timeStart, { color: hasOverdue ? (c.danger || '#DC2626') : c.ink }]}>{timeStr(v.scheduled_start)}</Text>
                      <Text style={[s.timeEnd, { color: c.muted }]}>{timeStr(v.scheduled_end)}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.visitName, { color: c.ink }]} numberOfLines={1}>{v.person_name || 'Client'}</Text>
                      <Text style={[s.visitMeta, { color: c.muted }]} numberOfLines={1}>{v.label}</Text>
                      {v.assigned_staff_name && (
                        <View style={s.staffRow}>
                          <View style={[s.staffDot, { backgroundColor: getAvatarColor(v.assigned_staff_name) }]} />
                          <Text style={[s.staffName, { color: c.muted }]} numberOfLines={1}>{v.assigned_staff_name}</Text>
                        </View>
                      )}
                    </View>

                    {/* Status */}
                    <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                      {hasOverdue ? <IconWarning size={10} color={sc.text} /> : null}
                      <Text style={[s.statusText, { color: sc.text }]}>{v.status === 'checked_in' ? 'Active' : v.status?.replace('_', ' ')}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="calendar-outline" size={48} color={c.border} />
              <Text style={[s.emptyTitle, { color: c.ink }]}>No visits found</Text>
              <Text style={[s.emptySub, { color: c.muted }]}>{filter !== 'all' ? 'Try a different filter' : 'No visits in this period'}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...type.title, fontSize: 17 },
  headerSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },

  filterBar: { flexDirection: 'row', paddingHorizontal: spacing.base, paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: 1 },
  filterPill: { borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  filterText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  staffBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  staffBannerText: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },

  dateHeader: {
    fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase' as const, paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },

  timeCol: { width: 52, alignItems: 'center' },
  timeStart: { fontFamily: 'System', fontSize: 14, fontWeight: '700' },
  timeEnd: { fontFamily: FONT, fontSize: 11 },
  visitName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  visitMeta: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  staffDot: { width: 6, height: 6, borderRadius: 3 },
  staffName: { fontFamily: FONT, fontSize: 11 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' as const },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT },
})
