import { useState, useCallback, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput, Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppColors, typography, spacing, radii, elevation } from '../theme'
import { getPendingTimesheets, approveTimesheet, rejectTimesheet } from '../services/api'
import { hapticLight, hapticSuccess, hapticWarning } from '../services/haptics'

/* ── Helpers ── */
const money = (p: number | null | undefined) => p == null ? '—' : `£${(Number(p) / 100).toFixed(2)}`
const fmtHours = (m: number | null | undefined) => {
  const mins = Number(m || 0)
  const h = Math.floor(mins / 60)
  const min = mins % 60
  return h > 0 ? `${h}h ${min}m` : `${min}m`
}
const fmtMiles = (m: number | null | undefined) => m == null ? '—' : `${Number(m).toFixed(1)} mi`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/* ── Props ── */
interface Props {
  session: { accessToken: string }
  onBack: () => void
}

/* ════════════════════════════════════════════════════════════════ */
export function TimesheetsScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  /* Reject modal */
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const range = useMemo(() => getMonthRange(), [])

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getPendingTimesheets(session.accessToken, range.from, range.to)
      setTimesheets(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken, range.from, range.to])

  useEffect(() => { loadData() }, [loadData])

  /* ── Filtered + searched list ── */
  const filtered = useMemo(() => {
    let list = timesheets
    if (filter === 'pending') list = list.filter(t => t.timesheet_status === 'submitted')
    else if (filter === 'approved') list = list.filter(t => t.timesheet_status === 'approved')
    else if (filter === 'rejected') list = list.filter(t => t.timesheet_status === 'rejected')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => (t.staff_name || '').toLowerCase().includes(q) || (t.person_name || '').toLowerCase().includes(q) || (t.visit_label || '').toLowerCase().includes(q))
    }
    return list
  }, [timesheets, filter, search])

  /* ── Summary stats ── */
  const pendingCount = timesheets.filter(t => t.timesheet_status === 'submitted').length
  const totalPay = filtered.reduce((s, t) => s + Number(t.gross_pay_pence || 0), 0)
  const totalWork = filtered.reduce((s, t) => s + Number(t.work_minutes || 0), 0)
  const totalTravel = filtered.reduce((s, t) => s + Number(t.paid_travel_minutes || 0), 0)
  const totalMiles = filtered.reduce((s, t) => s + Number(t.mileage_miles || 0), 0)

  /* ── Approve ── */
  const handleApprove = useCallback(async (ts: any) => {
    hapticWarning()
    setProcessing(ts.timesheet_id || ts.id)
    try {
      await approveTimesheet(session.accessToken, ts.timesheet_id || ts.id)
      hapticSuccess()
      setTimesheets(prev => prev.map(t => (t.timesheet_id || t.id) === (ts.timesheet_id || ts.id) ? { ...t, timesheet_status: 'approved' } : t))
    } catch (e: any) {
      /* silent */ 
    } finally { setProcessing(null) }
  }, [session.accessToken])

  /* ── Reject ── */
  const handleReject = useCallback(async () => {
    if (!rejectModal) return
    hapticWarning()
    setProcessing(rejectModal.id)
    try {
      await rejectTimesheet(session.accessToken, rejectModal.id, rejectReason || undefined)
      hapticSuccess()
      setTimesheets(prev => prev.map(t => (t.timesheet_id || t.id) === rejectModal.id ? { ...t, timesheet_status: 'rejected' } : t))
      setRejectModal(null)
      setRejectReason('')
    } catch (e: any) {
      /* silent */
    } finally { setProcessing(null) }
  }, [session.accessToken, rejectModal, rejectReason])

  /* ── Filter tabs ── */
  const tabs = [
    { key: 'pending' as const, label: 'Pending', count: pendingCount },
    { key: 'all' as const, label: 'All', count: timesheets.length },
    { key: 'approved' as const, label: 'Approved', count: timesheets.filter(t => t.timesheet_status === 'approved').length },
    { key: 'rejected' as const, label: 'Rejected', count: timesheets.filter(t => t.timesheet_status === 'rejected').length },
  ]

  const filterColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#FEF3C7', text: '#92400E' },
    approved: { bg: '#DCFCE7', text: '#166534' },
    rejected: { bg: '#FEE2E2', text: '#991B1B' },
    draft: { bg: '#F3F4F6', text: '#6B7280' },
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Pressable onPress={onBack} style={{ marginRight: spacing.md, padding: spacing.xs }}>
          <Ionicons name="chevron-back" size={24} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.title.fontFamily, fontSize: typography.title.fontSize, fontWeight: '800', color: c.ink }}>Timesheets</Text>
          <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{pendingCount} pending review</Text>
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs }}>
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => { hapticLight(); setFilter(tab.key) }}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: filter === tab.key ? c.primary : c.surface,
              borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
              borderWidth: 1, borderColor: filter === tab.key ? c.primary : c.border,
            }, pressed && { opacity: 0.8 }]}
          >
            <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 13, fontWeight: '600', color: filter === tab.key ? '#FFFFFF' : c.ink }}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={{ backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.3)' : (filterColors[tab.key]?.bg || c.surfaceAlt), borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, fontWeight: '700', color: filter === tab.key ? '#FFFFFF' : (filterColors[tab.key]?.text || c.muted) }}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Search ── */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radii.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.md, height: 40 }}>
          <Ionicons name="search-outline" size={18} color={c.muted} />
          <TextInput
            placeholder="Search by carer or client..."
            placeholderTextColor={c.muted}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, marginLeft: spacing.sm, fontFamily: typography.body.fontFamily, fontSize: 14, color: c.ink, padding: 0 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={12}>
              <Ionicons name="close-circle" size={18} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Summary stats (when filtering) ── */}
      {filter !== 'pending' && filtered.length > 0 && (
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs }}>
          {[
            { label: 'Visits', value: String(filtered.length), color: c.primary },
            { label: 'Work', value: fmtHours(totalWork), color: c.success },
            { label: 'Travel', value: fmtHours(totalTravel), color: '#3B82F6' },
            { label: 'Pay', value: money(totalPay), color: '#8B5CF6' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radii.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 15, fontWeight: '800', color: s.color }}>{s.value}</Text>
              <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 10, color: c.muted }}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true) }} tintColor={c.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl * 2 }}>
              <Ionicons name={filter === 'pending' ? 'checkmark-circle-outline' : 'receipt-outline'} size={48} color={filter === 'pending' ? c.success : c.border} />
              <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 16, fontWeight: '600', color: c.ink, marginTop: spacing.md }}>
                {filter === 'pending' ? 'All caught up' : 'No timesheets found'}
              </Text>
              <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 13, color: c.muted, marginTop: spacing.xs, textAlign: 'center', maxWidth: 240 }}>
                {filter === 'pending' ? 'No timesheets are waiting for your approval' : search ? 'Try a different search term' : 'No timesheets match this filter'}
              </Text>
            </View>
          ) : (
            filtered.map((ts: any) => {
              const tsId = ts.timesheet_id || ts.id
              const sc = filterColors[ts.timesheet_status] || filterColors.pending
              const isProcessing = processing === tsId
              const tasksDone = Number(ts.tasks_completed || 0)
              const tasksTotal = Number(ts.tasks_total || 0)

              return (
                <View key={tsId} style={{ backgroundColor: c.surface, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
                  {/* ── Card header ── */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
                    {/* Avatar */}
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 16, fontWeight: '700', color: c.primary }}>
                        {(ts.staff_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', fontSize: 15, color: c.ink }} numberOfLines={1}>{ts.staff_name}</Text>
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted, marginTop: 1 }} numberOfLines={1}>{ts.visit_label || ts.visit_type} · {ts.person_name}</Text>
                    </View>
                    <View style={{ backgroundColor: sc.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, fontWeight: '600', color: sc.text, textTransform: 'capitalize' }}>
                        {ts.timesheet_status || 'draft'}
                      </Text>
                    </View>
                  </View>

                  {/* ── Date and time ── */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.md, marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={14} color={c.muted} />
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{ts.scheduled_start ? fmtDate(ts.scheduled_start) : '—'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={14} color={c.muted} />
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>
                        {ts.scheduled_start ? fmtTime(ts.scheduled_start) : '—'} — {ts.scheduled_end ? fmtTime(ts.scheduled_end) : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* ── Breakdown chips ── */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                    {[
                      { label: 'Work', value: fmtHours(ts.work_minutes), bg: '#F0FDF4', color: '#166534' },
                      { label: 'Travel', value: fmtHours(ts.paid_travel_minutes), bg: '#EFF6FF', color: '#1E40AF' },
                      { label: 'Miles', value: fmtMiles(ts.mileage_miles), bg: '#F5F3FF', color: '#5B21B6' },
                      { label: 'Tasks', value: tasksTotal > 0 ? `${tasksDone}/${tasksTotal}` : '—', bg: tasksTotal > 0 && tasksDone === tasksTotal ? '#F0FDF4' : tasksTotal > 0 ? '#FFFBEB' : '#F3F4F6', color: tasksTotal > 0 && tasksDone === tasksTotal ? '#166534' : tasksTotal > 0 ? '#92400E' : '#6B7280' },
                    ].map(chip => (
                      <View key={chip.label} style={{ backgroundColor: chip.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, fontWeight: '500', color: chip.color }}>{chip.label}: {chip.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* ── Care notes preview ── */}
                  {ts.visit_notes && (
                    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                      <View style={{ backgroundColor: c.bg, borderRadius: radii.sm, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: c.primary }}>
                        <Text numberOfLines={2} style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted, lineHeight: 18 }}>{ts.visit_notes}</Text>
                      </View>
                    </View>
                  )}

                  {/* ── Pay row ── */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                    <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>
                      {ts.actual_check_in && ts.actual_check_out ? `${fmtTime(ts.actual_check_in)} → ${fmtTime(ts.actual_check_out)}` : 'Not checked in'}
                    </Text>
                    <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '800', fontSize: 16, color: c.primary }}>{money(ts.gross_pay_pence)}</Text>
                  </View>

                  {/* ── Actions ── */}
                  {ts.timesheet_status === 'submitted' && (
                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border, padding: spacing.sm, gap: spacing.sm }}>
                      <Pressable
                        onPress={() => {
                          hapticLight()
                          setRejectModal({ id: tsId, name: ts.staff_name })
                        }}
                        disabled={isProcessing}
                        style={({ pressed }) => [{
                          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                          backgroundColor: c.surface, borderRadius: radii.md, paddingVertical: spacing.sm + 2,
                          borderWidth: 1, borderColor: '#DC2626',
                        }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                        <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 13, fontWeight: '600', color: '#DC2626' }}>Reject</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleApprove(ts)}
                        disabled={isProcessing}
                        style={({ pressed }) => [{
                          flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                          backgroundColor: c.success, borderRadius: radii.md, paddingVertical: spacing.sm + 2,
                        }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size={14} color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                            <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Approve</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* ── Reject modal ── */}
      <Modal visible={!!rejectModal} transparent animationType="fade" onRequestClose={() => { setRejectModal(null); setRejectReason('') }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: c.surface, borderRadius: radii.xl, padding: spacing.lg, width: '100%', maxWidth: 360, ...elevation.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 17, fontWeight: '700', color: c.ink }}>Reject Timesheet</Text>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{rejectModal?.name}</Text>
              </View>
            </View>

            <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 13, color: c.muted, marginBottom: spacing.sm }}>
              Reason for rejection (optional)
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Incorrect hours logged"
              placeholderTextColor={c.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: c.bg, borderRadius: radii.md, borderWidth: 1, borderColor: c.border,
                padding: spacing.md, fontFamily: typography.body.fontFamily, fontSize: 14, color: c.ink,
                minHeight: 80, marginBottom: spacing.lg,
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => { setRejectModal(null); setRejectReason('') }}
                style={({ pressed }) => [{ flex: 1, backgroundColor: c.bg, borderRadius: radii.md, paddingVertical: spacing.sm + 2, alignItems: 'center', borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 14, fontWeight: '600', color: c.ink }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleReject}
                disabled={processing === rejectModal?.id}
                style={({ pressed }) => [{ flex: 1, backgroundColor: '#DC2626', borderRadius: radii.md, paddingVertical: spacing.sm + 2, alignItems: 'center' }, pressed && { opacity: 0.7 }]}
              >
                {processing === rejectModal?.id ? (
                  <ActivityIndicator size={14} color="#FFFFFF" />
                ) : (
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Reject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
