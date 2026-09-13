import { useEffect, useState, useCallback } from 'react'
import { RefreshControl, FlatList, StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { updateTimesheet } from '../services/api'
import { hapticLight } from '../services/haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'

interface Props {
  session: AuthSession
  onBack?: () => void
}

function money(pence: number | null | undefined) {
  return pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
}

function mins(h: number | null | undefined) {
  const m = Number(h || 0)
  const hrs = Math.floor(m / 60)
  const rem = m % 60
  return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: '#FEF3C7', text: '#92400E' },
  approved: { bg: '#DCFCE7', text: '#166534' },
  rejected: { bg: '#FEE2E2', text: '#991B1B' },
  draft: { bg: '#F3F4F6', text: '#6B7280' },
}

function getAvatarColor(name: string) {
  const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function TimesheetsScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'submitted' | 'all'>('submitted')
  const [processing, setProcessing] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const params = filter === 'submitted' ? '?status=submitted' : ''
      const res = await fetch(`${API_BASE}/homecare/timesheets${params}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      const data = res.ok ? await res.json() : []
      setTimesheets(data)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken, filter])

  useEffect(() => { load() }, [load])

  const handleApprove = async (ts: any) => {
    hapticLight()
    Alert.alert('Approve timesheet', `Approve ${mins(ts.work_minutes)} work for ${ts.staff_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        setProcessing(ts.id)
        try {
          await updateTimesheet(session.accessToken, ts.id, { status: 'approved' })
          setTimesheets(prev => prev.map(t => t.id === ts.id ? { ...t, status: 'approved' } : t))
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to approve')
        } finally { setProcessing(null) }
      }}
    ])
  }

  const handleReject = async (ts: any) => {
    hapticLight()
    Alert.alert('Reject timesheet', `Reject ${ts.staff_name}'s timesheet?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        setProcessing(ts.id)
        try {
          await updateTimesheet(session.accessToken, ts.id, { status: 'rejected', rejection_reason: 'Rejected by manager' })
          setTimesheets(prev => prev.map(t => t.id === ts.id ? { ...t, status: 'rejected' } : t))
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to reject')
        } finally { setProcessing(null) }
      } },
    ])
  }

  const filtered = filter === 'submitted'
    ? timesheets.filter(t => t.status === 'submitted')
    : timesheets

  const renderItem = ({ item }: { item: any }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.draft
    const color = getAvatarColor(item.staff_name || '')
    const date = item.scheduled_start ? new Date(item.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

    return (
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.cardHeader}>
          <View style={s.staffInfo}>
            <View style={[s.avatar, { backgroundColor: color }]}>
              <Text style={s.avatarText}>{(item.staff_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[s.staffName, { color: c.ink }]} numberOfLines={1}>{item.staff_name}</Text>
              <Text style={[s.visitMeta, { color: c.muted }]}>{item.label} · {item.person_name}</Text>
              <Text style={[s.visitDate, { color: c.subtle }]}>{date}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>

        {/* Breakdown */}
        <View style={[s.breakdown, { borderTopColor: c.borderLight }]}>
          <View style={s.breakdownItem}>
            <Text style={[s.breakdownLabel, { color: c.muted }]}>Work</Text>
            <Text style={[s.breakdownValue, { color: c.ink }]}>{mins(item.work_minutes)}</Text>
          </View>
          <View style={s.breakdownItem}>
            <Text style={[s.breakdownLabel, { color: c.muted }]}>Travel</Text>
            <Text style={[s.breakdownValue, { color: c.ink }]}>{mins(item.paid_travel_minutes)}</Text>
          </View>
          <View style={s.breakdownItem}>
            <Text style={[s.breakdownLabel, { color: c.muted }]}>Miles</Text>
            <Text style={[s.breakdownValue, { color: c.ink }]}>{Number(item.mileage_miles || 0).toFixed(1)}</Text>
          </View>
          <View style={[s.breakdownItem, { alignItems: 'flex-end' }]}>
            <Text style={[s.breakdownLabel, { color: c.muted }]}>Gross pay</Text>
            <Text style={[s.breakdownPay, { color: c.primary }]}>{money(item.gross_pay_pence)}</Text>
          </View>
        </View>

        {/* Actions */}
        {item.status === 'submitted' && (
          <View style={[s.actions, { borderTopColor: c.borderLight }]}>
            <Pressable
              onPress={() => handleReject(item)}
              disabled={processing === item.id}
              style={[s.rejectBtn, { borderColor: c.danger || '#DC2626' }]}
            >
              {processing === item.id ? (
                <ActivityIndicator size={12} color={c.danger || '#DC2626'} />
              ) : (
                <Text style={[s.rejectText, { color: c.danger || '#DC2626' }]}>Reject</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => handleApprove(item)}
              disabled={processing === item.id}
              style={[s.approveBtn, { backgroundColor: c.success }]}
            >
              {processing === item.id ? (
                <ActivityIndicator size={12} color="#FFFFFF" />
              ) : (
                <Text style={s.approveText}>Approve</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: c.ink }]}>Timesheets</Text>
          <Text style={[s.headerSub, { color: c.muted }]}>{timesheets.filter(t => t.status === 'submitted').length} pending</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[s.filterBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {(['submitted', 'all'] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => { hapticLight(); setFilter(f) }}
            style={[s.filterPill, { backgroundColor: filter === f ? c.primary : c.surfaceAlt }]}
          >
            <Text style={[s.filterText, { color: filter === f ? '#FFFFFF' : c.muted }]}>
              {f === 'submitted' ? 'Pending' : 'All'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="small" color={c.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.base, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="transparent" />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={48} color={c.border} />
              <Text style={[s.emptyTitle, { color: c.ink }]}>No timesheets</Text>
              <Text style={[s.emptySub, { color: c.muted }]}>{filter === 'submitted' ? 'All timesheets have been reviewed' : 'No timesheets in the system'}</Text>
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

  card: { borderRadius: radii.lg, overflow: 'hidden', ...elevation.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.base },
  staffInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', fontFamily: FONT },
  staffName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  visitMeta: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  visitDate: { fontFamily: FONT, fontSize: 11, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' as const },

  breakdown: { flexDirection: 'row', paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderTopWidth: 1 },
  breakdownItem: { flex: 1 },
  breakdownLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '500', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  breakdownValue: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginTop: 2 },
  breakdownPay: { fontFamily: 'System', fontSize: 15, fontWeight: '700', marginTop: 2 },

  actions: { flexDirection: 'row', paddingHorizontal: spacing.base, paddingVertical: spacing.sm, borderTopWidth: 1, gap: spacing.sm, justifyContent: 'flex-end' },
  rejectBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  rejectText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  approveBtn: { borderRadius: radii.sm, paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  approveText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', fontFamily: FONT },
  emptySub: { fontSize: 14, fontFamily: FONT, textAlign: 'center' },
})
