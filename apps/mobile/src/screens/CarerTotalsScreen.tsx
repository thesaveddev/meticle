import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppColors, typography, spacing, radii, elevation } from '../theme'
import { getMonthlyCarerTotals, getCarerTimesheetDetail, getPendingTimesheets, approveTimesheet, rejectTimesheet } from '../services/api'
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
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtDateTime = (d: string) => `${fmtDate(d)} ${fmtTime(d)}`

function getMonthRange(monthsBack = 0) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0, 23, 59, 59)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': return { bg: '#E9F7F0', text: '#047857', label: 'Completed' }
    case 'checked_in': return { bg: '#EFF6FF', text: '#1D4ED8', label: 'In progress' }
    case 'scheduled': return { bg: '#F3F4F6', text: '#374151', label: 'Scheduled' }
    case 'missed': return { bg: '#FDECEC', text: '#B42318', label: 'Missed' }
    case 'cancelled': return { bg: '#F3F4F6', text: '#9CA3AF', label: 'Cancelled' }
    default: return { bg: '#F3F4F6', text: '#6B7280', label: status }
  }
}

const tsStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return { bg: '#E9F7F0', text: '#047857', label: 'Approved' }
    case 'submitted': return { bg: '#FFF5D9', text: '#D97706', label: 'Submitted' }
    case 'rejected': return { bg: '#FDECEC', text: '#B42318', label: 'Rejected' }
    default: return { bg: '#F3F4F6', text: '#6B7280', label: 'Draft' }
  }
}

/* ── Props ── */
interface Props {
  session: { accessToken: string }
  onBack: () => void
}

