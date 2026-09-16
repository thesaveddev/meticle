import { useCallback, useEffect, useState } from 'react'
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppColors, spacing, radii, FONT } from '../theme'
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

export function AnnualLeaveScreen({ session, onBack }: { session: AuthSession; onBack?: () => void }) {
  const c = useAppColors()
  const [types, setTypes] = useState<any[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [reason, setReason] = useState('')
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
  }, [session.accessToken, selectedType])

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.ink }]}>Request time away</Text>
        <Text style={[styles.sub, { color: c.muted }]}>Requests use the same leave types, balances, approval rules, and audit trail as the web app.</Text>
        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

        <Text style={[styles.label, { color: c.ink }]}>Leave type</Text>
        <View style={styles.chips}>{types.map(type => <Pressable key={type.id} onPress={() => setSelectedType(type.id)} style={[styles.chip, { backgroundColor: selectedType === type.id ? c.primary : c.surface, borderColor: c.border }]}><Text style={{ color: selectedType === type.id ? c.inverse : c.ink, fontFamily: FONT, fontSize: 13 }}>{type.name}</Text></Pressable>)}</View>

        <Text style={[styles.label, { color: c.ink }]}>Start date</Text>
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: c.border }]} />
        <Text style={[styles.label, { color: c.ink }]}>End date</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtle} style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: c.border }]} />
        <View style={styles.quick}><Pressable onPress={() => { const d = today(); setStartDate(d); setEndDate(d) }}><Text style={{ color: c.primary, fontFamily: FONT }}>Today</Text></Pressable><Pressable onPress={() => { const d = addDays(today(), 1); setStartDate(d); setEndDate(d) }}><Text style={{ color: c.primary, fontFamily: FONT }}>Tomorrow</Text></Pressable></View>

        <Text style={[styles.label, { color: c.ink }]}>Reason (optional)</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="Add a note for your approver" placeholderTextColor={c.subtle} multiline style={[styles.input, styles.notes, { color: c.ink, backgroundColor: c.surface, borderColor: c.border }]} />
        <Pressable onPress={submit} disabled={saving} style={[styles.submit, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}><Text style={{ color: c.inverse, fontFamily: FONT, fontWeight: '700' }}>{saving ? 'Submitting…' : 'Submit leave request'}</Text></Pressable>

        <Text style={[styles.section, { color: c.subtle }]}>BALANCES</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>{balances.length ? balances.map(balance => <View key={`${balance.leave_type_id}-${balance.year}`} style={styles.row}><Text style={[styles.rowTitle, { color: c.ink }]}>{balance.leave_type_name}</Text><Text style={[styles.rowMeta, { color: c.muted }]}>{balance.duration_type === 'hours' ? `${balance.hours_remaining ?? 0} hours remaining` : `${balance.days_remaining ?? 0} days remaining`}</Text></View>) : <Text style={[styles.rowMeta, { color: c.muted }]}>No balances configured yet.</Text>}</View>

        <Text style={[styles.section, { color: c.subtle }]}>MY REQUESTS</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>{requests.length ? requests.map(request => <View key={request.id} style={styles.request}><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.ink }]}>{request.leave_type_name}</Text><Text style={[styles.rowMeta, { color: c.muted }]}>{request.start_date} to {request.end_date}</Text></View><View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={[styles.status, { color: request.status === 'approved' ? c.success : request.status === 'rejected' ? c.danger : c.warning }]}>{request.status}</Text>{request.status === 'pending' ? <Pressable onPress={() => cancel(request.id)}><Text style={{ color: c.danger, fontFamily: FONT, fontSize: 12 }}>Cancel</Text></Pressable> : null}</View></View>) : <Text style={[styles.rowMeta, { color: c.muted }]}>No leave requests yet.</Text>}</View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: FONT, fontSize: 17, fontWeight: '700' },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl }, heading: { fontFamily: FONT, fontSize: 22, fontWeight: '700' }, sub: { fontFamily: FONT, fontSize: 13, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.base }, error: { fontFamily: FONT, marginBottom: spacing.md }, label: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, chip: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, input: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, fontFamily: FONT, fontSize: 14 }, notes: { minHeight: 80, textAlignVertical: 'top' }, quick: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.sm }, submit: { alignItems: 'center', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg }, section: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm }, card: { borderRadius: radii.lg, padding: spacing.md }, row: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB' }, request: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB' }, rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' }, rowMeta: { fontFamily: FONT, fontSize: 12, marginTop: 3 }, status: { fontFamily: FONT, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
})
