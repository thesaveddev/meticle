import { useCallback, useEffect, useState } from 'react'
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAppColors, spacing, radii, FONT, elevation } from '../theme'
import type { AuthSession } from '../types'
import { cancelLeaveRequest, createLeaveRequest, getLeaveBalances, getLeaveTypes, getMyLeaveRequests, getLeaveRequests, reviewLeaveRequest } from '../services/api'
import { formatDateOnly, localDateInput } from '../utils/dateFormat'

function today() {
  return localDateInput()
}

function balanceValues(balance: any) {
  const remaining = Number(balance.days_remaining ?? balance.hours_remaining ?? 0)
  const allocated = Number(balance.days_allocated ?? balance.days_entitled ?? balance.total_days ?? balance.hours_allocated ?? remaining)
  const taken = Math.max(0, allocated - remaining)
  return { allocated, taken, remaining, percent: allocated > 0 ? Math.min(100, Math.round((taken / allocated) * 100)) : 0 }
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDateInput(d)
}

function statusColor(status: string, c: ReturnType<typeof useAppColors>) {
  if (status === 'approved') return c.success
  if (status === 'rejected' || status === 'cancelled') return c.danger
  return c.warning
}

export function AnnualLeaveScreen({ session, onBack }: { session: AuthSession; onBack?: () => void }) {
  const c = useAppColors()
  const [types, setTypes] = useState<any[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [reason, setReason] = useState('')
  const [activeView, setActiveView] = useState<'applied' | 'apply' | 'approvals'>('applied')
  const [managerRequests, setManagerRequests] = useState<any[]>([])
  const [reviewing, setReviewing] = useState<string | null>(null)
  const isManager = session.user.role === 'MANAGER' || session.user.role === 'ORG_ADMIN'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextTypes, nextBalances, nextRequests, nextManagerRequests] = await Promise.all([
        getLeaveTypes(session.accessToken), getLeaveBalances(session.accessToken), getMyLeaveRequests(session.accessToken),
        isManager ? getLeaveRequests(session.accessToken, 'pending') : Promise.resolve([]),
      ])
      setTypes(nextTypes)
      setBalances(nextBalances)
      setRequests(nextRequests)
      setManagerRequests(nextManagerRequests)
      if (!selectedType && nextTypes[0]) setSelectedType(nextTypes[0].id)
    } catch (e: any) { setError(e.message || 'Could not load leave information') }
    finally { setLoading(false) }
  }, [session.accessToken, isManager])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    setError('')
    if (!selectedType || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError('Choose a leave type and enter dates as YYYY-MM-DD.')
      return
    }
    if (endDate < startDate) { setError('End date cannot be before the start date.'); return }
    setSaving(true)
    try {
      await createLeaveRequest(session.accessToken, { leave_type_id: selectedType, start_date: startDate, end_date: endDate, duration_type: 'days', reason: reason.trim() || undefined })
      setReason('')
      setActiveView('applied')
      Alert.alert('Request submitted', 'Your leave request has been sent through the existing approval process.')
      await load()
    } catch (e: any) { setError(e.message || 'Could not submit leave request') }
    finally { setSaving(false) }
  }

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setReviewing(id)
    try {
      await reviewLeaveRequest(session.accessToken, id, status)
      setManagerRequests(prev => prev.filter(request => request.id !== id))
    } catch (e: any) { setError(e.message || 'Could not review leave request') }
    finally { setReviewing(null) }
  }

  const cancel = (id: string) => Alert.alert('Cancel leave request?', 'This only cancels a pending request.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Cancel request', style: 'destructive', onPress: async () => { try { await cancelLeaveRequest(session.accessToken, id); await load() } catch (e: any) { setError(e.message || 'Could not cancel request') } } },
  ])

  if (loading) return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.primary} /></View>

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={22} color={c.ink} /></Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Annual leave</Text><View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { color: c.ink }]}>Time away</Text>
            <Text style={[styles.sub, { color: c.muted }]}>View your leave history and submit requests through the existing approval process.</Text>
          </View>
          <View style={[styles.balanceIcon, { backgroundColor: c.primarySurface }]}><Ionicons name="calendar-outline" size={22} color={c.primary} /></View>
        </View>
        {error ? <View style={[styles.errorBox, { backgroundColor: c.dangerSurface }]}><Ionicons name="alert-circle-outline" size={17} color={c.danger} /><Text style={[styles.error, { color: c.danger }]}>{error}</Text></View> : null}

        <View style={[styles.balanceSummary, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <View style={[styles.balanceRing, { borderColor: c.primarySurface }]}>
            <View style={[styles.balanceRingProgress, { borderColor: c.primary, transform: [{ rotate: `${Math.max(-135, Math.min(135, -135 + (270 * (balances[0] ? balanceValues(balances[0]).percent : 0)) / 100))}deg` }] }]} />
            <View style={styles.balanceRingCenter}><Text style={[styles.balancePercent, { color: c.primary }]}>{balances[0] ? `${balanceValues(balances[0]).percent}%` : '—'}</Text><Text style={[styles.balanceCaption, { color: c.muted }]}>taken</Text></View>
          </View>
          <View style={styles.balanceSummaryCopy}>
            <Text style={[styles.balanceTitle, { color: c.ink }]}>Leave balance</Text>
            <Text style={[styles.balanceSubtitle, { color: c.muted }]}>{balances[0]?.leave_type_name || 'Current allowance'}</Text>
            {balances[0] ? <View style={styles.balanceStats}><View><Text style={[styles.balanceNumber, { color: c.ink }]}>{balanceValues(balances[0]).taken}</Text><Text style={[styles.balanceLabel, { color: c.muted }]}>taken</Text></View><View><Text style={[styles.balanceNumber, { color: c.primary }]}>{balanceValues(balances[0]).remaining}</Text><Text style={[styles.balanceLabel, { color: c.muted }]}>left</Text></View><View><Text style={[styles.balanceNumber, { color: c.ink }]}>{balanceValues(balances[0]).allocated}</Text><Text style={[styles.balanceLabel, { color: c.muted }]}>total</Text></View></View> : <Text style={[styles.rowMeta, { color: c.muted }]}>No balance configured yet.</Text>}
          </View>
        </View>

        <View style={[styles.tabs, { backgroundColor: c.surfaceAlt }]}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'applied' }} onPress={() => setActiveView('applied')} style={[styles.tab, activeView === 'applied' && { backgroundColor: c.surface, ...elevation.sm }]}>
            <Ionicons name="list-outline" size={16} color={activeView === 'applied' ? c.primary : c.muted} />
            <Text style={[styles.tabText, { color: activeView === 'applied' ? c.primary : c.muted }]}>Applied leave</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'apply' }} onPress={() => setActiveView('apply')} style={[styles.tab, activeView === 'apply' && { backgroundColor: c.surface, ...elevation.sm }]}>
            <Ionicons name="add-circle-outline" size={16} color={activeView === 'apply' ? c.primary : c.muted} />
            <Text style={[styles.tabText, { color: activeView === 'apply' ? c.primary : c.muted }]}>Apply for leave</Text>
          </Pressable>
          {isManager ? <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'approvals' }} onPress={() => setActiveView('approvals')} style={[styles.tab, activeView === 'approvals' && { backgroundColor: c.surface, ...elevation.sm }]}>
            <Ionicons name="checkmark-done-outline" size={16} color={activeView === 'approvals' ? c.primary : c.muted} />
            <Text style={[styles.tabText, { color: activeView === 'approvals' ? c.primary : c.muted }]}>Approvals{managerRequests.length ? ` (${managerRequests.length})` : ''}</Text>
          </Pressable> : null}
        </View>

        {activeView === 'approvals' ? (
          <>
            <View style={styles.sectionTitleRow}><Text style={[styles.section, { color: c.subtle }]}>LEAVE TO REVIEW</Text><Text style={[styles.count, { color: c.muted }]}>{managerRequests.length}</Text></View>
            {managerRequests.length ? managerRequests.map(request => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                <View style={styles.requestBody}><Text style={[styles.rowTitle, { color: c.ink }]}>{[request.first_name, request.last_name].filter(Boolean).join(' ') || 'Staff member'}</Text><Text style={[styles.rowMeta, { color: c.muted }]}>{request.leave_type_name} · {formatDateOnly(request.start_date)} to {formatDateOnly(request.end_date)}</Text>{request.reason ? <Text style={[styles.reason, { color: c.subtle }]}>{request.reason}</Text> : null}</View>
                <View style={styles.requestActions}><Pressable disabled={reviewing === request.id} onPress={() => review(request.id, 'approved')} style={[styles.reviewButton, { backgroundColor: c.success }]}><Text style={{ color: c.inverse, fontFamily: FONT, fontWeight: '700' }}>Approve</Text></Pressable><Pressable disabled={reviewing === request.id} onPress={() => review(request.id, 'rejected')} style={[styles.reviewButton, { backgroundColor: c.dangerSurface }]}><Text style={{ color: c.danger, fontFamily: FONT, fontWeight: '700' }}>Reject</Text></Pressable></View>
              </View>
            )) : <View style={[styles.emptyCard, { backgroundColor: c.surface }]}><Ionicons name="checkmark-circle-outline" size={30} color={c.success} /><Text style={[styles.emptyTitle, { color: c.ink }]}>No leave awaiting approval</Text></View>}
          </>
        ) : activeView === 'applied' ? (
          <>
            <View style={styles.sectionTitleRow}><Text style={[styles.section, { color: c.subtle }]}>YOUR APPLICATIONS</Text><Text style={[styles.count, { color: c.muted }]}>{requests.length}</Text></View>
            {requests.length ? requests.map(request => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                <View style={[styles.requestIcon, { backgroundColor: `${statusColor(request.status, c)}18` }]}><Ionicons name={request.status === 'approved' ? 'checkmark-circle-outline' : request.status === 'rejected' ? 'close-circle-outline' : 'time-outline'} size={21} color={statusColor(request.status, c)} /></View>
                <View style={styles.requestBody}>
                  <Text style={[styles.rowTitle, { color: c.ink }]}>{request.leave_type_name}</Text>
                  <Text style={[styles.rowMeta, { color: c.muted }]}>{formatDateOnly(request.start_date)} to {formatDateOnly(request.end_date)}</Text>
                  {request.reason ? <Text style={[styles.reason, { color: c.subtle }]} numberOfLines={2}>{request.reason}</Text> : null}
                </View>
                <View style={styles.requestActions}><Text style={[styles.status, { color: statusColor(request.status, c) }]}>{request.status}</Text>{request.status === 'pending' ? <Pressable onPress={() => cancel(request.id)}><Text style={[styles.cancel, { color: c.danger }]}>Cancel</Text></Pressable> : null}</View>
              </View>
            )) : <View style={[styles.emptyCard, { backgroundColor: c.surface }]}><Ionicons name="calendar-clear-outline" size={30} color={c.primary} /><Text style={[styles.emptyTitle, { color: c.ink }]}>No leave applications yet</Text><Text style={[styles.rowMeta, { color: c.muted }]}>When you apply, your requests and approval status will appear here.</Text><Pressable onPress={() => setActiveView('apply')} style={[styles.emptyButton, { backgroundColor: c.primary }]}><Text style={[styles.emptyButtonText, { color: c.inverse }]}>Apply for leave</Text></Pressable></View>}

          </>
        ) : (
          <>
            <Text style={[styles.section, { color: c.subtle }]}>NEW REQUEST</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Text style={[styles.label, { color: c.ink }]}>Leave type</Text>
              <View style={styles.chips}>{types.map(type => <Pressable key={type.id} onPress={() => setSelectedType(type.id)} style={[styles.chip, { backgroundColor: selectedType === type.id ? c.primary : c.surfaceAlt, borderColor: selectedType === type.id ? c.primary : c.border }]}><Text style={{ color: selectedType === type.id ? c.inverse : c.ink, fontFamily: FONT, fontSize: 13 }}>{type.name}</Text></Pressable>)}</View>
              <Text style={[styles.label, { color: c.ink }]}>Start date</Text>
              <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.input, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
              <Text style={[styles.label, { color: c.ink }]}>End date</Text>
              <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.input, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
              <View style={styles.quick}><Pressable onPress={() => { const d = today(); setStartDate(d); setEndDate(d) }}><Text style={{ color: c.primary, fontFamily: FONT }}>Today</Text></Pressable><Pressable onPress={() => { const d = addDays(today(), 1); setStartDate(d); setEndDate(d) }}><Text style={{ color: c.primary, fontFamily: FONT }}>Tomorrow</Text></Pressable></View>
              <Text style={[styles.label, { color: c.ink }]}>Reason <Text style={{ color: c.muted, fontWeight: '400' }}>(optional)</Text></Text>
              <TextInput value={reason} onChangeText={setReason} placeholder="Add a note for your approver" placeholderTextColor={c.subtle} multiline style={[styles.input, styles.notes, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
              <Pressable onPress={submit} disabled={saving} style={[styles.submit, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}><Text style={{ color: c.inverse, fontFamily: FONT, fontWeight: '700' }}>{saving ? 'Submitting…' : 'Submit leave request'}</Text></Pressable>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: FONT, fontSize: 17, fontWeight: '700' },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl }, introRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.base }, heading: { fontFamily: FONT, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }, sub: { fontFamily: FONT, fontSize: 13, lineHeight: 19, marginTop: spacing.xs }, balanceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md }, error: { fontFamily: FONT, flex: 1, fontSize: 13 },
  balanceSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.md, ...elevation.sm }, balanceRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 8, alignItems: 'center', justifyContent: 'center', position: 'relative' }, balanceRingProgress: { position: 'absolute', width: 82, height: 82, borderRadius: 41, borderWidth: 8, borderLeftColor: 'transparent', borderBottomColor: 'transparent' }, balanceRingCenter: { alignItems: 'center' }, balancePercent: { fontFamily: FONT, fontSize: 17, fontWeight: '800' }, balanceCaption: { fontFamily: FONT, fontSize: 10 }, balanceSummaryCopy: { flex: 1 }, balanceTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '800' }, balanceSubtitle: { fontFamily: FONT, fontSize: 12, marginTop: 2 }, balanceStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }, balanceNumber: { fontFamily: FONT, fontSize: 16, fontWeight: '800' }, balanceLabel: { fontFamily: FONT, fontSize: 10, marginTop: 1 },
  tabs: { flexDirection: 'row', borderRadius: radii.md, padding: 3, marginBottom: spacing.lg }, tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.sm }, tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, section: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm }, count: { fontFamily: FONT, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { borderRadius: radii.lg, padding: spacing.md, ...elevation.sm }, label: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, chip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, input: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, fontFamily: FONT, fontSize: 14 }, notes: { minHeight: 80, textAlignVertical: 'top' }, quick: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm }, submit: { alignItems: 'center', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, ...elevation.sm }, requestIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, requestBody: { flex: 1 }, requestActions: { alignItems: 'flex-end', gap: spacing.xs }, rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' }, rowMeta: { fontFamily: FONT, fontSize: 12, marginTop: 3 }, reason: { fontFamily: FONT, fontSize: 11, marginTop: 5 }, status: { fontFamily: FONT, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, cancel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  emptyCard: { borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...elevation.sm }, emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', marginTop: spacing.xs }, emptyButton: { borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },  emptyButtonText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' }, reviewButton: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginTop: spacing.xs, alignItems: 'center' }, balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }, balanceDot: { width: 8, height: 8, borderRadius: 4 },
})