/* ════════════════════════════════════════════════════════════════ */
export function CarerTotalsScreen({ session, onBack }: Props) {
  const c = useAppColors()
  const [view, setView] = useState<'overview' | 'carer-detail' | 'pending'>('overview')
  const [totals, setTotals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCarer, setSelectedCarer] = useState<any>(null)
  const [carerVisits, setCarerVisits] = useState<any[]>([])
  const [carerLoading, setCarerLoading] = useState(false)
  const [pendingVisits, setPendingVisits] = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)

  const range = useMemo(() => getMonthRange(), [])
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getMonthlyCarerTotals(session.accessToken, from, to)
      setTotals(data)
    } catch {} finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken, from, to])

  useState(() => { loadData() })

  const grandWork = totals.reduce((s, t) => s + Number(t.total_work_minutes || 0), 0)
  const grandTravel = totals.reduce((s, t) => s + Number(t.total_paid_travel_minutes || 0), 0)
  const grandMileage = totals.reduce((s, t) => s + Number(t.total_mileage_miles || 0), 0)
  const grandGross = totals.reduce((s, t) => s + Number(t.total_gross_pay_pence || 0), 0)
  const grandPending = totals.reduce((s, t) => s + Number(t.pending_count || 0), 0)

  const loadCarerDetail = useCallback(async (carer: any) => {
    hapticLight()
    setSelectedCarer(carer)
    setCarerLoading(true)
    setView('carer-detail')
    try {
      const data = await getCarerTimesheetDetail(session.accessToken, carer.staff_id, from, to)
      setCarerVisits(data)
    } catch {} finally { setCarerLoading(false) }
  }, [session.accessToken, from, to])

  const loadPending = useCallback(async () => {
    hapticLight()
    setPendingLoading(true)
    setView('pending')
    try {
      const data = await getPendingTimesheets(session.accessToken, from, to)
      setPendingVisits(data)
    } catch {} finally { setPendingLoading(false) }
  }, [session.accessToken, from, to])

  const handleApprove = useCallback(async (timesheetId: string) => {
    hapticWarning()
    setApproving(timesheetId)
    try {
      await approveTimesheet(session.accessToken, timesheetId)
      hapticSuccess()
      setPendingVisits(prev => prev.filter(v => v.timesheet_id !== timesheetId))
      loadData(true)
    } catch {} finally { setApproving(null) }
  }, [session.accessToken, loadData])

  const handleReject = useCallback(async (timesheetId: string) => {
    hapticWarning()
    setApproving(timesheetId)
    try {
      await rejectTimesheet(session.accessToken, timesheetId)
      hapticSuccess()
      setPendingVisits(prev => prev.filter(v => v.timesheet_id !== timesheetId))
      loadData(true)
    } catch {} finally { setApproving(null) }
  }, [session.accessToken, loadData])

  const goBack = () => {
    if (view === 'overview') onBack()
    else { setView('overview'); setSelectedCarer(null) }
  }

  /* ── Header ── */
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
      <Pressable onPress={goBack} style={{ marginRight: spacing.md, padding: spacing.xs }}>
        <Ionicons name="chevron-back" size={24} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: typography.title.fontFamily, fontSize: typography.title.fontSize, fontWeight: '800', color: c.ink }}>
          {view === 'carer-detail' ? selectedCarer?.staff_name || 'Carer Details' :
           view === 'pending' ? 'Pending Approvals' :
           'Carer Totals'}
        </Text>
        <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>
          {view === 'carer-detail' ? `${fmtDate(from)} — ${fmtDate(to)}` :
           view === 'pending' ? `${pendingVisits.length} pending` :
           'Staff earnings overview'}
        </Text>
      </View>
    </View>
  )

  /* ═══════════ OVERVIEW ═══════════ */
  if (view === 'overview') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true) }} tintColor={c.primary} />}
        >
          {/* Summary cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
            {[
              { label: 'Carers', value: String(totals.length), icon: 'people-outline' as const, color: c.primary },
              { label: 'Paid time', value: fmtHours(grandWork), icon: 'time-outline' as const, color: c.success },
              { label: 'Travel', value: fmtHours(grandTravel), icon: 'car-outline' as const, color: '#3B82F6' },
              { label: 'Mileage', value: fmtMiles(grandMileage), icon: 'map-outline' as const, color: '#8B5CF6' },
              { label: 'Gross pay', value: money(grandGross), icon: 'cash-outline' as const, color: c.primary },
            ].map(card => (
              <View key={card.label} style={{ flexBasis: '45%', flexGrow: 1, minWidth: 140, backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border }}>
                <Ionicons name={card.icon} size={18} color={card.color} />
                <Text style={{ fontFamily: typography.title.fontFamily, fontSize: 20, fontWeight: '800', color: card.color, marginTop: spacing.xs }}>{card.value}</Text>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Pending approvals button */}
          {grandPending > 0 && (
            <Pressable
              onPress={loadPending}
              style={({ pressed }) => [{ backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 2, borderColor: c.warning, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pressed && { opacity: 0.8 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="hourglass-outline" size={20} color={c.warning} />
                <View>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', color: c.warning }}>{grandPending} awaiting approval</Text>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>Tap to review and approve</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.warning} />
            </Pressable>
          )}

          {/* Carer list */}
          {loading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: spacing.xxl }} />
          ) : totals.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="receipt-outline" size={48} color={c.border} />
              <Text style={{ fontFamily: typography.body.fontFamily, color: c.muted, marginTop: spacing.sm }}>No data for this period</Text>
            </View>
          ) : (
            totals.map((t: any) => (
              <Pressable
                key={t.staff_id}
                onPress={() => loadCarerDetail(t)}
                style={({ pressed }) => [{ backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                  <Ionicons name="person" size={18} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '600', color: c.ink }}>{t.staff_name}</Text>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>{t.visit_count} visits</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', color: c.primary }}>{money(t.total_gross_pay_pence)}</Text>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>{fmtHours(Number(t.total_work_minutes || 0))}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.muted} style={{ marginLeft: spacing.sm }} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    )
  }

  /* ═══════════ CARER DETAIL ═══════════ */
  if (view === 'carer-detail' && selectedCarer) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          {/* Summary row */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {[
              { label: 'Visits', value: String(selectedCarer.visit_count), color: c.primary },
              { label: 'Work', value: fmtHours(Number(selectedCarer.total_work_minutes || 0)), color: c.success },
              { label: 'Travel', value: fmtHours(Number(selectedCarer.total_paid_travel_minutes || 0)), color: '#3B82F6' },
              { label: 'Pay', value: money(selectedCarer.total_gross_pay_pence), color: '#8B5CF6' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 16, fontWeight: '800', color: s.color }}>{s.value}</Text>
                <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 10, color: c.muted }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {carerLoading ? (
            <ActivityIndicator size="large" color={c.primary} style={{ marginTop: spacing.xxl }} />
          ) : carerVisits.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="receipt-outline" size={48} color={c.border} />
              <Text style={{ fontFamily: typography.body.fontFamily, color: c.muted, marginTop: spacing.sm }}>No visits</Text>
            </View>
          ) : (
            carerVisits.map((v: any) => {
              const sc = statusColor(v.status)
              const tc = tsStatusColor(v.timesheet_status || 'draft')
              const durationMin = v.scheduled_end && v.scheduled_start
                ? Math.round((new Date(v.scheduled_end).getTime() - new Date(v.scheduled_start).getTime()) / 60000)
                : null
              const actualMin = v.check_in_at && v.check_out_at
                ? Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000)
                : null

              return (
                <View key={v.id} style={{ backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border }}>
                  {/* Visit header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', color: c.ink }}>{v.label || v.visit_type}</Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: sc.bg }}>
                      <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, fontWeight: '600', color: sc.text }}>{sc.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{v.person_name}</Text>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{fmtDateTime(v.scheduled_start)}</Text>

                  {/* Chips row */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm }}>
                    {v.work_minutes != null && <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#166534', fontWeight: '500' }}>Work: {fmtHours(v.work_minutes)}</Text></View>}
                    {v.paid_travel_minutes != null && <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '500' }}>Travel: {fmtHours(v.paid_travel_minutes)}</Text></View>}
                    {v.mileage_miles != null && <View style={{ backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#5B21B6', fontWeight: '500' }}>{fmtMiles(v.mileage_miles)}</Text></View>}
                    {durationMin != null && <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#475569', fontWeight: '500' }}>Duration: {fmtHours(durationMin)}</Text></View>}
                    {v.tasks_total != null && v.tasks_total > 0 && <View style={{ backgroundColor: v.tasks_completed === v.tasks_total ? '#F0FDF4' : '#FFFBEB', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: v.tasks_completed === v.tasks_total ? '#166534' : '#92400E', fontWeight: '500' }}>Tasks: {v.tasks_completed}/{v.tasks_total}</Text></View>}
                    <View style={{ backgroundColor: tc.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: tc.text, fontWeight: '600' }}>{tc.label}</Text></View>
                  </View>

                  {/* Care notes preview */}
                  {(v.visit_notes || v.progress_notes) && (
                    <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderLight }}>
                      {v.visit_notes && <Text numberOfLines={2} style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{v.visit_notes}</Text>}
                      {v.progress_notes && <Text numberOfLines={2} style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted, marginTop: 2 }}>{v.progress_notes}</Text>}
                    </View>
                  )}

                  {/* Pay */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs }}>
                    <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', color: c.primary }}>{v.gross_pay_pence != null ? money(v.gross_pay_pence) : '—'}</Text>
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      </View>
    )
  }

  /* ═══════════ PENDING APPROVALS ═══════════ */
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {pendingLoading ? (
          <ActivityIndicator size="large" color={c.primary} style={{ marginTop: spacing.xxl }} />
        ) : pendingVisits.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Ionicons name="checkmark-circle-outline" size={48} color={c.success} />
            <Text style={{ fontFamily: typography.body.fontFamily, color: c.muted, marginTop: spacing.sm }}>All timesheets reviewed</Text>
          </View>
        ) : (
          pendingVisits.map((v: any) => (
            <View key={v.timesheet_id} style={{ backgroundColor: c.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.primarySurface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={14} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '600', color: c.ink }}>{v.staff_name}</Text>
                  <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 11, color: c.muted }}>{v.visit_label} · {v.person_name}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: typography.body.fontFamily, fontSize: 12, color: c.muted }}>{fmtDateTime(v.scheduled_start)}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#166534' }}>Work: {fmtHours(v.work_minutes)}</Text></View>
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#1E40AF' }}>Travel: {fmtHours(v.paid_travel_minutes)}</Text></View>
                <View style={{ backgroundColor: '#F5F3FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: '#5B21B6' }}>{fmtMiles(v.mileage_miles)}</Text></View>
              </View>
              <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '700', color: c.primary, marginTop: spacing.sm }}>{money(v.gross_pay_pence)}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Pressable
                  onPress={() => handleApprove(v.timesheet_id)}
                  disabled={approving === v.timesheet_id}
                  style={({ pressed }) => [{ flex: 1, backgroundColor: c.success, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: 'center' }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '600', color: '#FFFFFF' }}>{approving === v.timesheet_id ? '...' : 'Approve'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleReject(v.timesheet_id)}
                  disabled={approving === v.timesheet_id}
                  style={({ pressed }) => [{ flex: 1, backgroundColor: c.surface, borderRadius: radii.md, paddingVertical: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={{ fontFamily: typography.body.fontFamily, fontWeight: '600', color: c.danger }}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
