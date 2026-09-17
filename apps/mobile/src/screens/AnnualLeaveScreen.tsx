import { useCallback, useEffect, useState } from 'react'
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppColors, spacing, radii, FONT, elevation } from '../theme'
import type { AuthSession } from '../types'
import { cancelLeaveRequest, createLeaveRequest, getLeaveBalances, getLeaveTypes, getMyLeaveRequests } from '../services/api'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
  const [activeView, setActiveView] = useState<'applied' | 'apply'>('applied')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextTypes, nextBalances, nextRequests] = await Promise.all([
        getLeaveTypes(session.accessToken), getLeaveBalances(session.accessToken), getMyLeaveRequests(session.accessToken),
      ])
      setTypes(nextTypes)
      setBalances(nextBalances)
      setRequests(nextRequests)
      if (!selectedType && nextTypes[0]) setSelectedType(nextTypes[0].id)
    } catch (e: any) { setError(e.message || 'Could not load leave information') }
    finally { setLoading(false) }
  }, [session.accessToken])

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

  const cancel = (id: string) => Alert.alert('Cancel leave request?', 'This only cancels a pending request.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Cancel request', style: 'destructive', onPress: async () => { try { await cancelLeaveRequest(session.accessToken, id); await load() } catch (e: any) { setError(e.message || 'Could not cancel request') } } },
  ])

  if (loading) return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.primary} /></View>

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
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

        <View style={[styles.tabs, { backgroundColor: c.surfaceAlt }]}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'applied' }} onPress={() => setActiveView('applied')} style={[styles.tab, activeView === 'applied' && { backgroundColor: c.surface, ...elevation.sm }]}>
            <Ionicons name="list-outline" size={16} color={activeView === 'applied' ? c.primary : c.muted} />
            <Text style={[styles.tabText, { color: activeView === 'applied' ? c.primary : c.muted }]}>Applied leave</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'apply' }} onPress={() => setActiveView('apply')} style={[styles.tab, activeView === 'apply' && { backgroundColor: c.surface, ...elevation.sm }]}>
            <Ionicons name="add-circle-outline" size={16} color={activeView === 'apply' ? c.primary : c.muted} />
            <Text style={[styles.tabText, { color: activeView === 'apply' ? c.primary : c.muted }]}>Apply for leave</Text>
          </Pressable>
        </View>

        {activeView === 'applied' ? (
          <>
            <View style={styles.sectionTitleRow}><Text style={[styles.section, { color: c.subtle }]}>YOUR APPLICATIONS</Text><Text style={[styles.count, { color: c.muted }]}>{requests.length}</Text></View>
            {requests.length ? requests.map(request => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                <View style={[styles.requestIcon, { backgroundColor: `${statusColor(request.status, c)}18` }]}><Ionicons name={request.status === 'approved' ? 'checkmark-circle-outline' : request.status === 'rejected' ? 'close-circle-outline' : 'time-outline'} size={21} color={statusColor(request.status, c)} /></View>
                <View style={styles.requestBody}>
                  <Text style={[styles.rowTitle, { color: c.ink }]}>{request.leave_type_name}</Text>
                  <Text style={[styles.rowMeta, { color: c.muted }]}>{request.start_date} to {request.end_date}</Text>
                  {request.reason ? <Text style={[styles.reason, { color: c.subtle }]} numberOfLines={2}>{request.reason}</Text> : null}
                </View>
                <View style={styles.requestActions}><Text style={[styles.status, { color: statusColor(request.status, c) }]}>{request.status}</Text>{request.status === 'pending' ? <Pressable onPress={() => cancel(request.id)}><Text style={[styles.cancel, { color: c.danger }]}>Cancel</Text></Pressable> : null}</View>
              </View>
            )) : <View style={[styles.emptyCard, { backgroundColor: c.surface }]}><Ionicons name="calendar-clear-outline" size={30} color={c.primary} /><Text style={[styles.emptyTitle, { color: c.ink }]}>No leave applications yet</Text><Text style={[styles.rowMeta, { color: c.muted }]}>When you apply, your requests and approval status will appear here.</Text><Pressable onPress={() => setActiveView('apply')} style={[styles.emptyButton, { backgroundColor: c.primary }]}><Text style={[styles.emptyButtonText, { color: c.inverse }]}>Apply for leave</Text></Pressable></View>}

            <Text style={[styles.section, { color: c.subtle }]}>BALANCES</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{balances.length ? balances.map(balance => <View key={`${balance.leave_type_id}-${balance.year}`} style={styles.balanceRow}><View style={[styles.balanceDot, { backgroundColor: c.primary }]} /><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.ink }]}>{balance.leave_type_name}</Text><Text style={[styles.rowMeta, { color: c.muted }]}>{balance.duration_type === 'hours' ? `${balance.hours_remaining ?? 0} hours remaining` : `${balance.days_remaining ?? 0} days remaining`}</Text></View><Ionicons name="chevron-forward" size={16} color={c.subtle} /></View>) : <Text style={[styles.rowMeta, { color: c.muted }]}>No balances configured yet.</Text>}</View>
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
            <Text style={[styles.section, { color: c.subtle }]}>AVAILABLE BALANCE</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>{balances.length ? balances.map(balance => <View key={`${balance.leave_type_id}-${balance.year}`} style={styles.balanceRow}><View style={[styles.balanceDot, { backgroundColor: c.primary }]} /><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.ink }]}>{balance.leave_type_name}</Text><Text style={[styles.rowMeta, { color: c.muted }]}>{balance.duration_type === 'hours' ? `${balance.hours_remaining ?? 0} hours remaining` : `${balance.days_remaining ?? 0} days remaining`}</Text></View></View>) : <Text style={[styles.rowMeta, { color: c.muted }]}>No balances configured yet.</Text>}</View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: FONT, fontSize: 17, fontWeight: '700' },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl }, introRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.base }, heading: { fontFamily: FONT, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }, sub: { fontFamily: FONT, fontSize: 13, lineHeight: 19, marginTop: spacing.xs }, balanceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md }, error: { fontFamily: FONT, flex: 1, fontSize: 13 },
  tabs: { flexDirection: 'row', borderRadius: radii.md, padding: 3, marginBottom: spacing.lg }, tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.sm }, tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, section: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm }, count: { fontFamily: FONT, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { borderRadius: radii.lg, padding: spacing.md, ...elevation.sm }, label: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, chip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, input: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, fontFamily: FONT, fontSize: 14 }, notes: { minHeight: 80, textAlignVertical: 'top' }, quick: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm }, submit: { alignItems: 'center', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, ...elevation.sm }, requestIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, requestBody: { flex: 1 }, requestActions: { alignItems: 'flex-end', gap: spacing.xs }, rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' }, rowMeta: { fontFamily: FONT, fontSize: 12, marginTop: 3 }, reason: { fontFamily: FONT, fontSize: 11, marginTop: 5 }, status: { fontFamily: FONT, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, cancel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  emptyCard: { borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...elevation.sm }, emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', marginTop: spacing.xs }, emptyButton: { borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm }, emptyButtonText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' }, balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }, balanceDot: { width: 8, height: 8, borderRadius: 4 },
})
